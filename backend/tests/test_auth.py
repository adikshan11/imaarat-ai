from importlib import import_module
from importlib.util import find_spec
import os
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, select, text
from sqlalchemy.pool import StaticPool
from starlette.requests import Request


def identity():
    assert find_spec("app.auth") is not None, "Secure identity implementation is missing"
    return import_module("app.auth")


@pytest.fixture
def storage():
    auth = identity()
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    auth.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def postgres():
    assert find_spec("app.migrations") is not None, "Versioned migration implementation is missing"
    url = os.getenv("IDENTITY_TEST_DATABASE_URL")
    assert url, "Identity integration requires isolated remote Postgres"
    schema = "test_" + uuid4().hex
    admin = create_engine(url)
    with admin.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_engine(url, connect_args={"options": f"-csearch_path={schema}"})
    yield engine
    engine.dispose()
    with admin.begin() as conn:
        conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
    admin.dispose()


def test_guest_isolated(storage):
    auth = identity()
    first = auth.create_guest(storage, now=1000)
    second = auth.create_guest(storage, now=1000)
    assert first.principal.owner_id != second.principal.owner_id
    assert first.principal.role == "guest"
    assert first.principal.data_policy == "synthetic"
    assert len(first.token) >= 43
    with storage.connect() as conn:
        row = dict(conn.execute(select(auth.sessions)).first()._mapping)
    assert first.token not in str(row)
    assert first.csrf_token not in str(row)
    assert first.token not in repr(first)
    assert first.csrf_token not in repr(first)


def test_session_expiry(storage):
    auth = identity()
    guest = auth.create_guest(storage, now=1000)
    assert auth.resolve_session(storage, guest.token, now=1001).owner_id == guest.principal.owner_id
    for token, when in ((guest.token, 87400), ("invalid", 1001)):
        with pytest.raises(HTTPException) as error:
            auth.resolve_session(storage, token, now=when)
        assert error.value.status_code == 401
    member = auth.create_member(storage, 42, now=1000)
    assert member.principal.data_policy == "private_local"
    with pytest.raises(HTTPException):
        auth.resolve_session(storage, member.token, now=2800)
    absolute = auth.create_member(storage, 43, now=1000)
    for when in range(2000, 44200, 1000):
        auth.resolve_session(storage, absolute.token, now=when)
    with pytest.raises(HTTPException):
        auth.resolve_session(storage, absolute.token, now=44200)


def test_member_identity(storage):
    auth = identity()
    first = auth.create_member(storage, 42, now=1000)
    second = auth.create_member(storage, 42, now=1001)
    assert first.principal.owner_id == second.principal.owner_id
    assert first.token != second.token
    assert "connection:write" in first.principal.scopes
    for value in (True, "42", 0, -1):
        with pytest.raises(HTTPException):
            auth.create_member(storage, value, now=1000)


def test_logout_revokes(storage):
    auth = identity()
    grant = auth.create_guest(storage, now=1000)
    auth.revoke_session(storage, grant.principal, now=1001)
    with pytest.raises(HTTPException):
        auth.resolve_session(storage, grant.token, now=1002)


def test_csrf_binding(storage, monkeypatch):
    auth = identity()
    monkeypatch.setenv("APP_ORIGIN", "https://example.test")

    def engine():
        return storage

    monkeypatch.setattr(auth, "get_engine", engine)
    grant = auth.create_guest(storage)
    other = auth.create_guest(storage)
    for origin, csrf, allowed in (("https://example.test", grant.csrf_token, True), ("https://evil.test", grant.csrf_token, False), ("", grant.csrf_token, False), ("https://example.test", other.csrf_token, False)):
        request = Request({"type": "http", "headers": [(b"origin", origin.encode()), (b"x-csrf-token", csrf.encode())]})
        if allowed:
            auth.require_csrf(request, grant.principal)
        else:
            with pytest.raises(HTTPException) as error:
                auth.require_csrf(request, grant.principal)
            assert error.value.status_code == 403


def test_guest_admission(storage):
    auth = identity()
    for number in range(20):
        auth.create_guest(storage, now=1000)
    with pytest.raises(HTTPException) as error:
        auth.create_guest(storage, now=1000)
    assert error.value.status_code == 429
    assert auth.create_guest(storage, now=1060).principal.role == "guest"


def test_oauth_once(storage):
    auth = identity()
    flow = auth.create_oauth(storage, "https://example.test/api/auth/github/callback", now=1000)
    with pytest.raises(HTTPException):
        auth.consume_oauth(storage, flow.state, "wrong-browser", now=1001)
    transaction = auth.consume_oauth(storage, flow.state, flow.browser_token, now=1001)
    assert len(transaction["code_verifier"]) >= 43
    assert flow.state not in repr(flow)
    with pytest.raises(HTTPException):
        auth.consume_oauth(storage, flow.state, flow.browser_token, now=1002)
    expired = auth.create_oauth(storage, "https://example.test/api/auth/github/callback", now=1000)
    with pytest.raises(HTTPException):
        auth.consume_oauth(storage, expired.state, expired.browser_token, now=1600)


def test_step_up(storage):
    auth = identity()
    member = auth.create_member(storage, 42, now=1000)
    auth.require_recent_auth(member.principal, now=1001)
    for principal, when in ((member.principal, 1300), (auth.create_guest(storage, now=1000).principal, 1001)):
        with pytest.raises(HTTPException) as error:
            auth.require_recent_auth(principal, now=when)
        assert error.value.status_code == 403


def test_oauth_logout(storage):
    auth = identity()
    guest = auth.create_guest(storage, now=1000)
    flow = auth.create_oauth(storage, "https://example.test/api/auth/github/callback", guest.principal, now=1001)
    auth.revoke_session(storage, guest.principal, now=1002)
    with pytest.raises(HTTPException):
        auth.consume_oauth(storage, flow.state, flow.browser_token, now=1003)
    with pytest.raises(HTTPException):
        auth.create_member(storage, 42, previous_session=guest.principal.session_id, now=1003)


def test_rotation_once(storage):
    auth = identity()
    first = auth.create_member(storage, 42, now=1000)
    second = auth.create_member(storage, 42, previous_session=first.principal.session_id, now=1001)
    with pytest.raises(HTTPException):
        auth.create_member(storage, 42, previous_session=first.principal.session_id, now=1002)
    assert auth.resolve_session(storage, second.token, now=1003).owner_id == first.principal.owner_id
    expired = auth.create_member(storage, 43, now=1000)
    with pytest.raises(HTTPException):
        auth.create_member(storage, 43, previous_session=expired.principal.session_id, now=2800)


def test_migration_quarantines(postgres):
    migrations = import_module("app.migrations")
    with postgres.begin() as conn:
        conn.execute(text("CREATE TABLE submissions (id INTEGER PRIMARY KEY, property_id TEXT, raw_input TEXT, created_at TEXT)"))
        conn.execute(text("INSERT INTO submissions VALUES (1, 'claimed-demo', '{}', '2026-10-05')"))
    assert migrations.apply_migrations(postgres) == ["001_identity"]
    assert migrations.apply_migrations(postgres) == []
    with postgres.connect() as conn:
        row = conn.execute(text("SELECT owner_id, data_class, record_version, deleted_at FROM submissions WHERE id=1")).one()
    assert row.owner_id is None
    assert row.data_class == "quarantined"
    assert row.record_version == 1
    assert row.deleted_at is None


def test_migration_concurrent(postgres):
    migrations = import_module("app.migrations")
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(migrations.apply_migrations, (postgres, postgres)))
    assert sorted(len(result) for result in results) == [0, 1]
    with postgres.connect() as conn:
        assert conn.execute(text("SELECT COUNT(*) FROM schema_migrations")).scalar_one() == 1


def test_migration_tamper(postgres):
    migrations = import_module("app.migrations")
    migrations.apply_migrations(postgres)
    with postgres.begin() as conn:
        conn.execute(text("UPDATE schema_migrations SET checksum='modified'"))
    with pytest.raises(migrations.MigrationError, match="migration_checksum_mismatch"):
        migrations.apply_migrations(postgres)


def test_owned_storage(postgres, monkeypatch):
    auth = identity()
    from app import db

    import_module("app.migrations").apply_migrations(postgres)

    def engine():
        return postgres

    monkeypatch.setattr(db, "get_engine", engine)
    first = auth.create_member(postgres, 42)
    second = auth.create_member(postgres, 43)
    saved = db.save_owned_submission(first.principal, {"property_id": "sample", "raw_input": {}, "decision": "Accept", "risk_score": 5})
    assert db.owned_submission(first.principal, saved["id"])["id"] == saved["id"]
    assert db.owned_submission(second.principal, saved["id"]) is None
    assert len(db.owned_history(first.principal)) == 1
    assert db.owned_history(second.principal) == []
    with pytest.raises(HTTPException):
        db.owned_history(first.principal, limit=101)