import base64
from hashlib import sha256
import json
from secrets import token_urlsafe

from cryptography.exceptions import InvalidSignature
from fastapi import HTTPException
from sqlalchemy import BigInteger, Column, String, Table, delete, insert, select
from sqlalchemy.exc import IntegrityError

from app import auth


nonces = Table("broker_nonces", auth.metadata, Column("id", String, primary_key=True), Column("expires_at", BigInteger, nullable=False))


def encode(value):
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def decode(value):
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def sign(private_key, caller, method, path, session_id, body, now=None):
    now = auth.clock(now)
    payload = {"caller": caller, "audience": "imaarat-broker", "method": method, "path": path, "session_id": session_id, "body_hash": sha256(body).hexdigest(), "nonce": token_urlsafe(32), "issued_at": now, "expires_at": now + 30}
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return {"X-Imaarat-Envelope": encode(encoded), "X-Imaarat-Signature": encode(private_key.sign(encoded))}


def verify(engine, keys, headers, method, path, body, now=None):
    now = auth.clock(now)
    try:
        value = headers.get("X-Imaarat-Envelope", "")
        signature = headers.get("X-Imaarat-Signature", "")
        if len(value) > 4096 or len(signature) > 128:
            raise ValueError()
        encoded = decode(value)
        payload = json.loads(encoded)
        key = keys[payload["caller"]]
        key.verify(decode(signature), encoded)
        if payload["caller"] != "api" or payload["audience"] != "imaarat-broker" or payload["method"] != method or payload["path"] != path or payload["body_hash"] != sha256(body).hexdigest() or type(payload["issued_at"]) is not int or type(payload["expires_at"]) is not int or not payload["issued_at"] <= now < payload["expires_at"] <= payload["issued_at"] + 30 or len(payload["nonce"]) != 43:
            raise ValueError()
    except (ValueError, TypeError, KeyError, InvalidSignature):
        raise HTTPException(401, "broker_auth_invalid") from None
    try:
        with engine.begin() as conn:
            conn.execute(delete(nonces).where(nonces.c.id.in_(select(nonces.c.id).where(nonces.c.expires_at <= now).limit(100))))
            row = conn.execute(select(auth.sessions, auth.users.c.role, auth.users.c.disabled_at).join(auth.users).where(auth.sessions.c.id == payload["session_id"])).one_or_none()
            if row is None or row.revoked_at is not None or row.disabled_at is not None or now >= row.expires_at or now - row.last_seen >= 1800:
                raise HTTPException(401, "broker_session_invalid")
            principal = auth.principal_from(row)
            auth.require_recent_auth(principal, now)
            if "connection:write" not in principal.scopes:
                raise HTTPException(403, "scope_required")
            auth.reserve_identity(conn, "broker:" + principal.owner_id, now, 30)
            conn.execute(insert(nonces).values(id=payload["nonce"], expires_at=payload["expires_at"]))
        return principal
    except IntegrityError:
        raise HTTPException(401, "broker_replay_denied") from None