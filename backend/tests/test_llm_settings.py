from types import SimpleNamespace
from unittest.mock import Mock

from app import budget, llm
from app.providers import gemini


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
