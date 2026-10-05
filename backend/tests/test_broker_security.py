from importlib import import_module
from importlib.util import find_spec

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from app import auth


def test_signed_envelope():
    assert find_spec("app.broker") is not None, "Signed private broker requests are missing"
    envelope = import_module("app.broker.envelope")
    private = Ed25519PrivateKey.generate()
    engine = create_engine("sqlite://", poolclass=StaticPool)
    auth.metadata.create_all(engine)
    grant = auth.create_member(engine, 42, now=1000)
    body = b'{"provider":"gemini","credential":"test-only-canary"}'
    headers = envelope.sign(private, "api", "POST", "/connections", grant.principal.session_id, body, now=1001)
    principal = envelope.verify(engine, {"api": private.public_key()}, headers, "POST", "/connections", body, now=1002)
    assert principal.owner_id == grant.principal.owner_id
    assert "test-only-canary" not in str(headers)
    with pytest.raises(HTTPException):
        envelope.verify(engine, {"api": private.public_key()}, headers, "POST", "/connections", body, now=1002)
    for method, path, payload, when in (("DELETE", "/connections", body, 1002), ("POST", "/invoke", body, 1002), ("POST", "/connections", b"changed", 1002), ("POST", "/connections", body, 1100)):
        headers = envelope.sign(private, "api", method="POST", path="/connections", session_id=grant.principal.session_id, body=body, now=1001)
        with pytest.raises(HTTPException):
            envelope.verify(engine, {"api": private.public_key()}, headers, method, path, payload, now=when)
    engine.dispose()


def test_broker_http_boundary():
    from fastapi.testclient import TestClient
    from app.broker.main import create_app

    with TestClient(create_app(), base_url="https://broker.test") as client:
        response = client.post("/connections", json={"credential": "never-echo-this-canary"})
        assert response.status_code == 503
        assert "canary" not in response.text
        assert response.headers["cache-control"] == "no-store"