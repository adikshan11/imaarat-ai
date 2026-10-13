"""The owner's dev console: how the running service is built and what it is doing, without any visitor input or secrets."""

from __future__ import annotations

import os
import platform
import time
from typing import Any

from fastapi import FastAPI
from sqlalchemy import select

from app import __version__, budget, config, llm, telemetry
from app.db import is_postgres
from app.observability import ENABLED as TRACING_ENABLED

NODE_NOTES = {
    "intake": "Validates and normalises the submitted property facts.",
    "extract_features": "Turns the facts into the fields the rule engine scores.",
    "score_risk": "Fixed rules produce the 0 to 100 score and the risk flags. AI cannot change this.",
    "rag_guidelines": "Hybrid search over guidelines G1 to G12 and the reference notes.",
    "fetch_comparables": "Finds similar properties. Skipped at a score of 85 or more.",
    "decide": "Maps the score to Accept, Refer or Decline.",
    "generate_report": "Gemini writes the risk summary; a mechanical check rejects anything the rules do not support.",
    "human_review": "Referrals pause here until an underwriter signs off.",
}


def overview() -> dict[str, Any]:
    from app.tools import rag_lookup

    sections = rag_lookup.guideline_sections()
    return {
        "version": __version__,
        "deployment": {
            "environment": os.getenv("VERCEL_ENV") or "local",
            "region": os.getenv("VERCEL_REGION"),
            "commit": (os.getenv("VERCEL_GIT_COMMIT_SHA") or "")[:7] or None,
            "branch": os.getenv("VERCEL_GIT_COMMIT_REF"),
            "python": platform.python_version(),
            "database": "postgresql" if is_postgres() else "sqlite",
            "uptime_seconds": round(time.time() - telemetry.process_started),
        },
        "ai": {
            "provider": config.AI_PROVIDER,
            "model": config.AI_MODEL,
            "embedding_model": config.AI_EMBEDDING_MODEL,
            "judge_model": config.AI_JUDGE_MODEL,
            "prompt_format": config.PROMPT_FORMAT,
            "thinking": config.STAGE_THINKING,
            "attempts": config.AI_ATTEMPTS,
            "call_timeout_ms": config.AI_TIMEOUT_MS,
            "request_seconds": config.AI_REQUEST_SECONDS,
            "output_tokens": config.AI_STAGE_OUTPUT_TOKENS,
            "key_configured": bool(config.AI_API_KEY),
            "tracing": TRACING_ENABLED,
        },
        "limits": budget.limits(),
        "budget": budget.remaining(),
        "retrieval": {
            "store": "qdrant" if config.QDRANT_URL else "local",
            "guidelines": sum(section["id"].startswith("G") for section in sections),
            "reference_notes": sum(section["id"].startswith("R") for section in sections),
            "corpus_hash": rag_lookup.corpus_hash(sections),
        },
    }


def architecture() -> dict[str, Any]:
    from app.agents.graph import build_graph

    drawn = build_graph().compile().get_graph()
    return {
        "nodes": [{"id": name, "note": NODE_NOTES.get(name, "")} for name in drawn.nodes if not name.startswith("__")],
        "edges": [{"from": edge.source, "to": edge.target, "conditional": bool(edge.conditional)} for edge in drawn.edges],
        "mermaid": drawn.draw_mermaid(),
    }


def routes(app: FastAPI) -> list[dict[str, str]]:
    rows = [{"method": method.upper(), "path": path, "name": operation.get("summary", "")} for path, operations in app.openapi()["paths"].items() for method, operation in operations.items()]
    return sorted(rows, key=lambda row: (row["path"], row["method"]))


def ai_calls(limit: int = 40) -> list[dict[str, Any]]:
    columns = budget.usage.c
    with budget.engine().connect() as connection:
        rows = connection.execute(
            select(columns.created_at, columns.stage, columns.status, columns.model, columns.input_tokens, columns.output_tokens, columns.latency_ms).order_by(columns.id.desc()).limit(limit)
        ).all()
    return [
        {
            "at": row.created_at.isoformat() if hasattr(row.created_at, "isoformat") else str(row.created_at),
            "stage": row.stage,
            "status": row.status,
            "model": row.model,
            "input_tokens": row.input_tokens,
            "output_tokens": row.output_tokens,
            "latency_ms": row.latency_ms,
        }
        for row in rows
    ]


def traces(limit: int = 12) -> list[dict[str, Any]]:
    telemetry.flush()
    with telemetry.engine().connect() as connection:
        recent = connection.execute(
            select(telemetry.traces.c.trace_id, telemetry.traces.c.created_at, telemetry.traces.c.total_ms, telemetry.traces.c.memo_status, telemetry.traces.c.decision)
            .order_by(telemetry.traces.c.id.desc())
            .limit(limit)
        ).all()
        span_rows = (
            connection.execute(
                select(telemetry.spans.c.trace_id, telemetry.spans.c.name, telemetry.spans.c.start_ms, telemetry.spans.c.duration_ms, telemetry.spans.c.status)
                .where(telemetry.spans.c.trace_id.in_([row.trace_id for row in recent]))
                .order_by(telemetry.spans.c.id)
            ).all()
            if recent
            else []
        )
    waterfall: dict[str, list[dict[str, Any]]] = {}
    for span in span_rows:
        waterfall.setdefault(span.trace_id, []).append({"name": span.name, "start_ms": span.start_ms, "duration_ms": span.duration_ms, "status": span.status})
    return [
        {
            "at": row.created_at.isoformat() if hasattr(row.created_at, "isoformat") else str(row.created_at),
            "total_ms": row.total_ms,
            "memo_status": row.memo_status,
            "decision": row.decision,
            "spans": waterfall.get(row.trace_id, []),
        }
        for row in recent
    ]


def retrieval(query: str, k: int = 8) -> dict[str, Any]:
    from app.tools import rag_lookup

    if not config.AI_API_KEY:
        return {"available": False, "reason": "AI is not configured on this deployment", "rows": []}
    try:
        vector = llm.embed([query], "query")[0]
        sections = rag_lookup.guideline_sections()
        dense = rag_lookup.qdrant_search(vector, len(sections)) if config.QDRANT_URL else rag_lookup.local_search(vector, len(sections))
        keyword = rag_lookup.keyword_ranking(query)
    except Exception as error:
        return {"available": False, "reason": llm.failure_reason(error), "rows": []}
    rows = []
    for position, hit in enumerate(rag_lookup.fuse(dense, keyword)[:k], start=1):
        dense_rank = dense.index(hit) + 1
        keyword_rank = keyword.index(hit["id"]) + 1
        rows.append(
            {
                "id": hit["id"],
                "title": hit["title"],
                "authority": hit.get("authority"),
                "rank": position,
                "dense_rank": dense_rank,
                "dense_score": hit.get("score"),
                "keyword_rank": keyword_rank,
                "fused_score": round(1 / (60 + dense_rank) + 1 / (60 + keyword_rank), 5),
                "preview": hit["text"][:240],
            }
        )
    return {"available": True, "reason": None, "rows": rows}
