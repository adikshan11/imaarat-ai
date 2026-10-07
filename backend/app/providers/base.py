"""The contract every AI provider adapter implements. Nothing outside app/providers/ imports a vendor SDK."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Protocol

from pydantic import BaseModel

EmbedTask = Literal["document", "query"]


@dataclass(frozen=True)
class ImageInput:
    data: bytes = field(repr=False)
    mime_type: str


Content = str | ImageInput


@dataclass(frozen=True)
class Reply:
    text: str
    input_tokens: int | None = None
    output_tokens: int | None = None
    thought_tokens: int | None = None


class ProviderError(Exception):
    """A provider failure in one shape: an HTTP-style code for retry decisions, and whether a daily quota is spent."""

    def __init__(self, message: str, code: int | None = None, daily_quota: bool = False):
        super().__init__(message)
        self.code = code
        self.daily_quota = daily_quota


class Provider(Protocol):
    name: str

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
    ) -> Reply: ...

    def count_tokens(self, model: str, text: str) -> int: ...

    def embed(self, model: str, texts: list[str], task: EmbedTask) -> list[list[float]]: ...
