"""Single entry point for Gemini calls: one model per call, budgeted retries, structured output and tracing."""

from __future__ import annotations

import json
import time
from contextvars import ContextVar
from typing import Any

import toon_format
from google import genai
from google.genai import types
from pydantic import BaseModel

from app import budget, config, telemetry
from app.observability import record_generation

RETRYABLE = {429, 500, 503}
deadline: ContextVar[float | None] = ContextVar("deadline", default=None)


def client() -> genai.Client:
    return genai.Client(
        api_key=config.GEMINI_API_KEY,
        http_options=types.HttpOptions(
            timeout=config.GEMINI_TIMEOUT_MS,
            retry_options=types.HttpRetryOptions(attempts=1),
        ),
    )


def encode(data: Any, fmt: str | None = None) -> str:
    """Serialize prompt context as TOON (compact, tabular) or JSON."""
    if (fmt or config.PROMPT_FORMAT) == "toon":
        return toon_format.encode(data)
    return json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False, default=str)


def time_left(wait_seconds: float) -> bool:
    limit = deadline.get()
    return limit is None or limit - time.perf_counter() >= wait_seconds + config.GEMINI_TIMEOUT_MS / 1000


def budgeted(stage: str, call: Any, **arguments: Any) -> tuple[Any, int, int]:
    """Run one Gemini call, reserving budget for every attempt and retrying only 429/5xx on the same model."""
    for attempt in range(1, config.GEMINI_ATTEMPTS + 1):
        if not time_left(0):
            raise TimeoutError(f"no time left in this request for another {stage} attempt")
        call_id = budget.reserve_call(stage)
        started = time.perf_counter()
        try:
            response = call(**arguments)
        except Exception as error:
            code = getattr(error, "code", None)
            budget.finish_call(call_id, "failed", latency_ms=round((time.perf_counter() - started) * 1000))
            telemetry.add_span(f"Gemini {stage}", started, time.perf_counter(), f"error {code}" if code else "error")
            if code not in RETRYABLE or attempt == config.GEMINI_ATTEMPTS or not time_left(2 ** attempt):
                raise
            time.sleep(2 ** attempt)
            continue
        telemetry.add_span(f"Gemini {stage}", started, time.perf_counter(), "ok")
        return response, call_id, round((time.perf_counter() - started) * 1000)



def token_count(usage: Any, field: str) -> int | None:
    value = getattr(usage, field, None)
    return value if isinstance(value, int) else None


def generate(name: str, contents: Any, schema: type[BaseModel] | None = None, system: str | None = None) -> dict[str, Any]:
    """Call the configured Gemini model once (with budgeted retries) and return text, tokens and latency."""
    model = config.GEMINI_MODEL_NAME
    generation_config = types.GenerateContentConfig(
        system_instruction=system,
        temperature=0.2,
        max_output_tokens=config.AI_STAGE_OUTPUT_TOKENS,
        response_mime_type="application/json" if schema else None,
        response_schema=schema,
    )
    gemini = client()
    response, call_id, latency_ms = budgeted(name, gemini.models.generate_content, model=model, contents=contents, config=generation_config)
    usage = getattr(response, "usage_metadata", None)
    result = {
        "text": getattr(response, "text", None) or "",
        "model": model,
        "input_tokens": token_count(usage, "prompt_token_count"),
        "output_tokens": token_count(usage, "candidates_token_count"),
        "latency_ms": latency_ms,
    }
    budget.finish_call(call_id, "succeeded", model, result["input_tokens"], result["output_tokens"], latency_ms)
    record_generation(name, model, contents, result)
    return result


def count_tokens(text: str) -> int:
    gemini = client()
    response, call_id, latency_ms = budgeted("count_tokens", gemini.models.count_tokens, model=config.GEMINI_MODEL_NAME, contents=text)
    budget.finish_call(call_id, "succeeded", config.GEMINI_MODEL_NAME, response.total_tokens, 0, latency_ms)
    return response.total_tokens


def embed(texts: list[str], task_type: str) -> list[list[float]]:
    gemini = client()
    response, call_id, latency_ms = budgeted(
        "embed",
        gemini.models.embed_content,
        model=config.GEMINI_EMBEDDING_MODEL_NAME,
        contents=texts,
        config=types.EmbedContentConfig(task_type=task_type),
    )
    budget.finish_call(call_id, "succeeded", config.GEMINI_EMBEDDING_MODEL_NAME, None, None, latency_ms)
    return [list(item.values) for item in response.embeddings]
