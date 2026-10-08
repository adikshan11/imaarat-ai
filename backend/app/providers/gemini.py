"""Google Gemini adapter (google-genai SDK)."""

from __future__ import annotations

from typing import Any

from google import genai
from google.genai import errors, types
from pydantic import BaseModel

from app import config
from app.providers.base import Content, EmbedTask, ImageInput, ProviderError, Reply

TASKS = {"document": "RETRIEVAL_DOCUMENT", "query": "RETRIEVAL_QUERY"}


def count(usage: Any, name: str) -> int | None:
    value = getattr(usage, name, None)
    return value if isinstance(value, int) else None


class GeminiProvider:
    name = "gemini"

    def __init__(self) -> None:
        self.client = genai.Client(
            api_key=config.AI_API_KEY,
            http_options=types.HttpOptions(timeout=config.AI_TIMEOUT_MS, retry_options=types.HttpRetryOptions(attempts=1)),
        )

    def call(self, method: Any, **arguments: Any) -> Any:
        try:
            return method(**arguments)
        except errors.APIError as error:
            raise ProviderError(str(error), code=error.code, daily_quota="PerDay" in str(error)) from error

    def generate(
        self,
        model: str,
        contents: list[Content],
        *,
        system: str | None,
        schema: type[BaseModel] | None,
        thinking: str | None,
        temperature: float,
        max_output_tokens: int,
        timeout_ms: int | None = None,
    ) -> Reply:
        parts = [types.Part.from_bytes(data=item.data, mime_type=item.mime_type) if isinstance(item, ImageInput) else item for item in contents]
        settings = types.GenerateContentConfig(
            system_instruction=system,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            response_mime_type="application/json" if schema else None,
            response_schema=schema,
            thinking_config=types.ThinkingConfig(thinking_level=thinking) if thinking else None,
            http_options=types.HttpOptions(timeout=timeout_ms) if timeout_ms else None,
        )
        response = self.call(self.client.models.generate_content, model=model, contents=parts, config=settings)
        usage = getattr(response, "usage_metadata", None)
        answer = count(usage, "candidates_token_count")
        thoughts = count(usage, "thoughts_token_count")
        return Reply(
            text=getattr(response, "text", None) or "",
            input_tokens=count(usage, "prompt_token_count"),
            output_tokens=None if answer is None else answer + (thoughts or 0),
            thought_tokens=thoughts,
        )

    def count_tokens(self, model: str, text: str) -> int:
        return self.call(self.client.models.count_tokens, model=model, contents=text).total_tokens

    def embed(self, model: str, texts: list[str], task: EmbedTask) -> list[list[float]]:
        response = self.call(self.client.models.embed_content, model=model, contents=texts, config=types.EmbedContentConfig(task_type=TASKS[task]))
        return [list(item.values) for item in response.embeddings]
