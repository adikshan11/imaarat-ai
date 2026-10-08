"""Langfuse tracing: active only when LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are set."""

from __future__ import annotations

import os
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from typing import Any

ENABLED = bool(os.getenv("LANGFUSE_PUBLIC_KEY") and os.getenv("LANGFUSE_SECRET_KEY"))


def untraced(func: Callable) -> Callable:
    return func


def traced(name: str, as_type: str = "span", capture_input: bool = True) -> Callable:
    if not ENABLED:
        return untraced
    from langfuse import observe

    return observe(name=name, as_type=as_type, capture_input=capture_input)


def describe(contents: Any) -> Any:
    if isinstance(contents, str):
        return contents
    if isinstance(contents, list):
        return [item if isinstance(item, str) else f"<{type(item).__name__}>" for item in contents]
    return str(contents)


@contextmanager
def generation(name: str, model: str, contents: Any, as_type: str = "generation") -> Iterator[dict[str, Any]]:
    result: dict[str, Any] = {}
    if not ENABLED:
        yield result
        return
    from langfuse import get_client

    with get_client().start_as_current_observation(name=name, as_type=as_type, model=model, input=describe(contents)) as observation:
        try:
            yield result
        except Exception as error:
            observation.update(level="ERROR", status_message=f"{type(error).__name__}: {str(error)[:300]}")
            raise
        usage = {key: result[field] for key, field in (("input", "input_tokens"), ("output", "output_tokens")) if result.get(field) is not None}
        observation.update(output=result.get("text"), usage_details=usage or None, metadata={"latency_ms": result.get("latency_ms")})


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
