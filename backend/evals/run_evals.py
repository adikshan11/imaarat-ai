"""Write synthetic rule checks; live AI requires --live and at most two cases."""

from __future__ import annotations

import argparse
import contextlib
import io
import json
import math
import os
import statistics
import time
from datetime import datetime, timezone
from pathlib import Path

from app import config, llm
from app.agents.graph import retrieval_query
from app.agents.report_agent import build_prompt, generate_memo
from app.evaluation import empty_report
from app.schemas import decision_from_score
from app.tools.comparables import comparable_lookup
from app.tools.rag_lookup import format_hit, local_search, qdrant_search
from app.tools.risk_calculator import risk_score_calculator
from evals.golden import golden_cases

RESULTS = Path(__file__).parent / "results"
K = 4


def retrieve(query: str, k: int = K) -> list[dict]:
    vector = llm.embed([query], "RETRIEVAL_QUERY")[0]
    hits = qdrant_search(vector, k) if config.QDRANT_URL else local_search(vector, k)
    return hits


def mean(values) -> float | None:
    values = list(values)
    return statistics.mean(values) if values else None


def pause() -> None:
    time.sleep(float(os.getenv("EVAL_DELAY_S", "7")))


def deterministic(cases: list[dict]) -> dict:
    rows = []
    for case in cases:
        scored = risk_score_calculator(case["facts"])
        decision = decision_from_score(scored["score"])
        rows.append({"id": case["id"], "score": scored["score"], "decision": decision, "correct": decision == case["expected_decision"] and sorted(scored["flags"]) == sorted(case["expected_flags"])})
    return {"cases": len(rows), "accuracy": mean(row["correct"] for row in rows), "passed": bool(rows) and all(row["correct"] for row in rows), "rows": rows}


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
                "recall": len(relevant & set(ranked)) / len(relevant) if relevant else None,
                "recall_threshold": 1 / len(relevant) if relevant else None,
                "reciprocal_rank": 1 / first if first else 0.0,
            }
        )
        pause()
    return {
        "k": K,
        "cases": len(rows),
        "hit_rate": mean(row["hit"] for row in rows),
        "recall": mean(row["recall"] for row in rows if row["recall"] is not None),
        "mrr": mean(row["reciprocal_rank"] for row in rows),
        "thresholds": {"hit_rate": 1.0, "recall": mean(row["recall_threshold"] for row in rows if row["recall_threshold"] is not None)},
        "passed": bool(rows) and all(row["hit"] and row["recall"] is not None and row["recall"] >= row["recall_threshold"] for row in rows),
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
    os.environ.setdefault("DEEPEVAL_TELEMETRY_OPT_OUT", "YES")
    from deepeval.metrics import FaithfulnessMetric
    from deepeval.models import GeminiModel

    return FaithfulnessMetric(model=GeminiModel(model=config.GEMINI_FALLBACK_MODEL, api_key=config.GEMINI_API_KEY), threshold=0.7, include_reason=True, async_mode=False, eval_mode="llm")


def judge(metric, state: dict, memo: dict) -> dict:
    from deepeval.test_case import LLMTestCase

    evidence = [json.dumps(state["raw_input"]), json.dumps({"decision": state["decision"], "risk_flags": state["risk_flags"]}), *state["guideline_chunks"]]
    output = json.dumps(memo, ensure_ascii=False)
    metric.measure(LLMTestCase(input="Explain the underwriting decision for this property.", actual_output=output, retrieval_context=evidence))
    if getattr(metric, "error", None) or metric.score is None or not math.isfinite(metric.score) or not 0 <= metric.score <= 1:
        raise RuntimeError("judge_score_unavailable")
    return {"faithfulness": metric.score, "reason": metric.reason}


def generation_client():
    return llm.genai.Client(api_key=config.GEMINI_API_KEY, http_options=llm.types.HttpOptions(timeout=config.GEMINI_TIMEOUT_MS, retry_options=llm.types.HttpRetryOptions(attempts=1)))


def generate_once(state: dict) -> dict:
    previous_client = llm.client
    previous_fallback = config.GEMINI_FALLBACK_MODEL
    try:
        llm.client = generation_client
        config.GEMINI_FALLBACK_MODEL = config.GEMINI_MODEL_NAME
        return generate_memo(state)
    finally:
        llm.client = previous_client
        config.GEMINI_FALLBACK_MODEL = previous_fallback


def memos(cases: list[dict]) -> dict:
    """Compare at most two synthetic cases in both formats, retaining failures."""
    if not 1 <= len(cases) <= 2:
        raise ValueError("Expected one or two memo cases")
    rows = []
    generation_attempts = 0
    setup_reason = None
    try:
        metric = faithfulness_judge()
    except Exception as error:
        setup_reason = f"judge_setup_failed: {type(error).__name__}"
    previous = config.PROMPT_FORMAT
    try:
        for case in cases:
            preparation_reason = setup_reason
            if preparation_reason is None:
                try:
                    base = memo_state(case)
                    pause()
                except Exception as error:
                    preparation_reason = f"preparation_failed: {type(error).__name__}"
            for fmt in ("toon", "json"):
                config.PROMPT_FORMAT = fmt
                row = {"id": case["id"], "format": fmt, "status": "failed", "passed_contract": False, "passed": False, "generation_attempted": False, "reason": "memo_unavailable"}
                if preparation_reason is not None:
                    row["reason"] = preparation_reason
                    rows.append(row)
                    continue
                state = dict(base)
                stage = "generation"
                try:
                    with contextlib.redirect_stdout(io.StringIO()):
                        generation_attempts += 1
                        row["generation_attempted"] = True
                        memo = generate_once(state)
                    row.update({"passed_contract": bool(memo) and state.get("ai_memo_status") == "Available", "model": state.get("memo_model"), **state.get("memo_usage", {})})
                    pause()
                    if row["passed_contract"]:
                        stage = "judge"
                        result = judge(metric, state, memo)
                        score = result.get("faithfulness")
                        if not isinstance(score, (float, int)) or not math.isfinite(score) or not 0 <= score <= 1:
                            raise RuntimeError("judge_score_unavailable")
                        row.update(result)
                        row["status"] = "completed"
                        row["passed"] = score >= 0.7
                        cited = set(memo.get("guideline_citations", []))
                        row["citation_precision"] = len(cited & set(case["relevant_guidelines"])) / len(cited) if cited else None
                        pause()
                except Exception as error:
                    row["reason"] = f"{stage}_failed: {type(error).__name__}"
                rows.append(row)
    finally:
        config.PROMPT_FORMAT = previous

    def summary(fmt: str) -> dict:
        subset = [row for row in rows if row["format"] == fmt]
        completed = [row for row in subset if row["status"] == "completed"]
        scored = [row for row in completed if row.get("faithfulness") is not None]
        cited = [row["citation_precision"] for row in completed if row.get("citation_precision") is not None]
        return {
            "memos": len(subset),
            "generation_attempts": sum(row["generation_attempted"] for row in subset),
            "failed": len(subset) - len(completed),
            "faithfulness_cases": len(scored),
            "citation_cases": len(cited),
            "contract_pass_rate": mean(row["passed_contract"] for row in subset),
            "faithfulness": mean(row["faithfulness"] for row in scored),
            "citation_precision": mean(cited),
            "avg_input_tokens": mean(row["input_tokens"] for row in completed if row.get("input_tokens") is not None),
            "avg_latency_ms": mean(row["latency_ms"] for row in completed if row.get("latency_ms") is not None),
        }

    return {"toon": summary("toon"), "json": summary("json"), "generation_attempts": generation_attempts, "passed": bool(rows) and all(row["passed"] for row in rows), "rows": rows}


def prompt_tokens(cases: list[dict]) -> dict:
    """Count the instruction/evidence prompts, excluding system text and schema."""
    rows = []
    for case in cases:
        state = memo_state(case)
        rows.append({"id": case["id"], "toon": llm.count_tokens(build_prompt(state, "toon")), "json": llm.count_tokens(build_prompt(state, "json"))})
        if any(not isinstance(rows[-1][fmt], int) or rows[-1][fmt] < 0 for fmt in ("toon", "json")):
            raise RuntimeError("token_count_unavailable")
        pause()
    toon, json_total = sum(row["toon"] for row in rows), sum(row["json"] for row in rows)
    return {"toon_tokens": toon, "json_tokens": json_total, "saving": 1 - toon / json_total if json_total else None, "rows": rows}


def shown(value: float | None, pattern: str) -> str:
    return format(value, pattern) if value is not None else "n/a"


def markdown(report: dict) -> str:
    lines = [f"# Evaluation results ({report['generated_at']})", "", f"Mode: {report['run_mode']}; status: {report['status']}; AI passed: {report['passed']}", "", f"Configured model: {report['model']}; judge: {report['judge_model']}", ""]
    det = report["deterministic"]
    lines += ["## Deterministic decisions", f"{det['cases']} handcrafted synthetic cases: rule agreement {shown(det['accuracy'], '.0%')}. Not LLM accuracy; not real-property validation.", ""]
    for name, section in (("retrieval", "## Retrieval (RAG)"), ("prompt_tokens", "## TOON vs JSON: prompt tokens"), ("memos", "## Memos: TOON vs JSON")):
        lines.append(section)
        data = report.get(name)
        state = report["sections"][name]
        lines.append(f"Status: {state['status']}; reason: {state.get('reason', 'none')}")
        if not data:
            lines.append("")
            continue
        if name == "retrieval":
            lines += [f"k={data['k']}: hit rate **{shown(data['hit_rate'], '.0%')}**, recall **{shown(data['recall'], '.0%')}**, MRR **{shown(data['mrr'], '.2f')}**",
                      f"Thresholds: hit rate {shown(data['thresholds']['hit_rate'], '.0%')}; recall {shown(data['thresholds']['recall'], '.0%')}; retrieval passed: {data['passed']}", report["metadata"]["retrieval_acceptance"], ""]
        elif name == "prompt_tokens":
            lines += [f"TOON {data['toon_tokens']:,} vs JSON {data['json_tokens']:,} tokens across {len(data['rows'])} prompts; relative token difference: {shown(data['saving'], '.0%')}", ""]
        else:
            lines += ["| Format | Memos | Contract pass | Faithfulness | Citation precision | Avg input tokens | Avg latency (ms) |", "|---|---|---|---|---|---|---|"]
            for fmt in ("toon", "json"):
                s = data[fmt]
                lines.append(f"| {fmt.upper()} | {s['memos']} | {s['contract_pass_rate']:.0%} | {shown(s['faithfulness'], '.2f')} | {shown(s['citation_precision'], '.0%')} | {shown(s['avg_input_tokens'], ',.0f')} | {shown(s['avg_latency_ms'], ',.0f')} |")
            lines.append("")
            for fmt in ("toon", "json"):
                s = data[fmt]
                lines.append(f"{fmt}: judge denominator {s['faithfulness_cases']}/{s['memos']} planned case-format slots; generation attempts {s['generation_attempts']}; failed executions {s['failed']}.")
            for row in data["rows"]:
                if not row["passed"]:
                    lines.append(f"{row['id']} ({row['format']}): {row['status']}; {row['reason']}")
            lines.append("")
    lines += [report["metadata"]["faithfulness_denominator"], "", "Corpus and bounded-run metadata:", json.dumps(report["metadata"], indent=2)]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", help="Only after credential approval; enables provider calls")
    parser.add_argument("--memo-cases", type=int, choices=(1, 2), default=2)
    args = parser.parse_args()

    cases = golden_cases()
    report = empty_report()
    report.update({"generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "run_mode": "live_bounded" if args.live else "deterministic_only", "status": "completed", "deterministic": deterministic(cases)})
    report["metadata"].update({"synthetic_cases": len(cases), "selected_live_cases": [], "memo_generations": 0})
    report["sections"]["deterministic"] = {"status": "completed" if report["deterministic"]["passed"] else "failed"}
    reason = "live_not_requested" if config.GEMINI_API_KEY else "missing_api_key"
    for name in ("retrieval", "prompt_tokens", "memos"):
        report["sections"][name] = {"status": "skipped", "reason": reason}
    if args.live and not config.GEMINI_API_KEY:
        report.update({"status": "failed", "passed": False})
    elif args.live:
        selected = cases[::max(1, len(cases) // args.memo_cases)][:args.memo_cases]
        report["metadata"]["selected_live_cases"] = [case["id"] for case in selected]
        for name, function in (("retrieval", retrieval), ("prompt_tokens", prompt_tokens), ("memos", memos)):
            try:
                report[name] = function(selected)
                passed = name == "prompt_tokens" or report[name].get("passed") is True
                report["sections"][name] = {"status": "completed" if passed or name == "retrieval" else "failed", "reason": "checks_failed" if not passed else "measured", "passed": passed}
                if name == "retrieval":
                    report["metadata"]["retrieval_thresholds"] = report[name]["thresholds"]
                if name == "memos":
                    report["metadata"]["memo_generations"] = report[name]["generation_attempts"]
                if not passed:
                    report.update({"status": "failed", "passed": False})
            except Exception as error:
                report["sections"][name] = {"status": "failed", "reason": type(error).__name__}
                report.update({"status": "failed", "passed": False})
                for pending in ("retrieval", "prompt_tokens", "memos"):
                    if report["sections"][pending]["status"] == "skipped":
                        report["sections"][pending]["reason"] = "earlier_section_failed"
                break
        if report["passed"] is not False:
            report["passed"] = report["deterministic"]["passed"]
    if not report["deterministic"]["passed"]:
        report.update({"status": "failed", "passed": False})
    RESULTS.mkdir(exist_ok=True)
    (RESULTS / "latest.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    (RESULTS / "latest.md").write_text(markdown(report), encoding="utf-8")
    print(markdown(report))
    return 1 if report["status"] == "failed" else 0


if __name__ == "__main__":
    raise SystemExit(main())
