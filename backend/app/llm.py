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
from app.observability import generation
from app.providers import EmbedTask, get_provider

RETRYABLE = {429, 500, 503}
deadline: ContextVar[float | None] = ContextVar("deadline", default=None)


class RequestTimeout(TimeoutError):
    pass


def encode(data: Any, fmt: str | None = None) -> str:
    """Serialize prompt context as TOON (compact, tabular) or JSON."""
    if (fmt or config.PROMPT_FORMAT) == "toon":
        return toon_format.encode(data)
    return json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False, default=str)


def attempt_ms(wait_seconds: float = 0, reserve_seconds: float = 0) -> int | None:
    """How long the next attempt may run, or None when the request has too little time left for one."""
    limit = deadline.get()
    if limit is None:
        return config.AI_TIMEOUT_MS
    available = round((limit - time.perf_counter() - wait_seconds - reserve_seconds) * 1000)
    return min(config.AI_TIMEOUT_MS, available) if available >= config.AI_MIN_ATTEMPT_MS else None


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


def budgeted(stage: str, call: Any, attempts: int | None = None, reserve_seconds: float = 0, timed: bool = False, **arguments: Any) -> tuple[Any, int, int]:
    """Run one provider call, reserving budget for every attempt and retrying only 429/5xx on the same model."""
    span = f"{config.AI_PROVIDER.title()} {stage}"
    attempts = attempts or config.AI_ATTEMPTS
    for attempt in range(1, attempts + 1):
        limit_ms = attempt_ms(0, reserve_seconds)
        if limit_ms is None:
            raise RequestTimeout(f"no time left in this request for another {stage} attempt")
        if timed:
            arguments["timeout_ms"] = limit_ms
        call_id = budget.reserve_call(stage)
        started = time.perf_counter()
        try:
            response = call(**arguments)
        except Exception as error:
            code = getattr(error, "code", None)
            budget.finish_call(call_id, "failed", latency_ms=round((time.perf_counter() - started) * 1000))
            telemetry.add_span(span, started, time.perf_counter(), f"error {code}" if code else "error")
            if code not in RETRYABLE or daily_quota(error) or attempt == attempts or attempt_ms(2**attempt, reserve_seconds) is None:
                raise
            sleep(2**attempt)
            continue
        telemetry.add_span(span, started, time.perf_counter(), "ok")
        return response, call_id, round((time.perf_counter() - started) * 1000)


def generate(name: str, contents: Any, schema: type[BaseModel] | None = None, system: str | None = None, max_output_tokens: int | None = None) -> dict[str, Any]:
    """Call the configured model; a busy error is retried once on the same model."""
    model = config.AI_MODEL
    with generation(name, model, contents) as result:
        reply, call_id, latency_ms = budgeted(
            name,
            get_provider().generate,
            timed=True,
            model=model,
            contents=contents if isinstance(contents, list) else [contents],
            system=system,
            schema=schema,
            thinking=config.STAGE_THINKING.get(name),
            temperature=0.2,
            max_output_tokens=max_output_tokens or config.AI_STAGE_OUTPUT_TOKENS,
        )
        result.update(
            {
                "text": reply.text,
                "model": model,
                "input_tokens": reply.input_tokens,
                "output_tokens": reply.output_tokens,
                "thought_tokens": reply.thought_tokens,
                "latency_ms": latency_ms,
            }
        )
        budget.finish_call(call_id, "succeeded", model, result["input_tokens"], result["output_tokens"], latency_ms)
    return result


def count_tokens(text: str) -> int:
    total, call_id, latency_ms = budgeted("count_tokens", get_provider().count_tokens, model=config.AI_MODEL, text=text)
    budget.finish_call(call_id, "succeeded", config.AI_MODEL, total, 0, latency_ms)
    return total


def embed(texts: list[str], task: EmbedTask) -> list[list[float]]:
    with generation("embed", config.AI_EMBEDDING_MODEL, texts, as_type="embedding") as result:
        vectors, call_id, latency_ms = budgeted("embed", get_provider().embed, model=config.AI_EMBEDDING_MODEL, texts=texts, task=task)
        result["latency_ms"] = latency_ms
    budget.finish_call(call_id, "succeeded", config.AI_EMBEDDING_MODEL, None, None, latency_ms)
    return vectors
