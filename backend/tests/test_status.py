from fastapi.testclient import TestClient

from app import __version__
from app.api import main


def test_status_reports_capabilities_without_secrets(monkeypatch):
    monkeypatch.setattr(main, "GEMINI_API_KEY", "")
    monkeypatch.setattr(main, "QDRANT_URL", "https://example.qdrant.io")
    body = TestClient(main.app).get("/status").json()
    assert body == {
        "version": __version__,
        "ai": False,
        "vector_store": "local",
        "tracing": main.TRACING_ENABLED,
        "persistent_storage": main.is_postgres(),
    }


def test_status_reports_qdrant_when_ai_is_configured(monkeypatch):
    monkeypatch.setattr(main, "GEMINI_API_KEY", "set")
    monkeypatch.setattr(main, "QDRANT_URL", "https://example.qdrant.io")
    body = TestClient(main.app).get("/status").json()
    assert body["ai"] is True
    assert body["vector_store"] == "qdrant"


def test_public_base_url_prefers_explicit_setting(monkeypatch):
    from app.interop import public_base_url

    monkeypatch.setenv("VERCEL_PROJECT_PRODUCTION_URL", "old.vercel.app")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://imaarat-ai.vercel.app/api")
    assert public_base_url() == "https://imaarat-ai.vercel.app/api"
    monkeypatch.delenv("PUBLIC_BASE_URL")
    assert public_base_url() == "https://old.vercel.app/api"
