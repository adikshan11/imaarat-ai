"""Extract: copy the operational tables (Postgres or SQLite) into Parquet files in pipeline/lake/."""

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / "backend"))

from app.db import get_engine, init_db, properties, seed_demo_database, submissions  # noqa: E402
from sqlalchemy import select  # noqa: E402

LAKE = ROOT / "lake"


def export(table, name: str) -> int:
    with get_engine().connect() as conn:
        rows = [dict(row._mapping) for row in conn.execute(select(table))]
    LAKE.mkdir(exist_ok=True)
    with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False, encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, default=str) + "\n")
    duckdb.sql(f"COPY (SELECT * FROM read_json_auto('{handle.name}', format='newline_delimited')) TO '{LAKE / name}.parquet' (FORMAT parquet)")
    Path(handle.name).unlink()
    return len(rows)


def main() -> None:
    seed_demo_database()
    init_db()
    print(f"submissions: {export(submissions, 'submissions')} rows")
    print(f"reference_properties: {export(properties, 'reference_properties')} rows")


if __name__ == "__main__":
    main()
