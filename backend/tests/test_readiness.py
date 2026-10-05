from importlib.util import find_spec

import pytest
from fastapi.testclient import TestClient

from app.api import main


def test_settings_contract():
    assert find_spec("app.settings") is not None


def test_storage_required(monkeypatch):
    from app.settings import SettingsError, load_settings

    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL_FILE", raising=False)
    monkeypatch.setenv("APP_ORIGIN", "https://example.test")
    with pytest.raises(SettingsError, match="database_required"):
        load_settings("production")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///temporary.db")
    with pytest.raises(SettingsError, match="postgres_required"):
        load_settings("production")


def test_origin_required(monkeypatch):
    from app.settings import SettingsError, load_settings

    monkeypatch.setenv("DATABASE_URL", "postgresql://test:test@db/imaarat")
    for origin in ("http://example.test", "https://user:password@example.test", "https://example.test/path", "https://example.test/?token=secret"):
        monkeypatch.setenv("APP_ORIGIN", origin)
        with pytest.raises(SettingsError, match="origin_invalid"):
            load_settings("production")


def test_settings_immutable(monkeypatch):
    from dataclasses import FrozenInstanceError

    from app.settings import SettingsError, load_settings

    monkeypatch.setenv("DATABASE_URL", "postgresql://test:test@db/imaarat")
    monkeypatch.setenv("APP_ORIGIN", "https://example.test")
    settings = load_settings("production")
    with pytest.raises(FrozenInstanceError):
        settings.environment = "test"
    assert "test:test" not in repr(settings)
    with pytest.raises(SettingsError, match="environment_invalid"):
        load_settings("unknown")


def test_readiness_requires_checks(monkeypatch):
    from app.settings import load_settings, readiness

    monkeypatch.setenv("DATABASE_URL", "postgresql://test:test@db/imaarat")
    monkeypatch.setenv("APP_ORIGIN", "https://example.test")
    monkeypatch.setenv("BROKER_URL", "https://broker.internal")
    monkeypatch.setenv("QDRANT_URL", "https://qdrant.internal")
    monkeypatch.setenv("DEMO_GENERATION_MODEL", "configured")
    monkeypatch.setenv("DEMO_VISION_MODEL", "configured")
    monkeypatch.setenv("DEMO_EMBEDDING_MODEL", "configured")
    settings = load_settings("production")
    body = readiness(settings)
    assert body["ready"] is False
    assert body["ai"] is False
    assert body["persistent_storage"] is False
    assert body["vector_store"] == "unavailable"
    assert "broker.internal" not in str(body)
    assert "test:test" not in str(body)
    checks = {name: True for name in ("database", "migrations", "worker", "broker", "vault", "generation", "vision", "embedding", "index", "security")}
    assert readiness(settings, checks)["ready"] is True
    checks["security"] = False
    assert readiness(settings, checks)["ready"] is False


def test_public_status_unavailable(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL_FILE", raising=False)
    monkeypatch.setattr(main, "GEMINI_API_KEY", "canary-secret")
    client = TestClient(main.app)
    body = client.get("/status").json()
    assert body["ai"] is False
    assert body["ready"] is False
    assert body["vector_store"] == "unavailable"
    assert "canary-secret" not in str(body)
    assert client.get("/ready").status_code == 503
    assert client.get("/health").json() == {"status": "ok"}


def test_unready_blocks_execution(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL_FILE", raising=False)
    client = TestClient(main.app)
    for method, path in (("POST", "/underwrite/submit"), ("GET", "/underwrite/history"), ("POST", "/mcp"), ("POST", "/")):
        response = client.request(method, path)
        assert response.status_code == 503
        assert response.json()["detail"] == "application_not_ready"
        assert response.headers["cache-control"] == "no-store"


def test_lifespan_never_seeds(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL_FILE", raising=False)
    calls = []

    def seed():
        calls.append("seed")

    monkeypatch.setattr(main, "seed_demo_database", seed)
    monkeypatch.setattr(main, "init_db", seed)
    with TestClient(main.app) as client:
        assert client.get("/health").status_code == 200
    assert calls == []


def test_secret_file_errors_safe(tmp_path, monkeypatch):
    from app.settings import SettingsError, load_settings

    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("DATABASE_URL_FILE", str(tmp_path / "absent-secret"))
    monkeypatch.setenv("APP_ORIGIN", "https://example.test")
    with pytest.raises(SettingsError, match="database_secret_unavailable") as error:
        load_settings("production")
    assert str(tmp_path) not in str(error.value)


def test_database_no_fallback(tmp_path, monkeypatch):
    from app import db
    from app.settings import SettingsError

    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL_FILE", raising=False)
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "unexpected" / "database.db")
    with pytest.raises(SettingsError, match="database_required"):
        db.get_engine()
    assert not (tmp_path / "unexpected").exists()


def test_database_file_setting(tmp_path, monkeypatch):
    from app import db

    filename = tmp_path / "database-secret"
    filename.write_text("postgresql://canary:password@db/imaarat\n", encoding="utf-8")
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("DATABASE_URL_FILE", str(filename))
    monkeypatch.setenv("APP_ORIGIN", "https://example.test")
    assert db.database_url() == "postgresql+psycopg://canary:password@db/imaarat"


def test_api_errors_redacted(monkeypatch):
    from app.api.errors import internal_error
    from starlette.requests import Request
    import asyncio

    response = asyncio.run(internal_error(Request({"type": "http", "headers": []}), RuntimeError("credential-canary")))
    assert response.status_code == 500
    assert b"credential-canary" not in response.body
    assert response.headers["cache-control"] == "no-store"


def test_startup_requires_explicit_migrations(tmp_path, monkeypatch):
    from app import db
    from app.settings import SettingsError

    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DATABASE_URL", "postgresql://test:test@db/imaarat")
    monkeypatch.setenv("APP_ORIGIN", "https://example.test")
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "unexpected.db")
    with pytest.raises(SettingsError, match="explicit_migration_required"):
        db.init_db()
    with pytest.raises(SettingsError, match="explicit_seed_required"):
        db.seed_demo_database()
    assert not (tmp_path / "unexpected.db").exists()


def test_invalid_dependency_urls(monkeypatch):
    from app.settings import SettingsError, load_settings

    monkeypatch.setenv("DATABASE_URL", "postgresql://test:test@db/imaarat")
    monkeypatch.setenv("APP_ORIGIN", "https://example.test")
    for setting in ("BROKER_URL", "QDRANT_URL"):
        for url in ("http://public.example.test", "https://user:secret@internal", "https://internal/?token=secret", "file:///tmp/key"):
            monkeypatch.setenv(setting, url)
            with pytest.raises(SettingsError, match="dependency_url_invalid"):
                load_settings("production")
        monkeypatch.delenv(setting)


def test_local_limits_bounded(monkeypatch):
    from app.settings import SettingsError, load_settings

    monkeypatch.setenv("DATABASE_URL", "postgresql://test:test@db/imaarat")
    monkeypatch.setenv("APP_ORIGIN", "https://example.test")
    assert load_settings("production").local_parallel_requests == 1
    assert load_settings("production").local_context_tokens == 4096
    monkeypatch.setenv("LOCAL_CONTEXT_TOKENS", "8192")
    assert load_settings("production").local_context_tokens == 8192
    for value in ("0", "-1", "unlimited", "131072"):
        monkeypatch.setenv("LOCAL_CONTEXT_TOKENS", value)
        with pytest.raises(SettingsError, match="local_context_invalid"):
            load_settings("production")