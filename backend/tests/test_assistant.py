import json

import pytest
from app import assistant, budget, config, db, llm
from app.api import main
from fastapi.testclient import TestClient


@pytest.fixture
def store(tmp_path, monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("VERCEL", raising=False)
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "chat.db")
    monkeypatch.setattr(budget, "ai_ready", lambda: (True, None))
    monkeypatch.setattr(assistant, "retrieve", lambda message, k=4: [{"id": "G1", "title": "Flood", "text": "Check the flood zone."}])
    db.metadata.create_all(db.get_engine())


def reply(page="none", language="none"):
    return lambda name, contents, schema=None, system=None: {"text": json.dumps({"reply": "Opening it.", "page": page, "language": language})}


def test_chat_returns_page_language_and_sources(store, monkeypatch):
    monkeypatch.setattr(llm, "generate", reply("new", "hi"))
    result = assistant.chat("open the new assessment form in Hindi", "en", [], "1.2.3.4")
    assert result["code"] == "ok" and result["page"] == "new" and result["language"] == "hi"
    assert result["sources"] == [{"id": "G1", "title": "Flood"}]


def test_chat_ignores_unknown_language_and_none_page(store, monkeypatch):
    monkeypatch.setattr(llm, "generate", reply("none", "xx"))
    result = assistant.chat("hello", "en", [], "1.2.3.4")
    assert result["page"] is None and result["language"] is None


def test_chat_stops_at_the_visitor_limit(store, monkeypatch):
    monkeypatch.setattr(llm, "generate", reply())
    monkeypatch.setattr(config, "AI_CLIENT_DAILY_CHAT", 1)
    assert assistant.chat("one", "en", [], "1.2.3.4")["code"] == "ok"
    assert assistant.chat("two", "en", [], "1.2.3.4")["code"] == "limit"


def test_chat_is_offline_without_ai(store, monkeypatch):
    monkeypatch.setattr(budget, "ai_ready", lambda: (False, "off"))
    assert assistant.chat("hello", "en", [], None)["code"] == "offline"


def test_chat_endpoint_rejects_an_empty_message(store):
    assert TestClient(main.app).post("/assistant/chat", json={"message": ""}).status_code == 422
