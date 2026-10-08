"""GitHub sign-in: hashed opaque sessions, session-bound CSRF tokens and single-use PKCE state, stored in the app database."""

from __future__ import annotations

import hmac
import os
import re
import time
from dataclasses import dataclass, field
from hashlib import sha256
from secrets import token_urlsafe
from urllib.parse import urlsplit
from uuid import uuid4

from fastapi import HTTPException, Request
from sqlalchemy import BigInteger, Column, ForeignKey, Integer, LargeBinary, MetaData, String, Table, case, insert, inspect, select, text, update
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.engine import Engine

from app import config
from app.db import get_engine

SESSION_COOKIE = "__Host-imaarat_session"
OAUTH_COOKIE = "__Host-imaarat_oauth"
SESSION_SECONDS = config.SESSION_MAX_SECONDS
IDLE_SECONDS = config.SESSION_IDLE_SECONDS
REVIEW_ROLES = {"reviewer", "operator"}

metadata = MetaData()
users = Table(
    "users",
    metadata,
    Column("id", String, primary_key=True),
    Column("github_id", BigInteger, unique=True),
    Column("google_id", String, unique=True),
    Column("name", String),
    Column("role", String, nullable=False),
    Column("created_at", BigInteger, nullable=False),
    Column("disabled_at", BigInteger),
)
sessions = Table(
    "sessions",
    metadata,
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
    "oauth_transactions",
    metadata,
    Column("state_hash", String, primary_key=True),
    Column("browser_hash", String, nullable=False),
    Column("code_verifier", String, nullable=False),
    Column("callback", String, nullable=False),
    Column("expires_at", BigInteger, nullable=False),
    Column("consumed_at", BigInteger),
)
profiles = Table(
    "profiles",
    metadata,
    Column("owner_id", String, ForeignKey("users.id"), primary_key=True),
    Column("full_name", String),
    Column("phone", String),
    Column("photo", LargeBinary),
    Column("updated_at", BigInteger, nullable=False),
)
rate_limits = Table(
    "identity_rate_limits",
    metadata,
    Column("id", String, primary_key=True),
    Column("window_start", BigInteger, nullable=False),
    Column("count", Integer, nullable=False),
)
_ready_engines: set[str] = set()


@dataclass(frozen=True)
class Principal:
    owner_id: str
    role: str
    session_id: str
    github_id: int | None = None
    name: str | None = None
    full_name: str | None = None
    profile_complete: bool = False
    expires_at: int = 0


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


def engine() -> Engine:
    current = get_engine()
    if str(current.url) not in _ready_engines:
        metadata.create_all(current)
        existing = {column["name"] for column in inspect(current).get_columns("users")}
        if "name" not in existing:
            with current.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN name VARCHAR"))
        if "google_id" not in existing:
            guard = " IF NOT EXISTS" if current.dialect.name == "postgresql" else ""
            with current.begin() as conn:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN{guard} google_id VARCHAR"))
                conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS users_google_id ON users (google_id)"))
        _ready_engines.add(str(current.url))
    return current


def clock(now: int | None) -> int:
    return int(time.time()) if now is None else now


def digest(value: str) -> str:
    return sha256(value.encode()).hexdigest()


def csrf_token(token: str) -> str:
    return hmac.new(token.encode(), b"imaarat-csrf", sha256).hexdigest()


def app_origin() -> str:
    parts = urlsplit(os.getenv("PUBLIC_BASE_URL", ""))
    return f"{parts.scheme}://{parts.netloc}" if parts.scheme and parts.netloc else ""


def operator_ids() -> set[int]:
    return {int(value) for value in re.findall(r"\d+", os.getenv("OPERATOR_GITHUB_IDS", ""))}


def upsert(conn):
    return postgres_insert if conn.dialect.name == "postgresql" else sqlite_insert


def reserve_identity(conn, key: str, now: int, ceiling: int) -> None:
    start = now // 60 * 60
    statement = (
        upsert(conn)(rate_limits)
        .values(id=key, window_start=start, count=1)
        .on_conflict_do_update(
            index_elements=[rate_limits.c.id],
            set_={"window_start": start, "count": case((rate_limits.c.window_start != start, 1), else_=rate_limits.c.count + 1)},
            where=(rate_limits.c.window_start != start) | (rate_limits.c.count < ceiling),
        )
        .returning(rate_limits.c.id)
    )
    if conn.execute(statement).first() is None:
        raise HTTPException(429, "Too many sign-in attempts; try again in a minute", headers={"Retry-After": "60"})


def create_member(github_id: int, now: int | None = None, name: str | None = None) -> SessionGrant:
    if type(github_id) is not int or not 0 < github_id <= 9223372036854775807:
        raise HTTPException(401, "identity_invalid")
    role = "operator" if github_id in operator_ids() else "member"
    return open_session(users.c.github_id, github_id, role, clock(now), name)


def create_google_member(google_id: str, now: int | None = None) -> SessionGrant:
    if not isinstance(google_id, str) or not re.fullmatch(r"[0-9]{1,255}", google_id):
        raise HTTPException(401, "identity_invalid")
    return open_session(users.c.google_id, google_id, "member", clock(now), None)


def open_session(column, value, role: str, now: int, name: str | None) -> SessionGrant:
    with engine().begin() as conn:
        conn.execute(upsert(conn)(users).values(id=str(uuid4()), **{column.name: value}, name=name, role=role, created_at=now).on_conflict_do_nothing(index_elements=[column]))
        if name:
            conn.execute(update(users).where(column == value).values(name=name))
        if role == "operator":
            conn.execute(update(users).where(column == value).values(role="operator"))
        user = conn.execute(select(users).where(column == value)).one()
        if user.disabled_at is not None:
            raise HTTPException(401, "identity_disabled")
        token = token_urlsafe(32)
        csrf = csrf_token(token)
        expires = now + SESSION_SECONDS
        conn.execute(insert(sessions).values(id=digest(token), owner_id=user.id, csrf_hash=digest(csrf), created_at=now, last_seen=now, expires_at=expires, authenticated_at=now))
        return SessionGrant(Principal(user.id, user.role, digest(token), user.github_id, user.name), token, csrf, expires)


def resolve_session(token: str, now: int | None = None) -> Principal:
    if not isinstance(token, str) or not re.fullmatch(r"[A-Za-z0-9_-]{43}", token):
        raise HTTPException(401, "Sign in to continue")
    now = clock(now)
    with engine().begin() as conn:
        joined = sessions.join(users, users.c.id == sessions.c.owner_id).outerjoin(profiles, profiles.c.owner_id == sessions.c.owner_id)
        columns = (sessions, users.c.role, users.c.github_id, users.c.name, users.c.disabled_at, profiles.c.full_name, profiles.c.phone)
        row = conn.execute(select(*columns).select_from(joined).where(sessions.c.id == digest(token))).first()
        if row is None or row.revoked_at is not None or row.disabled_at is not None or now >= row.expires_at or now - row.last_seen >= IDLE_SECONDS:
            raise HTTPException(401, "Your session has ended; sign in again")
        conn.execute(update(sessions).where(sessions.c.id == row.id).values(last_seen=now))
        return Principal(row.owner_id, row.role, row.id, row.github_id, row.name, row.full_name, bool(row.full_name and row.phone), row.expires_at)


def resolve_principal(request: Request) -> Principal:
    return resolve_session(request.cookies.get(SESSION_COOKIE, ""))


def signed_in(request: Request) -> bool:
    try:
        resolve_principal(request)
    except HTTPException:
        return False
    return True


def require_origin(request: Request) -> None:
    origin = app_origin()
    if not origin or request.headers.get("origin") != origin:
        raise HTTPException(403, "origin_invalid")


def require_csrf(request: Request, principal: Principal) -> None:
    require_origin(request)
    provided = request.headers.get("x-csrf-token", "")
    with engine().connect() as conn:
        row = conn.execute(select(sessions.c.csrf_hash).where(sessions.c.id == principal.session_id, sessions.c.owner_id == principal.owner_id)).first()
    if row is None or len(provided) != 64 or not hmac.compare_digest(row.csrf_hash, digest(provided)):
        raise HTTPException(403, "csrf_invalid")


def require_reviewer(request: Request) -> Principal:
    principal = resolve_principal(request)
    require_csrf(request, principal)
    if principal.role not in REVIEW_ROLES:
        raise HTTPException(403, "Only a reviewer can approve or override a referral")
    if not principal.profile_complete:
        raise HTTPException(403, "Add your name and mobile number in your profile before reviewing")
    return principal


def revoke_session(principal: Principal, now: int | None = None) -> None:
    with engine().begin() as conn:
        conn.execute(update(sessions).where(sessions.c.id == principal.session_id, sessions.c.owner_id == principal.owner_id).values(revoked_at=clock(now)))


def create_oauth(callback: str, now: int | None = None) -> OAuthFlow:
    now = clock(now)
    flow = OAuthFlow(token_urlsafe(32), token_urlsafe(32), token_urlsafe(48), callback)
    with engine().begin() as conn:
        reserve_identity(conn, "oauth", now, 20)
        conn.execute(
            insert(oauth_transactions).values(state_hash=digest(flow.state), browser_hash=digest(flow.browser_token), code_verifier=flow.code_verifier, callback=callback, expires_at=now + 600)
        )
    return flow


def consume_oauth(state: str, browser_token: str, now: int | None = None) -> dict:
    if len(state) != 43 or len(browser_token) != 43:
        raise HTTPException(400, "oauth_invalid")
    now = clock(now)
    with engine().begin() as conn:
        row = conn.execute(select(oauth_transactions).where(oauth_transactions.c.state_hash == digest(state))).first()
        if row is None or row.consumed_at is not None or now >= row.expires_at or not hmac.compare_digest(row.browser_hash, digest(browser_token)):
            raise HTTPException(400, "oauth_invalid")
        result = conn.execute(update(oauth_transactions).where(oauth_transactions.c.state_hash == row.state_hash, oauth_transactions.c.consumed_at.is_(None)).values(consumed_at=now, code_verifier=""))
        if result.rowcount != 1:
            raise HTTPException(400, "oauth_invalid")
        return dict(row._mapping)
