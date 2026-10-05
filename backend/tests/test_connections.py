from importlib import import_module
from importlib.util import find_spec
import os
from uuid import uuid4

import httpx2
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool

from app import auth


@pytest.fixture(params=["sqlite", "postgresql"])
def connections(request):
    assert find_spec("app.connections") is not None, "Vault connection lifecycle is missing"
    service = import_module("app.connections")
    vault_module = import_module("app.broker.vault")
    admin = None
    schema = "test_" + uuid4().hex
    if request.param == "postgresql":
        admin = create_engine(os.environ["IDENTITY_TEST_DATABASE_URL"])
        with admin.begin() as conn:
            conn.execute(text(f'CREATE SCHEMA "{schema}"'))
        engine = create_engine(os.environ["IDENTITY_TEST_DATABASE_URL"], connect_args={"options": f"-csearch_path={schema}"})
        import_module("app.migrations").apply_migrations(engine)
    else:
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
        if request.method == "GET":
            existing = versions.get(path.replace("/metadata/", "/data/"))
            if existing is None:
                return httpx2.Response(404)
            return httpx2.Response(200, json={"data": {"current_version": len(existing), "versions": {str(index + 1): {"destroyed": value is None} for index, value in enumerate(existing)}}})
        if request.method == "PUT":
            payload = json.loads(request.content)
            existing = versions[path.replace("/destroy/", "/data/")]
            for version in payload["versions"]:
                existing[version - 1] = None
            return httpx2.Response(204)
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
    if admin is not None:
        with admin.begin() as conn:
            conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()


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
    assert all(value is None for stored in versions.values() for value in stored)
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


def test_interrupted_cleanup(connections, monkeypatch):
    service, first, second, engine, versions, calls = connections
    created = service.create(first, "canary-key-do-not-leak", "gemini")
    write = service.vault.write

    def lost_response(*args):
        write(*args)
        raise HTTPException(503, "vault_unavailable")

    monkeypatch.setattr(service.vault, "write", lost_response)
    with pytest.raises(HTTPException):
        service.replace(first, created["id"], created["version"], "ambiguous-new-canary")
    current = service.list(first)[0]
    assert current["operation"] == "replace"
    assert service.delete(first, created["id"], current["version"])["state"] == "deleted"
    assert all(value is None for stored in versions.values() for value in stored)


def test_revoked_admission(connections):
    service, first, second, engine, versions, calls = connections
    auth.revoke_session(engine, first)
    with pytest.raises(HTTPException) as error:
        service.create(first, "never-store-this-canary", "gemini")
    assert error.value.status_code == 401
    assert versions == {}


def test_signed_broker_http(connections):
    import json
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from fastapi.testclient import TestClient
    from app.broker import envelope
    from app.broker.main import create_app

    service, first, second, engine, versions, calls = connections
    auth.metadata.create_all(engine)
    key = Ed25519PrivateKey.generate()
    body = json.dumps({"provider": "gemini", "credential": "test-only-canary-credential"}).encode()
    headers = envelope.sign(key, "api", "POST", "/connections", first.session_id, body)
    headers["Content-Type"] = "application/json"
    with TestClient(create_app(service, {"api": key.public_key()}), base_url="https://broker.test") as client:
        response = client.post("/connections", content=body, headers=headers)
        assert response.status_code == 201
        assert "test-only-canary-credential" not in response.text
        assert client.post("/connections", content=body, headers=headers).status_code == 401
        assert client.get("/connections").status_code == 401
        path = "/connections/invalid-canary-id/disable"
        headers = envelope.sign(key, "api", "POST", path, first.session_id, b'{"version":1}')
        response = client.post(path, content=b'{"version":1}', headers=headers)
        assert response.status_code == 422
        assert "invalid-canary" not in response.text


def test_late_create(connections, monkeypatch):
    service, first, second, engine, versions, calls = connections
    write = service.vault.write
    delayed = []

    def delayed_write(*args):
        delayed.append(args)
        raise HTTPException(503, "vault_unavailable")

    monkeypatch.setattr(service.vault, "write", delayed_write)
    with pytest.raises(HTTPException):
        service.create(first, "delayed-canary-credential", "gemini")
    current = service.list(first)[0]
    assert service.delete(first, current["id"], current["version"])["state"] == "deleted"
    with pytest.raises(HTTPException):
        write(*delayed[0])
    assert "delayed-canary" not in str(versions)


def test_replay_concurrency(connections):
    from concurrent.futures import ThreadPoolExecutor
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from sqlalchemy import insert, select
    from app.broker import envelope

    service, first, second, engine, versions, calls = connections
    if engine.dialect.name != "postgresql":
        pytest.skip("Concurrent admission requires the remote PostgreSQL service")
    now = auth.clock(None)
    key = Ed25519PrivateKey.generate()
    headers = envelope.sign(key, "api", "GET", "/connections", first.session_id, b"", now=now)
    with engine.begin() as conn:
        conn.execute(insert(envelope.nonces).values(id="expired", expires_at=now - 1))

    def attempt(value):
        try:
            envelope.verify(engine, {"api": key.public_key()}, headers, "GET", "/connections", b"", now=now)
            return 200
        except HTTPException as error:
            return error.status_code

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(attempt, range(8)))
    assert results.count(200) == 1
    assert results.count(401) == 7
    with engine.connect() as conn:
        assert conn.execute(select(envelope.nonces.c.id).where(envelope.nonces.c.id == "expired")).first() is None
    with pytest.raises(HTTPException):
        envelope.verify(engine, {"api": key.public_key()}, headers, "GET", "/connections", b"", now=now + 31)
    for value in range(29):
        fresh = envelope.sign(key, "api", "GET", "/connections", first.session_id, b"", now=now)
        envelope.verify(engine, {"api": key.public_key()}, fresh, "GET", "/connections", b"", now=now)
    fresh = envelope.sign(key, "api", "GET", "/connections", first.session_id, b"", now=now)
    with pytest.raises(HTTPException) as error:
        envelope.verify(engine, {"api": key.public_key()}, fresh, "GET", "/connections", b"", now=now)
    assert error.value.status_code == 429


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