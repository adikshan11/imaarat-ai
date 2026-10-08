from urllib.parse import parse_qs, urlsplit

import pytest
from app import auth, db
from app.api import auth_routes, main
from fastapi import HTTPException
from fastapi.testclient import TestClient

ORIGIN = "https://imaarat.test"
REVIEW = {"final_decision": "Accept", "note": ""}


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "auth.db")
    monkeypatch.setattr(db, "PROPERTIES_CSV", tmp_path / "missing.csv")
    db.init_db()
    auth._ready_engines.clear()
    monkeypatch.setenv("PUBLIC_BASE_URL", ORIGIN)
    monkeypatch.setenv("OPERATOR_GITHUB_IDS", "7")
    return TestClient(main.app, base_url="https://testserver")


def signed_in(client, github_id):
    grant = auth.create_member(github_id)
    client.cookies.set(auth.SESSION_COOKIE, grant.token)
    return {"origin": ORIGIN, "x-csrf-token": grant.csrf_token}


def test_review_needs_a_signed_in_reviewer(client):
    assert client.post("/underwrite/history/1/review", json=REVIEW).status_code == 401
    member = signed_in(client, 42)
    assert client.post("/underwrite/history/1/review", json=REVIEW, headers=member).status_code == 403


def test_operator_passes_the_check_but_needs_csrf_and_origin(client):
    operator = signed_in(client, 7)
    assert client.post("/underwrite/history/999999/review", json=REVIEW, headers={**operator, "x-csrf-token": "0" * 64}).status_code == 403
    assert client.post("/underwrite/history/999999/review", json=REVIEW, headers={**operator, "origin": "https://evil.test"}).status_code == 403
    assert client.post("/underwrite/history/999999/review", json=REVIEW, headers=operator).status_code == 404


def test_github_sign_in_round_trip(client, monkeypatch):
    monkeypatch.setenv("GITHUB_CLIENT_ID", "client")
    monkeypatch.setenv("GITHUB_CLIENT_SECRET", "secret")
    monkeypatch.setattr(auth_routes, "github_identity", lambda transaction, code: {"id": 7, "login": "octocat"})
    start = client.post("/auth/github/start", headers={"origin": ORIGIN})
    url = start.json()["authorization_url"]
    query = parse_qs(urlsplit(url).query, keep_blank_values=True)
    assert url.startswith("https://github.com/login/oauth/authorize") and query["code_challenge_method"] == ["S256"] and query["scope"] == [""]
    wrong_issuer = client.get("/auth/github/callback", params={"code": "abc", "state": query["state"][0], "iss": "https://evil.test"}, follow_redirects=False)
    assert wrong_issuer.status_code == 400
    start = client.post("/auth/github/start", headers={"origin": ORIGIN})
    query = parse_qs(urlsplit(start.json()["authorization_url"]).query, keep_blank_values=True)
    callback = client.get("/auth/github/callback", params={"code": "abc", "state": query["state"][0], "iss": "https://github.com/login/oauth"}, follow_redirects=False)
    assert callback.status_code == 303 and callback.headers["location"] == ORIGIN + "/app/"
    session = client.get("/auth/session").json()
    assert session["role"] == "operator" and session["name"] == "octocat" and len(session["csrf_token"]) == 64
    replay = client.get("/auth/github/callback", params={"code": "abc", "state": query["state"][0]}, follow_redirects=False)
    assert replay.status_code == 400


def test_sign_in_is_off_until_configured(client, monkeypatch):
    monkeypatch.delenv("GITHUB_CLIENT_ID", raising=False)
    assert client.post("/auth/github/start", headers={"origin": ORIGIN}).status_code == 503


def test_providers_list_only_configured_sign_in(client, monkeypatch):
    monkeypatch.setenv("GITHUB_CLIENT_ID", "client")
    monkeypatch.setenv("GITHUB_CLIENT_SECRET", "secret")
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    assert client.get("/auth/providers").json() == {"github": True, "google": False}


def test_google_sign_in_round_trip(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "secret")
    monkeypatch.setattr(auth_routes, "google_identity", lambda transaction, code: {"sub": "1234567890"})
    url = client.post("/auth/google/start", headers={"origin": ORIGIN}).json()["authorization_url"]
    query = parse_qs(urlsplit(url).query)
    assert url.startswith("https://accounts.google.com/o/oauth2/v2/auth") and query["scope"] == ["openid"] and query["code_challenge_method"] == ["S256"]
    wrong_issuer = client.get("/auth/google/callback", params={"code": "abc", "state": query["state"][0], "iss": "https://evil.test"}, follow_redirects=False)
    assert wrong_issuer.status_code == 400
    callback = client.get("/auth/google/callback", params={"code": "abc", "state": query["state"][0], "scope": "openid", "iss": "https://accounts.google.com"}, follow_redirects=False)
    assert callback.status_code == 303 and callback.headers["location"] == ORIGIN + "/app/"
    session = client.get("/auth/session").json()
    assert session["role"] == "member" and session["github_id"] is None


def test_google_cancel_returns_to_sign_in(client):
    response = client.get("/auth/google/callback", params={"error": "access_denied"}, follow_redirects=False)
    assert response.status_code == 303 and response.headers["location"] == ORIGIN + "/app/#signin"


def test_idle_sessions_expire(client):
    grant = auth.create_member(42, now=1_000_000)
    assert auth.resolve_session(grant.token, now=1_000_000 + 60).role == "member"
    with pytest.raises(HTTPException):
        auth.resolve_session(grant.token, now=1_000_000 + 60 + auth.IDLE_SECONDS)


def test_logout_revokes_the_session_on_the_server(client):
    headers = signed_in(client, 42)
    token = client.cookies.get(auth.SESSION_COOKIE)
    assert client.post("/auth/logout", headers=headers).status_code == 204
    client.cookies.set(auth.SESSION_COOKIE, token)
    assert client.get("/auth/session").status_code == 401


def test_origin_ignores_the_api_path_in_the_base_url(monkeypatch):
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://imaarat-ai.vercel.app/api")
    assert auth.app_origin() == "https://imaarat-ai.vercel.app"
    monkeypatch.setenv("PUBLIC_BASE_URL", "")
    assert auth.app_origin() == ""
