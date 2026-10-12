"""Partner keys for the A2A endpoint: shown once, stored only as SHA-256 hashes, and revocable without a redeploy."""

from __future__ import annotations

import hmac
import os
import re
import time
from secrets import token_urlsafe
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import insert, select, update

from app import auth

NAME = re.compile(r"[a-z0-9][a-z0-9-]{1,39}")


def create(name: str, owner_id: str) -> dict:
    """Issue a key for a partner; the plain key is returned once and only its hash is kept."""
    if not NAME.fullmatch(name):
        raise HTTPException(422, "Use 2 to 40 lowercase letters, digits or hyphens, starting with a letter or digit")
    key = token_urlsafe(32)
    row = {"id": str(uuid4()), "name": name, "key_hash": auth.digest(key), "created_by": owner_id, "created_at": int(time.time())}
    with auth.engine().begin() as conn:
        conn.execute(insert(auth.partner_keys).values(**row))
    return {"id": row["id"], "name": name, "key": key, "created_at": row["created_at"], "last_used_at": None, "revoked_at": None}


def listing() -> list[dict]:
    table = auth.partner_keys
    with auth.engine().connect() as conn:
        rows = conn.execute(select(table.c.id, table.c.name, table.c.created_at, table.c.last_used_at, table.c.revoked_at).order_by(table.c.created_at.desc())).all()
    return [dict(row._mapping) for row in rows]


def revoke(key_id: str) -> None:
    table = auth.partner_keys
    with auth.engine().begin() as conn:
        changed = conn.execute(update(table).where(table.c.id == key_id, table.c.revoked_at.is_(None)).values(revoked_at=int(time.time()))).rowcount
    if not changed:
        raise HTTPException(404, "No active partner key with that id")


def partner_for(key: str) -> str | None:
    """Partner name for an API key: an active key issued on the operator page, or an entry in A2A_PARTNER_KEYS (name:hash)."""
    if not key:
        return None
    digest = auth.digest(key)
    table = auth.partner_keys
    with auth.engine().begin() as conn:
        row = conn.execute(select(table.c.id, table.c.name).where(table.c.key_hash == digest, table.c.revoked_at.is_(None))).first()
        if row is not None:
            conn.execute(update(table).where(table.c.id == row.id).values(last_used_at=int(time.time())))
            return row.name
    for entry in os.getenv("A2A_PARTNER_KEYS", "").split(","):
        name, separator, expected = entry.strip().partition(":")
        if name and separator and hmac.compare_digest(digest, expected):
            return name
    return None
