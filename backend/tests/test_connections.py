from importlib import import_module
from importlib.util import find_spec

import httpx2
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool

from app import auth


@pytest.fixture
def connections():
    assert find_spec("app.connections") is not None, "Vault connection lifecycle is missing"
    service = import_module("app.connections")
    vault_module = import_module("app.broker.vault")
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    auth.metadata.create_all(engine)
    versions = {}
    calls = []

    def transport(request):
        import json

        calls.append((request.method, request.url.path))
        if request.url.path == "/v1/auth/approle/login":
            return httpx2.Response(200, json={"auth": {"client_token": "isolated-test-token", "lease_duration": 600, "renewable": True, "policies": ["imaarat-broker"]}})
        assert request.headers["x-vault-token"] == "isolated-test-token"
        path = request.url.path
        if request.method == "POST":
            payload = json.loads(request.content)
            existing = versions.get(path, [])
            if payload["options"]["cas"] != len(existing):
                return httpx2.Response(400, json={"errors": ["canary-key-do-not-leak"]})
            existing.append(payload["data"])
            versions[path] = existing
            return httpx2.Response(200, json={"data": {"version": len(existing)}})
        if request.method == "DELETE":
            versions.pop(path.replace("/metadata/", "/data/"), None)
            return httpx2.Response(204)
        return httpx2.Response(503, json={"errors": ["canary-key-do-not-leak"]})

    vault = vault_module.VaultClient("https://bao.test", "isolated-role", "isolated-secret-id", transport=httpx2.MockTransport(transport))
    first = auth.create_member(engine, 42)
    second = auth.create_member(engine, 43)
    yield service.ConnectionService(engine, vault), first.principal, second.principal, engine, versions, calls
    vault.close()
    engine.dispose()


def test_connection_metadata(connections):
    service, first, second, engine, versions, calls = connections
    created = service.create(first, "canary-key-do-not-leak", "gemini")
    assert created["state"] == "unverified"
    assert created["secret_version"] == 1
    assert created["suffix"] == "leak"
    assert "canary-key-do-not-leak" not in str(created)
    assert "canary-key-do-not-leak" not in str(service.list(first))
    assert service.list(second) == []
    assert list(versions)[0].endswith("/owners/" + first.owner_id + "/connections/" + created["id"])
    with engine.connect() as conn:
        assert "canary-key-do-not-leak" not in str(conn.execute(text("SELECT * FROM connections")).all())
    with pytest.raises(HTTPException) as error:
        service.disable(second, created["id"], created["version"])
    assert error.value.status_code == 404


def test_replace_staged(connections):
    service, first, second, engine, versions, calls = connections
    created = service.create(first, "canary-key-do-not-leak", "gemini")
    staged = service.replace(first, created["id"], created["version"], "new-canary-secret-only")
    assert staged["secret_version"] == 1
    assert staged["pending_version"] == 2
    assert staged["version"] == created["version"] + 1
    with pytest.raises(HTTPException) as error:
        service.replace(first, created["id"], created["version"], "stale-secret-not-written")
    assert error.value.status_code == 409
    assert len(list(versions.values())[0]) == 2


def test_disable_destroy(connections):
    service, first, second, engine, versions, calls = connections
    created = service.create(first, "canary-key-do-not-leak", "gemini")
    disabled = service.disable(first, created["id"], created["version"])
    assert disabled["state"] == "disabled"
    with pytest.raises(HTTPException):
        service.replace(first, created["id"], disabled["version"], "never-store-this-value")
    deleted = service.delete(first, created["id"], disabled["version"])
    assert deleted["state"] == "deleted"
    assert versions == {}
    assert service.list(first) == []


def test_vault_denial(connections, monkeypatch):
    service, first, second, engine, versions, calls = connections
    created = service.create(first, "canary-key-do-not-leak", "gemini")

    def sealed(*args, **kwargs):
        raise HTTPException(503, "vault_unavailable")

    monkeypatch.setattr(service.vault, "write", sealed)
    with pytest.raises(HTTPException) as error:
        service.replace(first, created["id"], created["version"], "new-canary-secret-only")
    assert "canary" not in str(error.value)
    current = service.list(first)[0]
    assert current["secret_version"] == 1
    assert current["pending_version"] is None
    assert current["operation"] == "replace"


def test_vault_errors():
    assert find_spec("app.broker") is not None, "Private credential broker is missing"
    module = import_module("app.broker.vault")

    def sealed(request):
        return httpx2.Response(503, json={"errors": ["canary-secret-do-not-log"]})

    vault = module.VaultClient("https://bao.test", "test-role", "test-secret-id", transport=httpx2.MockTransport(sealed))
    with pytest.raises(HTTPException) as error:
        vault.write("00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002", "canary-secret-do-not-log", 0)
    assert error.value.detail == "vault_unavailable"
    assert "canary" not in str(error.value)
    vault.close()