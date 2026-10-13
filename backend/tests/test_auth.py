from io import BytesIO
from urllib.parse import parse_qs, urlsplit

import pytest
from app import auth, db, dev_console, observability, partners, profile
from app.api import auth_routes, main
from fastapi import HTTPException
from fastapi.testclient import TestClient
from PIL import Image

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


def signed_in(client, github_id, complete=True):
    grant = auth.create_member(github_id)
    if complete:
        profile.save(grant.principal.owner_id, "Asha Rao", "98765 43210")
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


def test_partner_keys(client):
    member = signed_in(client, 42)
    assert client.get("/auth/partner-keys").status_code == 403
    assert client.post("/auth/partner-keys", json={"name": "broker-1"}, headers=member).status_code == 403
    operator = signed_in(client, 7)
    assert client.post("/auth/partner-keys", json={"name": "broker-1"}, headers={**operator, "x-csrf-token": "0" * 64}).status_code == 403
    assert client.post("/auth/partner-keys", json={"name": "Bad Name"}, headers=operator).status_code == 422
    issued = client.post("/auth/partner-keys", json={"name": "broker-1"}, headers=operator).json()
    assert partners.partner_for(issued["key"]) == "broker-1"
    with auth.engine().connect() as conn:
        assert conn.execute(auth.partner_keys.select()).one().key_hash == auth.digest(issued["key"])
    listed = client.get("/auth/partner-keys").json()
    assert [row["name"] for row in listed] == ["broker-1"] and "key" not in listed[0] and "key_hash" not in listed[0] and listed[0]["last_used_at"]
    assert client.delete(f"/auth/partner-keys/{issued['id']}", headers=operator).status_code == 204
    assert partners.partner_for(issued["key"]) is None
    assert client.delete(f"/auth/partner-keys/{issued['id']}", headers=operator).status_code == 404


def test_sign_in_is_off_until_configured(client, monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    assert client.post("/auth/google/start", headers={"origin": ORIGIN}).status_code == 503


def test_providers_list_only_configured_sign_in(client, monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    assert client.get("/auth/providers").json() == {"google": False, "owner": False}


def test_email_and_mobile_sign_up_and_log_in(client):
    form = {"name": "Asha Rao", "email": "Asha@Example.com", "phone": "98765 43210", "password": "correct horse"}
    origin = {"origin": ORIGIN}
    assert client.post("/auth/signup", json=form).status_code == 403
    assert client.post("/auth/signup", json=form, headers=origin).status_code == 200
    session = client.get("/auth/session").json()
    assert session["role"] == "member" and session["profile"]["full_name"] == "Asha Rao"
    assert client.post("/auth/signup", json={**form, "name": "Other Person", "phone": None}, headers=origin).status_code == 409
    assert client.post("/auth/signup", json={"name": "No Contact", "password": "correct horse"}, headers=origin).status_code == 422
    client.cookies.clear()
    for identifier in ("asha@example.com", "+91 98765 43210", "9876543210"):
        assert client.post("/auth/login", json={"identifier": identifier, "password": "correct horse"}, headers=origin).status_code == 200
    for identifier, password in (("asha@example.com", "wrong password"), ("nobody@example.com", "correct horse"), ("12345", "correct horse")):
        assert client.post("/auth/login", json={"identifier": identifier, "password": password}, headers=origin).status_code == 401


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


def test_email_and_mobile_accounts(client):
    headers = {"origin": ORIGIN}
    asha = {"name": "Asha Rao", "email": "Asha@Example.com", "password": "correct horse"}
    assert client.post("/auth/signup", json=asha, headers={"origin": "https://evil.test"}).status_code == 403
    assert client.post("/auth/signup", json=asha, headers=headers).status_code == 200
    assert client.get("/auth/session").json()["profile"]["full_name"] == "Asha Rao"
    assert client.post("/auth/signup", json={**asha, "email": "asha@example.com"}, headers=headers).status_code == 409
    client.cookies.clear()
    assert client.post("/auth/login", json={"identifier": "asha@example.com", "password": "wrong one"}, headers=headers).status_code == 401
    assert client.post("/auth/login", json={"identifier": "nobody@example.com", "password": "correct horse"}, headers=headers).status_code == 401
    assert client.post("/auth/login", json={"identifier": "ASHA@example.com", "password": "correct horse"}, headers=headers).status_code == 200
    client.cookies.clear()
    ravi = {"name": "Ravi Kumar", "phone": "98765 43210", "password": "mobile pass 1"}
    assert client.post("/auth/signup", json=ravi, headers=headers).status_code == 200
    client.cookies.clear()
    assert client.post("/auth/login", json={"identifier": "+91 98765 43210", "password": "mobile pass 1"}, headers=headers).status_code == 200
    assert client.get("/auth/session").json()["role"] == "member"
    with auth.engine().connect() as conn:
        assert all(row.password_hash.startswith("scrypt$") and "mobile pass 1" not in row.password_hash for row in conn.execute(auth.users.select()))


def test_signup_needs_a_contact_and_a_real_password(client):
    headers = {"origin": ORIGIN}
    assert client.post("/auth/signup", json={"name": "Asha Rao", "password": "long enough pw"}, headers=headers).status_code == 422
    assert client.post("/auth/signup", json={"name": "Asha Rao", "email": "a@example.com", "password": "short"}, headers=headers).status_code == 422
    assert client.post("/auth/signup", json={"name": "Asha Rao", "email": "not an email", "password": "long enough pw"}, headers=headers).status_code == 422


def owner_callback(client, monkeypatch, identity):
    monkeypatch.setattr(auth_routes, "google_identity", lambda transaction, code: identity)
    url = client.post("/auth/owner/start", headers={"origin": ORIGIN}).json()["authorization_url"]
    state = parse_qs(urlsplit(url).query)["state"][0]
    return client.get("/auth/google/callback", params={"code": "abc", "state": state}, follow_redirects=False)


def test_owner_sign_in_admits_only_the_owner_email(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "secret")
    assert client.post("/auth/owner/start", headers={"origin": ORIGIN}).status_code == 503
    monkeypatch.setenv("OWNER_EMAILS", "Owner@Example.com")
    assert client.get("/auth/providers").json()["owner"] is True
    url = client.post("/auth/owner/start", headers={"origin": ORIGIN}).json()["authorization_url"]
    assert parse_qs(urlsplit(url).query)["scope"] == ["openid email"]
    for identity in ({"sub": "9", "email": "intruder@example.com", "email_verified": True}, {"sub": "9", "email": "owner@example.com", "email_verified": False}, {"sub": "9"}):
        assert owner_callback(client, monkeypatch, identity).status_code == 403
    assert client.get("/auth/session").status_code == 401
    allowed = owner_callback(client, monkeypatch, {"sub": "9", "email": "owner@example.com", "email_verified": True})
    assert allowed.status_code == 303 and client.get("/auth/session").json()["role"] == "operator"


def test_dev_console_is_for_the_operator_only(client, monkeypatch):
    monkeypatch.setattr(dev_console.config, "AI_API_KEY", "")
    assert client.get("/dev/overview").status_code == 401
    signed_in(client, 42)
    assert client.get("/dev/overview").status_code == 403
    signed_in(client, 7)
    assert client.get("/dev/overview").json()["ai"]["provider"]
    assert {"intake", "score_risk"} <= {node["id"] for node in client.get("/dev/architecture").json()["nodes"]}
    assert any(row["path"] == "/dev/overview" for row in client.get("/dev/routes").json())
    assert client.get("/dev/ai-calls").json() == [] and client.get("/dev/traces").json() == []
    assert client.get("/dev/retrieval", params={"q": "flood"}).json()["available"] is False


def test_idle_sessions_expire(client):
    grant = auth.create_member(42, now=1_000_000)
    assert auth.resolve_session(grant.token, now=1_000_000 + 60).role == "member"
    with pytest.raises(HTTPException):
        auth.resolve_session(grant.token, now=1_000_000 + 60 + auth.IDLE_SECONDS)


def test_logout_revokes_the_session_on_the_server(client):
    headers = signed_in(client, 42)
    token = client.cookies.get(auth.SESSION_COOKIE)
    timing = client.get("/auth/session").json()["timing"]
    assert timing["idle_seconds"] == 900 and 0 < timing["expires_at"] - timing["now"] <= 8 * 3600
    response = client.post("/auth/logout", headers=headers)
    assert response.status_code == 204 and response.headers["clear-site-data"] == '"cache"'
    client.cookies.set(auth.SESSION_COOKIE, token)
    assert client.get("/auth/session").status_code == 401


def test_reviewer_needs_a_profile(client):
    operator = signed_in(client, 7, complete=False)
    assert client.get("/auth/session").json()["profile"]["complete"] is False
    assert client.post("/underwrite/history/999999/review", json=REVIEW, headers=operator).status_code == 403
    assert client.put("/auth/profile", json={"full_name": "Asha 2", "phone": "98765 43210"}, headers=operator).status_code == 422
    assert client.put("/auth/profile", json={"full_name": "Asha Rao", "phone": "12345"}, headers=operator).status_code == 422
    assert client.put("/auth/profile", json={"full_name": "Asha Rao", "phone": "98765 43210"}).status_code == 403
    saved = client.put("/auth/profile", json={"full_name": "  Asha   Rao ", "phone": "098765-43210"}, headers=operator).json()
    assert saved == {"full_name": "Asha Rao", "phone": "+919876543210", "has_photo": False, "complete": True}
    assert client.post("/underwrite/history/999999/review", json=REVIEW, headers=operator).status_code == 404


def test_photo_is_re_encoded_and_private(client):
    member = signed_in(client, 42)
    upload = BytesIO()
    Image.new("RGB", (900, 600), "teal").save(upload, "PNG")
    saved = client.put("/auth/profile/photo", files={"photo": ("me.png", upload.getvalue(), "image/png")}, headers=member)
    assert saved.status_code == 200 and saved.json()["has_photo"] is True
    shown = client.get("/auth/profile/photo")
    assert shown.headers["content-type"] == "image/webp" and Image.open(BytesIO(shown.content)).size == (256, 256)
    assert client.put("/auth/profile/photo", files={"photo": ("me.png", b"not an image", "image/png")}, headers=member).status_code == 415
    assert client.delete("/auth/profile/photo", headers=member).json()["has_photo"] is False
    assert client.get("/auth/profile/photo").status_code == 404
    client.cookies.clear()
    assert client.get("/auth/profile/photo").status_code == 401


def test_origin_ignores_the_api_path_in_the_base_url(monkeypatch):
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://imaarat-ai.vercel.app/api")
    assert auth.app_origin() == "https://imaarat-ai.vercel.app"
    monkeypatch.setenv("PUBLIC_BASE_URL", "")
    assert auth.app_origin() == ""


def test_contact_details_reach_only_reviewers(client):
    saved = db.save_submission({"raw_input": {"property_id": "C-1", "city": "Chennai", "mobile": "98765 43210"}, "decision": "Accept", "risk_score": 10, "risk_flags": []})
    assert "mobile" not in client.get("/underwrite/history").json()[0]["raw_input"]
    assert "mobile" not in client.get(f"/underwrite/history/{saved['id']}").json()["raw_input"]
    signed_in(client, 42)
    assert "mobile" not in client.get(f"/underwrite/history/{saved['id']}").json()["raw_input"]
    signed_in(client, 7)
    assert client.get(f"/underwrite/history/{saved['id']}").json()["raw_input"]["mobile"] == "98765 43210"


def test_traces_never_carry_contact_details():
    assert observability.hide_contacts(data={"args": ({"mobile": "98765 43210", "city": "Pune"},), "kwargs": {}}) == {"args": [{"city": "Pune"}], "kwargs": {}}
    assert "mobile" not in observability.hide_contacts(data='{"mobile": "98765 43210", "city": "Pune"}')
