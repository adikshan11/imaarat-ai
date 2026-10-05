from importlib import import_module
from importlib.util import find_spec
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.pool import StaticPool

from app import auth


@pytest.fixture
def browser(monkeypatch):
    assert find_spec("app.api.auth_routes") is not None, "Secure identity routes are missing"
    routes = import_module("app.api.auth_routes")
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    auth.metadata.create_all(engine)

    def storage():
        return engine

    monkeypatch.setattr(auth, "get_engine", storage)
    monkeypatch.setattr(routes, "get_engine", storage)
    monkeypatch.setenv("APP_ORIGIN", "https://example.test")
    monkeypatch.setenv("GITHUB_CLIENT_ID", "isolated-test-client")
    monkeypatch.setenv("GITHUB_CLIENT_SECRET", "isolated-test-only")
    app = FastAPI()
    app.include_router(routes.router)
    with TestClient(app, base_url="https://example.test") as client:
        yield client, routes, engine
    engine.dispose()


def test_guest_cookie(browser):
    client, routes, engine = browser
    assert client.post("/auth/guest").status_code == 403
    response = client.post("/auth/guest", headers={"Origin": "https://example.test"})
    assert response.status_code == 201
    cookie = response.headers["set-cookie"]
    for flag in ("__Host-imaarat_session=", "HttpOnly", "Secure", "Path=/", "SameSite=lax"):
        assert flag in cookie
    assert "Domain=" not in cookie
    assert response.headers["cache-control"] == "no-store"
    assert "token" not in response.json()
    session = client.get("/auth/session")
    assert session.status_code == 200
    assert session.json()["csrf_token"] == response.json()["csrf_token"]
    assert client.post("/auth/guest", headers={"Origin": "https://example.test"}).status_code == 409


def test_logout_cookie(browser):
    client, routes, engine = browser
    grant = client.post("/auth/guest", headers={"Origin": "https://example.test"}).json()
    assert client.post("/auth/logout", headers={"Origin": "https://example.test"}).status_code == 403
    response = client.post("/auth/logout", headers={"Origin": "https://example.test", "X-CSRF-Token": grant["csrf_token"]})
    assert response.status_code == 204
    assert "Max-Age=0" in response.headers["set-cookie"]
    assert client.get("/auth/session").status_code == 401


def test_oauth_rotation(browser, monkeypatch):
    client, routes, engine = browser
    guest = client.post("/auth/guest", headers={"Origin": "https://example.test"}).json()
    old_token = client.cookies.get("__Host-imaarat_session")
    start = client.post("/auth/github/start", headers={"Origin": "https://example.test", "X-CSRF-Token": guest["csrf_token"]})
    assert start.status_code == 200
    query = parse_qs(urlsplit(start.json()["authorization_url"]).query, keep_blank_values=True)
    assert query["scope"] == [""]
    assert query["code_challenge_method"] == ["S256"]
    assert query["redirect_uri"] == ["https://example.test/api/auth/github/callback"]

    def github_identity(transaction, code):
        assert code == "one-use-test-code"
        assert len(transaction["code_verifier"]) >= 43
        return 42

    monkeypatch.setattr(routes, "github_identity", github_identity)
    callback = "/auth/github/callback?state=" + query["state"][0] + "&code=one-use-test-code"
    response = client.get(callback, follow_redirects=False)
    assert response.status_code == 303
    assert response.headers["location"] == "https://example.test/"
    assert client.cookies.get("__Host-imaarat_session") != old_token
    assert client.get("/auth/session").json()["role"] == "member"
    with pytest.raises(HTTPException) as error:
        auth.resolve_session(engine, old_token)
    assert error.value.status_code == 401
    assert client.get(callback, follow_redirects=False).status_code == 400
    with engine.connect() as conn:
        assert len(conn.execute(select(auth.users)).all()) == 2


def test_oauth_no_secrets(browser, monkeypatch):
    client, routes, engine = browser
    monkeypatch.delenv("GITHUB_CLIENT_SECRET")
    response = client.post("/auth/github/start", headers={"Origin": "https://example.test"})
    assert response.status_code == 503
    assert "isolated-test" not in response.text


def test_oauth_exchange(browser, monkeypatch):
    client, routes, engine = browser
    import httpx2
    from authlib.integrations.httpx_client import OAuth2Client

    calls = []

    def transport(request):
        calls.append(str(request.url))
        if request.url.path == "/login/oauth/access_token":
            body = parse_qs(request.content.decode())
            assert body["code_verifier"] == ["v" * 64]
            assert body["client_secret"] == ["isolated-test-only"]
            return httpx2.Response(200, json={"access_token": "transient-test-only", "token_type": "bearer", "scope": ""})
        assert request.headers["authorization"] == "Bearer transient-test-only"
        return httpx2.Response(200, json={"id": 42})

    def oauth_client(**kwargs):
        return OAuth2Client(transport=httpx2.MockTransport(transport), **kwargs)

    monkeypatch.setattr(routes, "oauth_client", oauth_client)
    transaction = {"callback": "https://example.test/api/auth/github/callback", "code_verifier": "v" * 64}
    assert routes.github_identity(transaction, "test-code") == 42
    assert calls == ["https://github.com/login/oauth/access_token", "https://api.github.com/user"]