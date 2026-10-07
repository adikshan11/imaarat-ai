"""Langfuse tracing: active only when LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are set."""

from __future__ import annotations

import os
from collections.abc import Callable
from typing import Any

ENABLED = bool(os.getenv("LANGFUSE_PUBLIC_KEY") and os.getenv("LANGFUSE_SECRET_KEY"))


def untraced(func: Callable) -> Callable:
    return func


def traced(name: str, as_type: str = "span") -> Callable:
    if not ENABLED:
        return untraced
    from langfuse import observe

    return observe(name=name, as_type=as_type)


def describe(contents: Any) -> Any:
    if isinstance(contents, str):
        return contents
    if isinstance(contents, list):
        return [item if isinstance(item, str) else f"<{type(item).__name__}>" for item in contents]
    return str(contents)


def record_generation(name: str, model: str, contents: Any, result: dict[str, Any]) -> None:
    if not ENABLED:
        return
    from langfuse import get_client

    usage = {key: value for key, value in (("input", result["input_tokens"]), ("output", result["output_tokens"])) if value is not None}
    with get_client().start_as_current_observation(
        name=name,
        as_type="generation",
        model=model,
        input=describe(contents),
        output=result["text"],
        usage_details=usage,
        metadata={"latency_ms": result["latency_ms"]},
    ):
        pass


def publish_trace() -> str | None:
    """Make the current trace public and return its URL, so the result page can link to it."""
    if not ENABLED:
        return None
    from langfuse import get_client

    client = get_client()
    client.set_current_trace_as_public()
    return client.get_trace_url()


def flush() -> None:
    if ENABLED:
        from langfuse import get_client

        get_client().flush()
