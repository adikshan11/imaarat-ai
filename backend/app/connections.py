from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import Column, ForeignKey, Integer, String, Table, insert, select, update

from app import auth


connections = Table("connections", auth.metadata,
    Column("id", String, primary_key=True),
    Column("owner_id", String, ForeignKey("users.id"), nullable=False),
    Column("provider", String, nullable=False),
    Column("data_policy", String, nullable=False),
    Column("suffix", String),
    Column("state", String, nullable=False),
    Column("secret_version", Integer, nullable=False, default=0),
    Column("pending_version", Integer),
    Column("pending_suffix", String),
    Column("latest_version", Integer, nullable=False, default=0),
    Column("version", Integer, nullable=False, default=1),
    Column("operation", String),
)


def connection_view(row):
    return {key: row._mapping[key] for key in ("id", "owner_id", "provider", "data_policy", "suffix", "state", "secret_version", "pending_version", "version", "operation")} | {"capabilities": []}


class ConnectionService:
    def __init__(self, engine, vault):
        self.engine = engine
        self.vault = vault

    def member(self, conn, principal):
        auth.require_recent_auth(principal)
        if "connection:write" not in principal.scopes:
            raise HTTPException(403, "scope_required")
        user = conn.execute(select(auth.users).where(auth.users.c.id == principal.owner_id).with_for_update()).one_or_none()
        if user is None or user.disabled_at is not None or user.role not in {"member", "reviewer", "operator"}:
            raise HTTPException(403, "member_required")

    def credential(self, value):
        if not isinstance(value, str) or not 16 <= len(value) <= 512 or any(not 33 <= ord(char) <= 126 for char in value):
            raise HTTPException(422, "credential_invalid")
        return value

    def list(self, principal):
        if principal.role == "guest":
            raise HTTPException(403, "member_required")
        with self.engine.connect() as conn:
            rows = conn.execute(select(connections).where(connections.c.owner_id == principal.owner_id, connections.c.state != "deleted").order_by(connections.c.id).limit(100)).all()
        return [connection_view(row) for row in rows]

    def owned(self, conn, principal, connection_id, expected=None):
        row = conn.execute(select(connections).where(connections.c.id == connection_id, connections.c.owner_id == principal.owner_id).with_for_update()).one_or_none()
        if row is None or row.state == "deleted":
            raise HTTPException(404, "not_found")
        if expected is not None and (type(expected) is not int or row.version != expected):
            raise HTTPException(409, "connection_version_conflict")
        return row

    def create(self, principal, credential, provider):
        credential = self.credential(credential)
        if provider != "gemini":
            raise HTTPException(422, "provider_invalid")
        connection_id = str(uuid4())
        with self.engine.begin() as conn:
            self.member(conn, principal)
            rows = conn.execute(select(connections.c.id).where(connections.c.owner_id == principal.owner_id, connections.c.state != "deleted")).all()
            if len(rows) >= 10:
                raise HTTPException(429, "connection_limit")
            conn.execute(insert(connections).values(id=connection_id, owner_id=principal.owner_id, provider=provider, data_policy="synthetic", state="provisioning", operation="create"))
        version = self.vault.write(principal.owner_id, connection_id, credential, 0)
        with self.engine.begin() as conn:
            row = self.owned(conn, principal, connection_id)
            if row.operation != "create" or row.state != "provisioning":
                raise HTTPException(409, "connection_operation_conflict")
            conn.execute(update(connections).where(connections.c.id == connection_id).values(secret_version=version, latest_version=version, suffix=credential[-4:], state="unverified", operation=None))
            return connection_view(self.owned(conn, principal, connection_id))

    def replace(self, principal, connection_id, expected, credential):
        credential = self.credential(credential)
        with self.engine.begin() as conn:
            self.member(conn, principal)
            row = self.owned(conn, principal, connection_id, expected)
            if row.operation is not None or row.pending_version is not None or row.state not in {"unverified", "active"}:
                raise HTTPException(409, "connection_operation_conflict")
            latest = row.latest_version
            conn.execute(update(connections).where(connections.c.id == connection_id, connections.c.version == expected).values(operation="replace", version=expected + 1))
        version = self.vault.write(principal.owner_id, connection_id, credential, latest)
        with self.engine.begin() as conn:
            row = self.owned(conn, principal, connection_id, expected + 1)
            if row.operation != "replace":
                raise HTTPException(409, "connection_operation_conflict")
            conn.execute(update(connections).where(connections.c.id == connection_id).values(latest_version=version, pending_version=version, pending_suffix=credential[-4:], operation=None))
            return connection_view(self.owned(conn, principal, connection_id))

    def disable(self, principal, connection_id, expected):
        with self.engine.begin() as conn:
            self.member(conn, principal)
            row = self.owned(conn, principal, connection_id, expected)
            if row.operation is not None:
                conn.execute(update(connections).where(connections.c.id == connection_id).values(state="disabled"))
            else:
                conn.execute(update(connections).where(connections.c.id == connection_id).values(state="disabled", version=expected + 1))
            return connection_view(self.owned(conn, principal, connection_id))

    def delete(self, principal, connection_id, expected):
        with self.engine.begin() as conn:
            self.member(conn, principal)
            row = self.owned(conn, principal, connection_id, expected)
            if row.operation not in {None, "delete"}:
                raise HTTPException(409, "connection_operation_conflict")
            conn.execute(update(connections).where(connections.c.id == connection_id).values(state="pending_delete", operation="delete"))
        self.vault.destroy(principal.owner_id, connection_id)
        with self.engine.begin() as conn:
            self.owned(conn, principal, connection_id, expected)
            conn.execute(update(connections).where(connections.c.id == connection_id).values(state="deleted", operation=None, suffix=None, pending_suffix=None, pending_version=None, version=expected + 1))
            return connection_view(self.owned_deleted(conn, principal, connection_id))

    def owned_deleted(self, conn, principal, connection_id):
        return conn.execute(select(connections).where(connections.c.id == connection_id, connections.c.owner_id == principal.owner_id)).one()