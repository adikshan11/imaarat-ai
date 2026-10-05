from hashlib import sha256
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.engine import Engine


class MigrationError(ValueError):
    pass


def apply_migrations(engine: Engine) -> list[str]:
    if engine.dialect.name != "postgresql":
        raise MigrationError("migration_postgres_required")
    files = sorted((Path(__file__).resolve().parents[1] / "migrations").glob("*.sql"))
    if not files:
        raise MigrationError("migration_files_missing")
    revisions = {path.stem: (path.read_text(encoding="utf-8"), sha256(path.read_bytes()).hexdigest()) for path in files}
    applied = []
    with engine.begin() as conn:
        conn.execute(text("SELECT pg_advisory_xact_lock(748213905)"))
        conn.execute(text("CREATE TABLE IF NOT EXISTS schema_migrations (revision TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)"))
        existing = {row.revision: row.checksum for row in conn.execute(text("SELECT revision, checksum FROM schema_migrations"))}
        for revision, checksum in existing.items():
            if revision not in revisions:
                raise MigrationError("migration_revision_unknown")
            if revisions[revision][1] != checksum:
                raise MigrationError("migration_checksum_mismatch")
        for revision, (sql, checksum) in revisions.items():
            if revision not in existing:
                conn.exec_driver_sql(sql)
                conn.execute(text("INSERT INTO schema_migrations (revision, checksum) VALUES (:revision, :checksum)"), {"revision": revision, "checksum": checksum})
                applied.append(revision)
    return applied