"""Publish: snapshot the dbt marts as one JSON document for the API (file + Postgres when configured)."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / "backend"))

from sqlalchemy import Column, Integer, MetaData, Table, Text, insert  # noqa: E402

from app.db import get_engine, is_postgres  # noqa: E402

MARTS = ("mart_cat_exposure", "mart_city_accumulation", "mart_risk_drivers", "mart_review_funnel", "mart_reference_benchmarks", "mart_hazard_verification")
OUTPUT = ROOT.parent / "backend" / "data" / "analytics" / "latest.json"


def snapshot() -> dict:
    with duckdb.connect(str(ROOT / "warehouse.duckdb"), read_only=True) as conn:
        marts = {}
        for name in MARTS:
            relation = conn.sql(f"select * from {name}")
            marts[name] = [dict(zip(relation.columns, row)) for row in relation.fetchall()]
        assessments = conn.sql("select count(*), sum(tiv_inr) from fct_assessments").fetchone()
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "assessments": assessments[0],
        "tiv_inr": assessments[1],
        "marts": marts,
    }


def main() -> None:
    document = snapshot()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(document, indent=2, default=str), encoding="utf-8")
    print(f"wrote {OUTPUT}")
    if is_postgres():
        table = Table("analytics_snapshots", MetaData(), Column("id", Integer, primary_key=True, autoincrement=True), Column("generated_at", Text), Column("payload", Text))
        table.create(get_engine(), checkfirst=True)
        with get_engine().begin() as conn:
            conn.execute(insert(table).values(generated_at=document["generated_at"], payload=json.dumps(document, default=str)))
        print("stored snapshot in Postgres analytics_snapshots")


if __name__ == "__main__":
    main()
