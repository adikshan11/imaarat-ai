from fastapi.testclient import TestClient
from sqlalchemy import create_engine, update

from app import auth
from app.api import auth_routes
from fastapi import FastAPI


def test_session_deadline(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'identity.db'}")
    auth.metadata.create_all(engine)
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("APP_ORIGIN", "https://example.test")
    def database():
        return engine

    def now(value):
        return 1100 if value is None else value

    monkeypatch.setattr(auth_routes, "get_engine", database)
    monkeypatch.setattr(auth, "get_engine", database)
    grant = auth.create_member(engine, 456, now=1000)
    monkeypatch.setattr(auth, "clock", now)
    app = FastAPI()
    app.include_router(auth_routes.router)
    client = TestClient(app, base_url="https://example.test")
    client.cookies.set("__Host-imaarat_session", grant.token)
    response = client.get("/auth/session")
    assert response.status_code == 200
    assert response.json()["expires_at"] == 2900
    with engine.begin() as conn:
        conn.execute(update(auth.sessions).values(expires_at=1200))
    assert client.get("/auth/session").json()["expires_at"] == 1200