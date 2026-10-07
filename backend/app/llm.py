"""The AI gateway: every model call goes through here for budgets, retries, the request deadline and tracing. Vendor code lives in app/providers/."""

from __future__ import annotations

import json
import time
from contextvars import ContextVar
from time import sleep  # tests patch llm.sleep; patching time.sleep would also spin the telemetry writer thread
from typing import Any

import toon_format
from pydantic import BaseModel

from app import budget, config, telemetry
from app.observability import record_generation
from app.providers import EmbedTask, get_provider

RETRYABLE = {429, 500, 503}
deadline: ContextVar[float | None] = ContextVar("deadline", default=None)


def encode(data: Any, fmt: str | None = None) -> str:
    """Serialize prompt context as TOON (compact, tabular) or JSON."""
    if (fmt or config.PROMPT_FORMAT) == "toon":
        return toon_format.encode(data)
    return json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False, default=str)


def time_left(wait_seconds: float) -> bool:
    limit = deadline.get()
    return limit is None or limit - time.perf_counter() >= wait_seconds + config.AI_TIMEOUT_MS / 1000


def daily_quota(error: Exception) -> bool:
    return getattr(error, "daily_quota", False) or "PerDay" in str(error)


def failure_reason(error: Exception) -> str:
    """Plain words for why an AI step did not run, the same in every component and for every provider."""
    if isinstance(error, budget.BudgetExceeded) and error.scope == "this minute":
        return "This demo's AI is at its per-minute limit. Try again in a minute."
    if isinstance(error, budget.BudgetExceeded) or daily_quota(error):
        return "This demo has used today's AI allowance, which resets every day."
    if getattr(error, "code", None) in (429, 500, 502, 503, 504) or "Timeout" in type(error).__name__:
        return "The AI model is busy right now. Try again in a few minutes."
    return f"The AI model returned an error ({type(error).__name__})."


def budgeted(stage: str, call: Any, **arguments: Any) -> tuple[Any, int, int]:
    """Run one provider call, reserving budget for every attempt and retrying only 429/5xx on the same model."""
    span = f"{config.AI_PROVIDER.title()} {stage}"
    for attempt in range(1, config.AI_ATTEMPTS + 1):
        if not time_left(0):
            raise TimeoutError(f"no time left in this request for another {stage} attempt")
        call_id = budget.reserve_call(stage)
        started = time.perf_counter()
        try:
            response = call(**arguments)
        except Exception as error:
            code = getattr(error, "code", None)
            budget.finish_call(call_id, "failed", latency_ms=round((time.perf_counter() - started) * 1000))
            telemetry.add_span(span, started, time.perf_counter(), f"error {code}" if code else "error")
            if code not in RETRYABLE or daily_quota(error) or attempt == config.AI_ATTEMPTS or not time_left(2**attempt):
                raise
            sleep(2**attempt)
            continue
        telemetry.add_span(span, started, time.perf_counter(), "ok")
        return response, call_id, round((time.perf_counter() - started) * 1000)


def generate(name: str, contents: Any, schema: type[BaseModel] | None = None, system: str | None = None) -> dict[str, Any]:
    """Call the configured model once (with budgeted retries) and return text, tokens and latency."""
    model = config.AI_MODEL
    reply, call_id, latency_ms = budgeted(
        name,
        get_provider().generate,
        model=model,
        contents=contents if isinstance(contents, list) else [contents],
        system=system,
        schema=schema,
        thinking=config.STAGE_THINKING.get(name),
        temperature=0.2,
        max_output_tokens=config.AI_STAGE_OUTPUT_TOKENS,
    )
    result = {
        "text": reply.text,
        "model": model,
        "input_tokens": reply.input_tokens,
        "output_tokens": reply.output_tokens,
        "thought_tokens": reply.thought_tokens,
        "latency_ms": latency_ms,
    }
    budget.finish_call(call_id, "succeeded", model, result["input_tokens"], result["output_tokens"], latency_ms)
    record_generation(name, model, contents, result)
    return result


def count_tokens(text: str) -> int:
    total, call_id, latency_ms = budgeted("count_tokens", get_provider().count_tokens, model=config.AI_MODEL, text=text)
    budget.finish_call(call_id, "succeeded", config.AI_MODEL, total, 0, latency_ms)
    return total


def embed(texts: list[str], task: EmbedTask) -> list[list[float]]:
    vectors, call_id, latency_ms = budgeted("embed", get_provider().embed, model=config.AI_EMBEDDING_MODEL, texts=texts, task=task)
    budget.finish_call(call_id, "succeeded", config.AI_EMBEDDING_MODEL, None, None, latency_ms)
    return vectors
