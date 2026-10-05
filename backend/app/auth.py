from __future__ import annotations

from dataclasses import dataclass, field
from hashlib import sha256
import hmac
import os
import re
from secrets import token_urlsafe
import time
from uuid import uuid4

from fastapi import HTTPException, Request
from sqlalchemy import BigInteger, Column, ForeignKey, Integer, MetaData, String, Table, case, insert, select, update
from sqlalchemy.engine import Engine

from app.db import get_engine
from app.settings import dependency_url


metadata = MetaData()
users = Table(
    "users", metadata,
    Column("id", String, primary_key=True),
    Column("github_id", BigInteger, unique=True),
    Column("role", String, nullable=False),
    Column("created_at", BigInteger, nullable=False),
    Column("disabled_at", BigInteger),
)
sessions = Table(
    "sessions", metadata,
    Column("id", String, primary_key=True),
    Column("owner_id", String, ForeignKey("users.id"), nullable=False),
    Column("csrf_hash", String, nullable=False),
    Column("created_at", BigInteger, nullable=False),
    Column("last_seen", BigInteger, nullable=False),
    Column("expires_at", BigInteger, nullable=False),
    Column("authenticated_at", BigInteger),
    Column("revoked_at", BigInteger),
)
oauth_transactions = Table(
    "oauth_transactions", metadata,
    Column("state_hash", String, primary_key=True),
    Column("browser_hash", String, nullable=False),
    Column("code_verifier", String, nullable=False),
    Column("callback", String, nullable=False),
    Column("previous_session", String),
    Column("expected_github_id", BigInteger),
    Column("expires_at", BigInteger, nullable=False),
    Column("consumed_at", BigInteger),
)
rate_limits = Table(
    "identity_rate_limits", metadata,
    Column("id", String, primary_key=True),
    Column("window_start", BigInteger, nullable=False),
    Column("count", Integer, nullable=False),
)


@dataclass(frozen=True)
class Principal:
    owner_id: str
    role: str
    data_policy: str
    session_id: str | None
    scopes: frozenset[str]
    authenticated_at: int | None = None


@dataclass(frozen=True)
class SessionGrant:
    principal: Principal
    token: str = field(repr=False)
    csrf_token: str = field(repr=False)
    expires_at: int = 0


@dataclass(frozen=True)
class OAuthFlow:
    state: str = field(repr=False)
    browser_token: str = field(repr=False)
    code_verifier: str = field(repr=False)
    callback: str = ""


def clock(now: int | None) -> int:
    return int(time.time()) if now is None else now


def digest(value: str) -> str:
    return sha256(value.encode()).hexdigest()


def csrf_token(token: str) -> str:
    return hmac.new(token.encode(), b"imaarat-csrf", sha256).hexdigest()


def principal_from(row) -> Principal:
    scopes = {"assessment:read", "assessment:write"}
    if row.role == "guest":
        scopes.add("review:simulate")
    elif row.role in {"member", "reviewer", "operator"}:
        scopes.add("connection:write")
        if row.role in {"reviewer", "operator"}:
            scopes.add("review:write")
    else:
        raise HTTPException(401, "session_invalid")
    return Principal(row.owner_id, row.role, "synthetic" if row.role == "guest" else "private_local", row.id, frozenset(scopes), row.authenticated_at)


def reserve_identity(conn, key: str, now: int, ceiling: int) -> None:
    if conn.dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert as upsert
    elif conn.dialect.name == "sqlite" and os.getenv("APP_ENV") == "test":
        from sqlalchemy.dialects.sqlite import insert as upsert
    else:
        raise HTTPException(503, "identity_storage_unavailable")
    start = now // 60 * 60
    statement = upsert(rate_limits).values(id=key, window_start=start, count=1)
    statement = statement.on_conflict_do_update(
        index_elements=[rate_limits.c.id],
        set_={"window_start": start, "count": case((rate_limits.c.window_start != start, 1), else_=rate_limits.c.count + 1)},
        where=(rate_limits.c.window_start != start) | (rate_limits.c.count < ceiling),
    ).returning(rate_limits.c.id)
    if conn.execute(statement).first() is None:
        raise HTTPException(429, "identity_rate_limited", headers={"Retry-After": "60"})


def issue_session(conn, owner_id: str, role: str, now: int) -> SessionGrant:
    token = token_urlsafe(32)
    csrf = csrf_token(token)
    expires = now + (86400 if role == "guest" else 43200)
    values = {"id": digest(token), "owner_id": owner_id, "csrf_hash": digest(csrf), "created_at": now, "last_seen": now, "expires_at": expires, "authenticated_at": None if role == "guest" else now}
    conn.execute(insert(sessions).values(**values))
    from types import SimpleNamespace

    principal = principal_from(SimpleNamespace(**values, role=role))
    return SessionGrant(principal, token, csrf, expires)


def create_guest(engine: Engine, now: int | None = None) -> SessionGrant:
    now = clock(now)
    with engine.begin() as conn:
        reserve_identity(conn, "guest", now, 20)
        owner = str(uuid4())
        conn.execute(insert(users).values(id=owner, role="guest", created_at=now))
        return issue_session(conn, owner, "guest", now)


def create_member(engine: Engine, github_id: int, now: int | None = None, previous_session: str | None = None, expected_github_id: int | None = None) -> SessionGrant:
    if type(github_id) is not int or github_id <= 0 or github_id > 9223372036854775807:
        raise HTTPException(401, "identity_invalid")
    if expected_github_id is not None and github_id != expected_github_id:
        raise HTTPException(403, "identity_mismatch")
    now = clock(now)
    with engine.begin() as conn:
        if previous_session:
            predecessor = conn.execute(select(sessions).where(sessions.c.id == previous_session).with_for_update()).first()
            if predecessor is None or predecessor.revoked_at is not None or now >= predecessor.expires_at or (predecessor.authenticated_at is not None and now - predecessor.last_seen >= 1800):
                raise HTTPException(401, "session_invalid")
            predecessor_user = conn.execute(select(users).where(users.c.id == predecessor.owner_id).with_for_update()).one()
            if predecessor_user.disabled_at is not None or (predecessor_user.github_id is not None and predecessor_user.github_id != github_id):
                raise HTTPException(403, "identity_mismatch")
        if conn.dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import insert as upsert
        else:
            from sqlalchemy.dialects.sqlite import insert as upsert
        statement = upsert(users).values(id=str(uuid4()), github_id=github_id, role="member", created_at=now)
        conn.execute(statement.on_conflict_do_nothing(index_elements=[users.c.github_id]))
        user = conn.execute(select(users).where(users.c.github_id == github_id).with_for_update()).one()
        if user.disabled_at is not None:
            raise HTTPException(401, "identity_disabled")
        grant = issue_session(conn, user.id, user.role, now)
        if previous_session:
            conn.execute(update(sessions).where(sessions.c.id == previous_session).values(revoked_at=now))
            conn.execute(update(oauth_transactions).where(oauth_transactions.c.previous_session == previous_session, oauth_transactions.c.consumed_at.is_(None)).values(consumed_at=now, code_verifier=""))
        return grant


def resolve_session(engine: Engine, token: str, now: int | None = None) -> Principal:
    if not isinstance(token, str) or not re.fullmatch(r"[A-Za-z0-9_-]{43}", token):
        raise HTTPException(401, "session_invalid")
    now = clock(now)
    with engine.begin() as conn:
        row = conn.execute(select(sessions, users.c.role, users.c.disabled_at).join(users).where(sessions.c.id == digest(token)).with_for_update(of=sessions)).first()
        if row is not None:
            user = conn.execute(select(users).where(users.c.id == row.owner_id).with_for_update()).one()
            from types import SimpleNamespace

            row = SimpleNamespace(**dict(row._mapping))
            row.role = user.role
            row.disabled_at = user.disabled_at
        if row is None or row.revoked_at is not None or row.disabled_at is not None or now >= row.expires_at or (row.role != "guest" and now - row.last_seen >= 1800):
            raise HTTPException(401, "session_invalid")
        conn.execute(update(sessions).where(sessions.c.id == row.id).values(last_seen=now))
        return principal_from(row)


def resolve_principal(request: Request) -> Principal:
    return resolve_session(get_engine(), request.cookies.get("__Host-imaarat_session", ""))


def require_origin(request: Request) -> None:
    origin = dependency_url(os.getenv("APP_ORIGIN", ""), os.getenv("APP_ENV", "production"))
    if not origin or request.headers.get("origin") != origin:
        raise HTTPException(403, "origin_invalid")


def require_csrf(request: Request, principal: Principal) -> None:
    require_origin(request)
    provided = request.headers.get("x-csrf-token", "")
    if len(provided) != 64:
        raise HTTPException(403, "csrf_invalid")
    with get_engine().connect() as conn:
        row = conn.execute(select(sessions).where(sessions.c.id == principal.session_id, sessions.c.owner_id == principal.owner_id)).first()
    now = clock(None)
    if row is None or row.revoked_at is not None or now >= row.expires_at or (principal.role != "guest" and now - row.last_seen >= 1800) or not hmac.compare_digest(row.csrf_hash, digest(provided)):
        raise HTTPException(403, "csrf_invalid")


def revoke_session(engine: Engine, principal: Principal, now: int | None = None) -> None:
    now = clock(now)
    with engine.begin() as conn:
        conn.execute(update(sessions).where(sessions.c.id == principal.session_id, sessions.c.owner_id == principal.owner_id).values(revoked_at=now))
        conn.execute(update(oauth_transactions).where(oauth_transactions.c.previous_session == principal.session_id, oauth_transactions.c.consumed_at.is_(None)).values(consumed_at=now, code_verifier=""))


def lock_session(conn, principal: Principal, now: int | None = None):
    if conn.dialect.name == "postgresql":
        conn.exec_driver_sql("SET LOCAL lock_timeout = '5s'")
    row = conn.execute(select(sessions).where(sessions.c.id == principal.session_id, sessions.c.owner_id == principal.owner_id).with_for_update()).one_or_none()
    now = clock(now)
    if row is None or row.revoked_at is not None or now >= row.expires_at or now - row.last_seen >= 1800 or row.authenticated_at != principal.authenticated_at:
        raise HTTPException(401, "session_invalid")
    return row


def require_recent_auth(principal: Principal, now: int | None = None) -> None:
    now = clock(now)
    if principal.role == "guest" or principal.authenticated_at is None or not 0 <= now - principal.authenticated_at < 300:
        raise HTTPException(403, "reauthentication_required")


def create_oauth(engine: Engine, callback: str, previous: Principal | None = None, now: int | None = None) -> OAuthFlow:
    now = clock(now)
    flow = OAuthFlow(token_urlsafe(32), token_urlsafe(32), token_urlsafe(48), callback)
    with engine.begin() as conn:
        reserve_identity(conn, "oauth", now, 20)
        expected = None
        if previous is not None and previous.role != "guest":
            expected = conn.execute(select(users.c.github_id).where(users.c.id == previous.owner_id)).scalar_one()
        conn.execute(insert(oauth_transactions).values(state_hash=digest(flow.state), browser_hash=digest(flow.browser_token), code_verifier=flow.code_verifier, callback=callback, previous_session=previous.session_id if previous else None, expected_github_id=expected, expires_at=now + 600))
    return flow


def consume_oauth(engine: Engine, state: str, browser_token: str, now: int | None = None) -> dict:
    if len(state) != 43 or len(browser_token) != 43:
        raise HTTPException(400, "oauth_invalid")
    now = clock(now)
    with engine.begin() as conn:
        row = conn.execute(select(oauth_transactions).where(oauth_transactions.c.state_hash == digest(state)).with_for_update()).first()
        if row is None or row.consumed_at is not None or now >= row.expires_at or not hmac.compare_digest(row.browser_hash, digest(browser_token)):
            raise HTTPException(400, "oauth_invalid")
        result = conn.execute(update(oauth_transactions).where(oauth_transactions.c.state_hash == row.state_hash, oauth_transactions.c.consumed_at.is_(None)).values(consumed_at=now, code_verifier=""))
        if result.rowcount != 1:
            raise HTTPException(400, "oauth_invalid")
        return dict(row._mapping)