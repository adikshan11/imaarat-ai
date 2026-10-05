from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
import json
import re
from secrets import token_urlsafe
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import BigInteger, Column, ForeignKey, String, Table, insert, select, update

from app import auth


principal_state = ContextVar("principal", default=None)
tokens = Table("interop_tokens", auth.metadata,
    Column("id", String, primary_key=True),
    Column("token_hash", String, unique=True, nullable=False),
    Column("owner_id", String, ForeignKey("users.id"), nullable=False),
    Column("scopes", String, nullable=False),
    Column("expires_at", BigInteger, nullable=False),
    Column("revoked_at", BigInteger),
)


@dataclass(frozen=True)
class TokenGrant:
    id: str
    token: str = field(repr=False)
    expires_at: int = 0


@contextmanager
def principal_context(principal):
    token = principal_state.set(principal)
    try:
        yield
    finally:
        principal_state.reset(token)


def current_principal(action: str):
    principal = principal_state.get()
    if principal is None:
        raise HTTPException(401, "authentication_required")
    if action not in principal.scopes:
        raise HTTPException(403, "scope_required")
    return principal


def authorize(principal, action: str, owner_id: str) -> None:
    if action not in principal.scopes:
        raise HTTPException(403, "scope_required")
    if principal.owner_id != owner_id:
        raise HTTPException(404, "not_found")


def issue_token(engine, principal, scopes: set[str], now=None, lifetime=3600):
    auth.require_recent_auth(principal, now)
    allowed = {"interop:read", "interop:assess"}
    if not scopes or not scopes <= allowed or type(lifetime) is not int or not 60 <= lifetime <= 86400:
        raise HTTPException(422, "token_scope_invalid")
    now = auth.clock(now)
    token = token_urlsafe(32)
    token_id = str(uuid4())
    with engine.begin() as conn:
        auth.lock_session(conn, principal, now)
        user = conn.execute(select(auth.users).where(auth.users.c.id == principal.owner_id).with_for_update()).one_or_none()
        if user is None or user.disabled_at is not None or user.role == "guest":
            raise HTTPException(403, "member_required")
        existing = conn.execute(select(tokens.c.id).where(tokens.c.owner_id == principal.owner_id, tokens.c.revoked_at.is_(None), tokens.c.expires_at > now)).all()
        if len(existing) >= 10:
            raise HTTPException(429, "token_limit")
        conn.execute(insert(tokens).values(id=token_id, token_hash=auth.digest(token), owner_id=principal.owner_id, scopes=json.dumps(sorted(scopes)), expires_at=now + lifetime))
    return TokenGrant(token_id, token, now + lifetime)


def resolve_token(engine, token: str, now=None):
    if not re.fullmatch(r"[A-Za-z0-9_-]{43}", token):
        raise HTTPException(401, "token_invalid")
    now = auth.clock(now)
    with engine.connect() as conn:
        row = conn.execute(select(tokens, auth.users.c.role, auth.users.c.disabled_at).join(auth.users).where(tokens.c.token_hash == auth.digest(token))).first()
    if row is None or row.disabled_at is not None or row.revoked_at is not None or now >= row.expires_at or row.role == "guest":
        raise HTTPException(401, "token_invalid")
    return auth.Principal(row.owner_id, row.role, "private_local", None, frozenset(json.loads(row.scopes)))


def revoke_token(engine, principal, token_id):
    with engine.begin() as conn:
        auth.lock_session(conn, principal)
        conn.execute(update(tokens).where(tokens.c.id == token_id, tokens.c.owner_id == principal.owner_id).values(revoked_at=auth.clock(None)))