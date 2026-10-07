"""AI providers. Pick one with AI_PROVIDER; add one by writing an adapter that follows base.Provider and listing it here."""

from __future__ import annotations

from importlib import import_module

from app import config
from app.providers.base import EmbedTask, ImageInput, Provider, ProviderError, Reply

ADAPTERS = {
    "gemini": "app.providers.gemini:GeminiProvider",
}


def get_provider() -> Provider:
    target = ADAPTERS.get(config.AI_PROVIDER)
    if target is None:
        raise ProviderError(f"Unknown AI_PROVIDER '{config.AI_PROVIDER}'. Known providers: {', '.join(sorted(ADAPTERS))}.")
    module, name = target.split(":")
    return getattr(import_module(module), name)()


__all__ = ["EmbedTask", "ImageInput", "Provider", "ProviderError", "Reply", "get_provider"]
