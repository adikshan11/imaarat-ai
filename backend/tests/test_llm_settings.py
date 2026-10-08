from types import SimpleNamespace
from unittest.mock import Mock

from app import budget, llm
from app.providers import gemini
from google.genai import errors


def fake_client(monkeypatch):
    client = Mock()
    client.models.generate_content.return_value = SimpleNamespace(text="{}", usage_metadata=SimpleNamespace(prompt_token_count=900, candidates_token_count=100, thoughts_token_count=400))

    def make(api_key, **kwargs):
        return client

    monkeypatch.setattr(gemini.genai, "Client", make)
    return client


def test_extraction_stages_think_low_and_thinking_is_billed(monkeypatch):
    client = fake_client(monkeypatch)
    result = llm.generate("paper_form", ["read"])
    assert client.models.generate_content.call_args.kwargs["config"].thinking_config.thinking_level == "LOW"
    assert (result["output_tokens"], result["thought_tokens"]) == (500, 400)
    assert budget.remaining()["tokens_today"] == {"input": 900, "output": 500}


def test_the_memo_keeps_the_model_default_thinking(monkeypatch):
    client = fake_client(monkeypatch)
    llm.generate("memo", ["write"])
    assert client.models.generate_content.call_args.kwargs["config"].thinking_config is None


def test_a_busy_model_falls_back_once(monkeypatch):
    client = fake_client(monkeypatch)
    busy = errors.ServerError(503, {"error": {"code": 503, "message": "high demand", "status": "UNAVAILABLE"}})
    client.models.generate_content.side_effect = [busy, busy, client.models.generate_content.return_value]
    monkeypatch.setattr(llm, "sleep", [].append)
    result = llm.generate("memo", ["write"])
    models = [call.kwargs["model"] for call in client.models.generate_content.call_args_list]
    assert models == [llm.config.AI_MODEL, llm.config.AI_MODEL, llm.config.AI_FALLBACK_MODEL]
    assert result["model"] == llm.config.AI_FALLBACK_MODEL


def test_failures_are_explained_the_same_way_for_every_provider():
    from app.providers import ProviderError

    assert llm.failure_reason(budget.BudgetExceeded("this minute", 30)).startswith("This demo's AI is at its per-minute limit")
    assert llm.failure_reason(budget.BudgetExceeded("AI generations", 3600)).startswith("This demo has used today's AI allowance")
    assert llm.failure_reason(ProviderError("quota", code=429, daily_quota=True)).startswith("This demo has used today's AI allowance")
    for busy in (ProviderError("high demand", code=503), ProviderError("deadline", code=504), TimeoutError("slow")):
        assert llm.failure_reason(busy).startswith("The AI model is busy")
    assert llm.failure_reason(ValueError("bad")) == "The AI model returned an error (ValueError)."
