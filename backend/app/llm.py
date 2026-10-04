"""Single entry point for Gemini calls: structured output, retries, model fallback and tracing."""

from __future__ import annotations

import json
import time
from typing import Any

import toon_format
from google import genai
from google.genai import types
from pydantic import BaseModel

from app import config
from app.observability import record_generation


def client() -> genai.Client:
    return genai.Client(
        api_key=config.GEMINI_API_KEY,
        http_options=types.HttpOptions(
            timeout=config.GEMINI_TIMEOUT_MS,
            retry_options=types.HttpRetryOptions(attempts=3, initial_delay=2.0, http_status_codes=[429, 500, 503]),
        ),
    )


def encode(data: Any, fmt: str | None = None) -> str:
    """Serialize prompt context as TOON (compact, tabular) or JSON."""
    if (fmt or config.PROMPT_FORMAT) == "toon":
        return toon_format.encode(data)
    return json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False, default=str)


def generate(name: str, contents: Any, schema: type[BaseModel] | None = None, system: str | None = None) -> dict[str, Any]:
    """Call Gemini, falling back to the lighter model when the primary fails.

    Returns {"text", "model", "input_tokens", "output_tokens", "latency_ms"}; raises the last error
    when every model fails.
    """
    gemini = client()
    generation_config = types.GenerateContentConfig(
        system_instruction=system,
        temperature=0.2,
        response_mime_type="application/json" if schema else None,
        response_schema=schema,
    )
    last_error: Exception | None = None
    for model in dict.fromkeys([config.GEMINI_MODEL_NAME, config.GEMINI_FALLBACK_MODEL]):
        started = time.perf_counter()
        try:
            response = gemini.models.generate_content(model=model, contents=contents, config=generation_config)
        except Exception as error:
            last_error = error
            print(f"[llm] {name} model={model} failed: {type(error).__name__}: {str(error)[:120]}")
            continue
        usage = getattr(response, "usage_metadata", None)
        result = {
            "text": getattr(response, "text", None) or "",
            "model": model,
            "input_tokens": getattr(usage, "prompt_token_count", None),
            "output_tokens": getattr(usage, "candidates_token_count", None),
            "latency_ms": round((time.perf_counter() - started) * 1000),
        }
        record_generation(name, model, contents, result)
        return result
    raise last_error or RuntimeError("no Gemini model configured")


def count_tokens(text: str) -> int:
    return client().models.count_tokens(model=config.GEMINI_MODEL_NAME, contents=text).total_tokens


def embed(texts: list[str], task_type: str) -> list[list[float]]:
    response = client().models.embed_content(
        model=config.GEMINI_EMBEDDING_MODEL_NAME,
        contents=texts,
        config=types.EmbedContentConfig(task_type=task_type),
    )
    return [list(item.values) for item in response.embeddings]
