from __future__ import annotations

import json
import re
from typing import Any

from app import llm
from app.config import GEMINI_API_KEY
from app.observability import traced
from app.schemas import UnderwritingMemo

MEMO_FIELDS = {
    "property_summary",
    "key_risk_factors",
    "coverage_review",
    "decision",
    "rationale",
    "suggested_next_steps",
    "guideline_citations",
}
OPTIONAL_LISTS = {"guideline_citations"}

def _failure(state: dict, status: str, reason: str) -> dict[str, Any]:
    state["memo_error"] = reason
    state["ai_memo_reason"] = reason
    state["ai_memo_status"] = status
    return {}

def _validate_memo(candidate: Any, state: dict) -> dict[str, Any]:
    if not isinstance(candidate, dict) or set(candidate) != MEMO_FIELDS:
        return _failure(state, "Incomplete", "Invalid structured memo shape")
    if not all(isinstance(candidate[field], list) and (candidate[field] or field in OPTIONAL_LISTS) for field in MEMO_FIELDS if field not in ("decision", "rationale")):
        return _failure(state, "Incomplete", "Structured memo contains empty required sections")
    if not isinstance(candidate["decision"], str) or candidate["decision"] != state.get("decision"):
        return _failure(state, "Incomplete", "Structured memo decision differs from deterministic decision")
    if not isinstance(candidate["rationale"], str) or not candidate["rationale"].strip():
        return _failure(state, "Incomplete", "Structured memo rationale is empty")
    flags = set(state.get("risk_flags", []))
    for item in candidate["key_risk_factors"]:
        if not isinstance(item, str) or not any(flag.lower() in item.lower() or flag.replace("_", " ").lower() in item.lower() for flag in flags):
            return _failure(state, "Incomplete", "Structured memo contains an unsupported risk factor")
    retrieved = {hit.get("id") for hit in state.get("guideline_hits", [])}
    if any(citation not in retrieved for citation in candidate["guideline_citations"]):
        return _failure(state, "Incomplete", "Structured memo cites guidance that was not retrieved")
    raw = state.get("raw_input", {})
    if raw.get("roof_age_years") is None:
        text = json.dumps(candidate).lower()
        if re.search(r"\b(roof|roofing).{0,30}\b\d+\s*(years?|yrs?)\b", text):
            return _failure(state, "Incomplete", "Structured memo contains unsupported roof-age claim")
    # Reject invented monetary values, invented rate percentages, and fabricated regulatory mandates in coverage_review
    _invented = [
        r"[₹$]\s*\d",                                   # specific monetary amounts
        r"\d+\s*%\s*(loading|rate|premium|deductible)",  # invented rate percentages
        r"mandatory under\b",                             # fabricated mandate claims
        r"required by (irdai|law|regulation)\b",         # fabricated compliance claims
    ]
    for item in candidate.get("coverage_review", []):
        if isinstance(item, str) and any(re.search(p, item, re.IGNORECASE) for p in _invented):
            return _failure(state, "Incomplete", "coverage_review contains an unsupported quantitative or regulatory claim")
    # Source-based grounding: a peril mentioned in coverage_review must map to a requested coverage field
    _coverage_map = {
        r"\bearth\s*quake\b": "earthquake_cover",
        r"\bflood\b": "flood_cover",
        r"\bcyclone\b": "cyclone_wind_cover",
        r"\brsmd\b": "rsmd_cover",
        r"\bterror": "terrorism_cover",
        r"\bbusiness\s+interruption\b": "business_interruption_cover",
    }
    for item in candidate.get("coverage_review", []):
        if isinstance(item, str):
            item_lower = item.lower()
            for pattern, field in _coverage_map.items():
                if re.search(pattern, item_lower) and not raw.get(field):
                    return _failure(state, "Incomplete", f"coverage_review references a peril not present in requested coverage ({field})")
    state["ai_memo_status"] = "Available"
    state["memo_error"] = ""
    return candidate


SYSTEM = """You are the explanatory AI layer of a commercial property underwriting system.
A deterministic Python rule engine has already scored the property and made the decision.
Your job is to explain that decision from the evidence supplied, never to change it."""

RULES = """Return the memo fields.

Use source priority exactly: PROPERTY FACTS, VISION EVIDENCE, DETERMINISTIC RESULT, UNDERWRITING GUIDANCE, REFERENCE PROPERTIES.
Guidance and reference properties are contextual evidence and never property facts. Missing facts remain missing.
The decision must exactly equal the deterministic decision. Do not return a score.
Key risk factors may mention only deterministic risk flags.

REQUESTED COVERAGE IS NOT EXPOSURE.
Requested coverage and extensions describe what the applicant wants insured.
Do not treat requested coverage as evidence that the property is exposed to that peril.
Do not convert a selected coverage into a risk factor, score adjustment, hazard observation, or loss expectation
unless the deterministic underwriting result or supplied evidence explicitly supports that conclusion.
coverage_review must list the requested coverage extensions found in property_facts,
and may identify review considerations such as product applicability, coverage dependencies,
exclusions or deductibles requiring review, or additional underwriting evidence needed.
coverage_review must NOT override the deterministic decision or risk score.
coverage_review must NOT contain invented monetary amounts, invented premium rates, invented regulatory mandates,
or invented mandatory deductible values. Do not invent any specific financial or compliance figures.
If no coverage extensions are requested, coverage_review must contain ["No additional coverage extensions requested."].
guideline_citations must list the IDs (such as G2) of the underwriting_guidance sections your rationale relies on, and only IDs present in underwriting_guidance."""


def build_prompt(state: dict, fmt: str | None = None) -> str:
    """Assemble the memo prompt; fmt selects TOON or JSON for the evidence block."""
    facts = {key: value for key, value in state.get("raw_input", {}).items() if value not in (None, "")}
    evidence = {
        "property_facts": facts,
        "vision_evidence": {key: value for key, value in state.get("extracted_features", {}).items() if key.startswith(("image_", "visible_", "vegetation_", "general_"))},
        "deterministic_result": {
            "decision": state.get("decision"),
            "risk_score": state.get("risk_score"),
            "risk_flags": state.get("risk_flags", []),
            "risk_breakdown": state.get("risk_breakdown", {}),
        },
        "underwriting_guidance": [{"id": hit["id"], "title": hit["title"], "text": hit["text"]} for hit in state.get("guideline_hits", [])],
        "reference_properties": state.get("comparables", []),
    }
    return f"{RULES}\n\nEvidence:\n{llm.encode(evidence, fmt)}"


@traced("memo", as_type="agent")
def generate_memo(state: dict) -> dict[str, Any]:
    """Generate and mechanically validate a grounded structured AI memo."""
    if not GEMINI_API_KEY:
        return _failure(state, "Unavailable", "missing API key")
    if state.get("ai_note"):
        return _failure(state, "Unavailable", state["ai_note"])

    pid = state.get("raw_input", {}).get("property_id", "unknown")
    try:
        result = llm.generate("memo", build_prompt(state), schema=UnderwritingMemo, system=SYSTEM)
    except Exception as e:
        print(f"[generate_memo] {pid} status=failed error={type(e).__name__}: {str(e)[:120]}")
        error_text = f"{type(e).__name__}: {str(e)}"
        response = getattr(e, "response", None)
        if response is not None:
            error_text = f"{error_text} {getattr(response, 'text', '')} {getattr(response, '_content', b'')}"
        if getattr(e, "code", None) == 429 or getattr(e, "status_code", None) == 429 or "429" in error_text:
            error_text = f"RESOURCE_EXHAUSTED: {error_text}"
        _failure(state, "Unavailable", error_text)
        busy = getattr(e, "code", None) in (429, 503) or "RESOURCE_EXHAUSTED" in error_text or "UNAVAILABLE" in error_text or "Timeout" in type(e).__name__
        if llm.daily_quota(e):
            state["ai_memo_reason"] = "This demo has used today's free AI allowance from Google, so the decision comes from the rules alone. The allowance resets every day."
        elif busy:
            state["ai_memo_reason"] = "Google's AI model is busy right now, so the decision comes from the rules alone. Try again in a few minutes."
        else:
            state["ai_memo_reason"] = f"the AI model returned an error ({type(e).__name__})"
        return {}

    state["memo_model"] = result["model"]
    state["memo_usage"] = {key: result[key] for key in ("input_tokens", "output_tokens", "thought_tokens", "latency_ms")}
    text = result["text"].strip().removeprefix("```json").removesuffix("```").strip()
    if not text:
        return _failure(state, "Incomplete", "empty response")
    try:
        candidate = json.loads(text)
    except json.JSONDecodeError:
        return _failure(state, "Incomplete", "invalid JSON response")
    memo = _validate_memo(candidate, state)
    print(f"[generate_memo] {pid} status={state.get('ai_memo_status')} model={result['model']}")
    return memo
