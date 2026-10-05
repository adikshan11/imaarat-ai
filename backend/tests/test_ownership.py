from contextlib import asynccontextmanager
from importlib import import_module
from importlib.util import find_spec

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool

from app import auth, db


@pytest.fixture
def owners(monkeypatch):
    from app.api import main

    @asynccontextmanager
    async def lifespan(app):
        yield

    monkeypatch.setattr(main.app.router, "lifespan_context", lifespan)
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    auth.metadata.create_all(engine)
    db.metadata.create_all(engine)
    with engine.begin() as conn:
        for ddl in ("owner_id TEXT", "data_class TEXT DEFAULT 'quarantined'", "record_version INTEGER DEFAULT 1", "deleted_at TEXT"):
            conn.execute(text("ALTER TABLE submissions ADD COLUMN " + ddl))

    def storage():
        return engine

    monkeypatch.setattr(auth, "get_engine", storage)
    monkeypatch.setattr(db, "get_engine", storage)
    first = auth.create_member(engine, 42)
    second = auth.create_member(engine, 43)
    yield engine, first, second
    engine.dispose()


def test_rest_isolation(owners, monkeypatch):
    engine, first, second = owners
    from app.api import main

    saved = db.save_owned_submission(first.principal, {"property_id": "owned", "raw_input": {}, "decision": "Accept", "risk_score": 5})
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("APP_ORIGIN", "https://example.test")

    def ready():
        return {"ready": True}

    monkeypatch.setattr(main, "runtime_readiness", ready)
    with TestClient(main.app, base_url="https://example.test") as client:
        assert client.get("/underwrite/history").status_code == 401
        client.cookies.set("__Host-imaarat_session", second.token)
        assert client.get("/underwrite/history").json() == []
        for suffix in ("", "/report.pdf"):
            assert client.get(f"/underwrite/history/{saved['id']}" + suffix).status_code == 404
        client.cookies.set("__Host-imaarat_session", first.token)
        response = client.get(f"/underwrite/history/{saved['id']}")
        assert response.status_code == 200
        assert response.headers["cache-control"] == "no-store"
        assert client.get("/underwrite/history?limit=101").status_code == 422
        assert client.post(f"/underwrite/history/{saved['id']}/review", json={"final_decision": "Accept", "reviewer": "operator"}).status_code == 403


def test_interop_isolation(owners, monkeypatch):
    assert find_spec("app.policy") is not None, "Shared authorization policy is missing"
    policy = import_module("app.policy")
    from app import interop

    engine, first, second = owners
    auth.metadata.create_all(engine)
    saved = db.save_owned_submission(first.principal, {"property_id": "owned", "raw_input": {}, "decision": "Accept", "risk_score": 5})
    with pytest.raises(HTTPException):
        interop.get_assessment(saved["id"])
    token = policy.issue_token(engine, first.principal, {"interop:read"})
    principal = policy.resolve_token(engine, token.token)
    with policy.principal_context(principal):
        assert interop.get_assessment(saved["id"])["id"] == saved["id"]
        with pytest.raises(HTTPException):
            interop.assess_property("Frame", "Warehouse", "Flood")
    other = policy.resolve_token(engine, policy.issue_token(engine, second.principal, {"interop:read"}).token)
    with policy.principal_context(other):
        assert interop.list_assessments() == []
        with pytest.raises(HTTPException) as error:
            interop.get_assessment(saved["id"])
        assert error.value.status_code == 404


def test_token_boundaries(owners):
    assert find_spec("app.policy") is not None, "Scoped transport tokens are missing"
    policy = import_module("app.policy")
    engine, first, second = owners
    auth.metadata.create_all(engine)
    grant = policy.issue_token(engine, first.principal, {"interop:read"}, now=auth.clock(None))
    assert grant.token not in repr(grant)
    with engine.connect() as conn:
        assert grant.token not in str(conn.execute(text("SELECT * FROM interop_tokens")).all())
    policy.revoke_token(engine, second.principal, grant.id)
    assert policy.resolve_token(engine, grant.token).owner_id == first.principal.owner_id
    policy.revoke_token(engine, first.principal, grant.id)
    with pytest.raises(HTTPException):
        policy.resolve_token(engine, grant.token)
    with pytest.raises(HTTPException):
        policy.issue_token(engine, first.principal, {"operator:all"})
    guest = auth.create_guest(engine)
    with pytest.raises(HTTPException):
        policy.issue_token(engine, guest.principal, {"interop:read"})


def test_transport_denial(owners, monkeypatch):
    from app.api import main

    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("APP_ORIGIN", "https://example.test")

    def ready():
        return {"ready": True}

    monkeypatch.setattr(main, "runtime_readiness", ready)
    with TestClient(main.app, base_url="https://example.test") as client:
        for path in ("/mcp/", "/a2a"):
            assert client.post(path, json={"jsonrpc": "2.0", "method": "tasks/get", "id": 1, "params": {"id": "other-task"}}).status_code == 401
        client.cookies.set("__Host-imaarat_session", owners[1].token)
        assert client.post("/a2a", json={"jsonrpc": "2.0", "method": "tasks/get", "id": 1}).status_code == 401