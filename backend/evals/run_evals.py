"""Run the evaluation suite and write evals/results/latest.json and latest.md.

    python -m evals.run_evals                 # everything (needs GEMINI_API_KEY)
    python -m evals.run_evals --memo-cases 8  # fewer generated memos, to stay inside free-tier limits

Sections that need Gemini are skipped, and reported as skipped, when no key is set.
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import time
from datetime import datetime, timezone
from pathlib import Path

from app import config, llm
from app.agents.graph import retrieval_query
from app.agents.report_agent import build_prompt, generate_memo
from app.schemas import decision_from_score
from app.tools.comparables import comparable_lookup
from app.tools.rag_lookup import format_hit, retrieve
from app.tools.risk_calculator import risk_score_calculator
from evals.golden import golden_cases

RESULTS = Path(__file__).parent / "results"
K = 4


def pause() -> None:
    time.sleep(float(os.getenv("EVAL_DELAY_S", "7")))


def deterministic(cases: list[dict]) -> dict:
    rows = []
    for case in cases:
        scored = risk_score_calculator(case["facts"])
        decision = decision_from_score(scored["score"])
        rows.append({"id": case["id"], "score": scored["score"], "decision": decision, "correct": decision == case["expected_decision"] and sorted(scored["flags"]) == sorted(case["expected_flags"])})
    return {"cases": len(rows), "accuracy": sum(row["correct"] for row in rows) / len(rows), "rows": rows}


def retrieval(cases: list[dict]) -> dict:
    rows = []
    for case in cases:
        hits = retrieve(retrieval_query(case["facts"]), k=K)
        ranked = [hit["id"] for hit in hits]
        relevant = set(case["relevant_guidelines"])
        first = next((rank for rank, section in enumerate(ranked, start=1) if section in relevant), None)
        rows.append(
            {
                "id": case["id"],
                "retrieved": ranked,
                "relevant": sorted(relevant),
                "hit": first is not None,
                "recall": len(relevant & set(ranked)) / len(relevant),
                "reciprocal_rank": 1 / first if first else 0.0,
            }
        )
        pause()
    return {
        "k": K,
        "hit_rate": statistics.mean(row["hit"] for row in rows),
        "recall": statistics.mean(row["recall"] for row in rows),
        "mrr": statistics.mean(row["reciprocal_rank"] for row in rows),
        "rows": rows,
    }


def memo_state(case: dict) -> dict:
    scored = risk_score_calculator(case["facts"])
    hits = retrieve(retrieval_query(case["facts"]), k=K)
    return {
        "property_id": case["facts"]["property_id"],
        "raw_input": case["facts"],
        "extracted_features": {"image_status": "Unavailable", "image_reason": "No image submitted"},
        "guideline_hits": hits,
        "guideline_chunks": [format_hit(hit) for hit in hits],
        "risk_score": scored["score"],
        "risk_flags": scored["flags"],
        "risk_breakdown": scored["breakdown"],
        "comparables": comparable_lookup(case["facts"], k=5) if scored["score"] < 85 else [],
        "decision": decision_from_score(scored["score"]),
    }


def faithfulness_judge():
    from deepeval.metrics import FaithfulnessMetric
    from deepeval.models import GeminiModel

    return FaithfulnessMetric(model=GeminiModel(model=config.GEMINI_FALLBACK_MODEL, api_key=config.GEMINI_API_KEY), threshold=0.7, include_reason=True)


def judge(metric, state: dict, memo: dict) -> dict:
    from deepeval.test_case import LLMTestCase

    evidence = [json.dumps(state["raw_input"]), json.dumps({"decision": state["decision"], "risk_flags": state["risk_flags"]}), *state["guideline_chunks"]]
    output = " ".join([*memo["property_summary"], *memo["key_risk_factors"], memo["rationale"]])
    metric.measure(LLMTestCase(input="Explain the underwriting decision for this property.", actual_output=output, retrieval_context=evidence))
    return {"faithfulness": metric.score, "reason": metric.reason}


def memos(cases: list[dict]) -> dict:
    """Generate every memo twice, with TOON and JSON evidence, and compare."""
    metric = faithfulness_judge()
    rows = []
    for case in cases:
        base = memo_state(case)
        pause()
        for fmt in ("toon", "json"):
            config.PROMPT_FORMAT = fmt
            state = dict(base)
            memo = generate_memo(state)
            pause()
            row = {
                "id": case["id"],
                "format": fmt,
                "passed_contract": state.get("ai_memo_status") == "Available",
                "reason": state.get("ai_memo_reason", ""),
                "model": state.get("memo_model", ""),
                **state.get("memo_usage", {}),
            }
            if memo:
                cited = set(memo.get("guideline_citations", []))
                row["citation_precision"] = len(cited & set(case["relevant_guidelines"])) / len(cited) if cited else None
                row.update(judge(metric, state, memo))
                pause()
            rows.append(row)
    config.PROMPT_FORMAT = "toon"

    def summary(fmt: str) -> dict:
        subset = [row for row in rows if row["format"] == fmt]
        scored = [row for row in subset if row.get("faithfulness") is not None]
        cited = [row["citation_precision"] for row in subset if row.get("citation_precision") is not None]
        return {
            "memos": len(subset),
            "contract_pass_rate": statistics.mean(row["passed_contract"] for row in subset),
            "faithfulness": statistics.mean(row["faithfulness"] for row in scored) if scored else None,
            "citation_precision": statistics.mean(cited) if cited else None,
            "avg_input_tokens": statistics.mean(row["input_tokens"] for row in subset if row.get("input_tokens")) if any(row.get("input_tokens") for row in subset) else None,
            "avg_latency_ms": statistics.mean(row["latency_ms"] for row in subset if row.get("latency_ms")) if any(row.get("latency_ms") for row in subset) else None,
        }

    return {"toon": summary("toon"), "json": summary("json"), "rows": rows}


def prompt_tokens(cases: list[dict]) -> dict:
    """Token count of the full memo prompt in TOON vs JSON for every golden case."""
    rows = []
    for case in cases:
        state = memo_state(case)
        rows.append({"id": case["id"], "toon": llm.count_tokens(build_prompt(state, "toon")), "json": llm.count_tokens(build_prompt(state, "json"))})
        pause()
    toon, json_total = sum(row["toon"] for row in rows), sum(row["json"] for row in rows)
    return {"toon_tokens": toon, "json_tokens": json_total, "saving": 1 - toon / json_total, "rows": rows}


def shown(value: float | None, pattern: str) -> str:
    return format(value, pattern) if value is not None else "n/a"


def markdown(report: dict) -> str:
    lines = [f"# Evaluation results ({report['generated_at']})", "", f"Model: `{report['model']}` (fallback `{report['fallback_model']}`), judge: `{report['judge_model']}`", ""]
    det = report["deterministic"]
    lines += ["## Deterministic decisions", f"{det['cases']} golden cases, accuracy **{det['accuracy']:.0%}**", ""]
    for name, section in (("retrieval", "## Retrieval (RAG)"), ("prompt_tokens", "## TOON vs JSON: prompt tokens"), ("memos", "## Memos: TOON vs JSON")):
        lines.append(section)
        data = report.get(name)
        if not data:
            lines += ["Skipped (needs GEMINI_API_KEY).", ""]
            continue
        if name == "retrieval":
            lines += [f"k={data['k']}: hit rate **{data['hit_rate']:.0%}**, recall **{data['recall']:.0%}**, MRR **{data['mrr']:.2f}**", ""]
        elif name == "prompt_tokens":
            lines += [f"TOON {data['toon_tokens']:,} vs JSON {data['json_tokens']:,} tokens across {len(data['rows'])} prompts: **{data['saving']:.0%} fewer with TOON**", ""]
        else:
            lines += ["| Format | Memos | Contract pass | Faithfulness | Citation precision | Avg input tokens | Avg latency (ms) |", "|---|---|---|---|---|---|---|"]
            for fmt in ("toon", "json"):
                s = data[fmt]
                lines.append(f"| {fmt.upper()} | {s['memos']} | {s['contract_pass_rate']:.0%} | {shown(s['faithfulness'], '.2f')} | {shown(s['citation_precision'], '.0%')} | {shown(s['avg_input_tokens'], ',.0f')} | {shown(s['avg_latency_ms'], ',.0f')} |")
            lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--memo-cases", type=int, default=8)
    args = parser.parse_args()

    cases = golden_cases()
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "model": config.GEMINI_MODEL_NAME,
        "fallback_model": config.GEMINI_FALLBACK_MODEL,
        "judge_model": config.GEMINI_FALLBACK_MODEL,
        "deterministic": deterministic(cases),
        "retrieval": None,
        "prompt_tokens": None,
        "memos": None,
    }
    if config.GEMINI_API_KEY:
        report["retrieval"] = retrieval(cases)
        report["prompt_tokens"] = prompt_tokens(cases)
        step = max(1, len(cases) // args.memo_cases)
        report["memos"] = memos(cases[::step][: args.memo_cases])
    RESULTS.mkdir(exist_ok=True)
    (RESULTS / "latest.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    (RESULTS / "latest.md").write_text(markdown(report), encoding="utf-8")
    print(markdown(report))


if __name__ == "__main__":
    main()
