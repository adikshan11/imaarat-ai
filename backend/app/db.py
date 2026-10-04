"""Submission and reference-property storage: Postgres when DATABASE_URL is set, SQLite otherwise."""

from __future__ import annotations

import csv
import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import (
    Column,
    Float,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    func,
    insert,
    inspect,
    select,
    text,
    update,
)
from sqlalchemy.engine import Engine

from app.config import DB_PATH, DEMO_DB_PATH, PROPERTIES_CSV

metadata = MetaData()

properties = Table(
    "properties",
    metadata,
    Column("property_id", String, primary_key=True),
    Column("address", Text),
    Column("city", Text),
    Column("state", Text),
    Column("zip", Text),
    Column("latitude", Float),
    Column("longitude", Float),
    Column("construction_type", Text),
    Column("year_built", Integer),
    Column("roof_type", Text),
    Column("roof_age_years", Integer),
    Column("square_footage", Integer),
    Column("occupancy_type", Text),
    Column("num_stories", Integer),
    Column("sprinkler_system", Text),
    Column("cat_zone", Text),
    Column("distance_to_coast_miles", Float),
    Column("distance_to_fire_zone_miles", Float),
    Column("prior_claims_count_5yr", Integer),
    Column("prior_claims_total_amount", Float),
    Column("tiv", Float),
    Column("submission_date", Text),
)

submissions = Table(
    "submissions",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("property_id", Text, nullable=False),
    Column("raw_input", Text, nullable=False),
    Column("decision", Text),
    Column("risk_score", Integer),
    Column("risk_flags", Text),
    Column("risk_breakdown", Text),
    Column("prototype_mitigation_model", Text),
    Column("memo_json", Text),
    Column("memo_markdown", Text),
    Column("result_json", Text),
    Column("record_type", Text, nullable=False, server_default="production"),
    Column("review_status", Text, nullable=False, server_default="not_required"),
    Column("final_decision", Text),
    Column("reviewer", Text),
    Column("review_note", Text),
    Column("reviewed_at", Text),
    Column("thread_id", Text),
    Column("created_at", Text, server_default=func.current_timestamp()),
)

REVIEW_COLUMNS = {
    "review_status": "TEXT NOT NULL DEFAULT 'not_required'",
    "final_decision": "TEXT",
    "reviewer": "TEXT",
    "review_note": "TEXT",
    "reviewed_at": "TEXT",
    "thread_id": "TEXT",
}

_engines: dict[str, Engine] = {}
_ready: set[str] = set()


def database_url() -> str:
    url = os.getenv("DATABASE_URL", "")
    if url:
        return url.replace("postgres://", "postgresql+psycopg://", 1).replace("postgresql://", "postgresql+psycopg://", 1)
    return f"sqlite:///{DB_PATH}"


def get_engine() -> Engine:
    url = database_url()
    if url not in _engines:
        if url.startswith("sqlite"):
            DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        _engines[url] = create_engine(url, pool_pre_ping=True)
    return _engines[url]


def is_postgres() -> bool:
    return get_engine().dialect.name == "postgresql"


def _parse(value: str | None, cast: type) -> Any:
    if value is None or value.strip() == "":
        return None
    try:
        return cast(float(value)) if cast is int else cast(value)
    except (TypeError, ValueError):
        return None


def seed_properties_from_csv() -> None:
    if not PROPERTIES_CSV.exists():
        return
    engine = get_engine()
    with engine.begin() as conn:
        if conn.execute(select(func.count()).select_from(properties)).scalar():
            return
        with PROPERTIES_CSV.open("r", encoding="utf-8", newline="") as csvfile:
            rows = []
            for row in csv.DictReader(csvfile):
                record = {}
                for column in properties.columns:
                    value = row.get(column.name)
                    if isinstance(column.type, Float):
                        record[column.name] = _parse(value, float)
                    elif isinstance(column.type, Integer):
                        record[column.name] = _parse(value, int)
                    else:
                        record[column.name] = value
                rows.append(record)
        conn.execute(insert(properties), rows)


def seed_demo_database() -> None:
    """Start a fresh database from the bundled demo portfolio."""
    if not DEMO_DB_PATH.exists():
        return
    if not is_postgres():
        if not DB_PATH.exists():
            DB_PATH.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(DEMO_DB_PATH, DB_PATH)
        return
    init_db()
    with get_engine().begin() as conn:
        if conn.execute(select(func.count()).select_from(submissions)).scalar():
            return
        demo = create_engine(f"sqlite:///{DEMO_DB_PATH}")
        with demo.connect() as source:
            demo_columns = {column["name"] for column in inspect(demo).get_columns("submissions")}
            rows = [dict(row._mapping) for row in source.execute(text("SELECT * FROM submissions ORDER BY id"))]
        for row in rows:
            conn.execute(insert(submissions).values({key: value for key, value in row.items() if key in demo_columns and key != "id"}))


def ensure_submission_columns() -> None:
    engine = get_engine()
    existing = {column["name"] for column in inspect(engine).get_columns("submissions")}
    with engine.begin() as conn:
        for name, definition in {
            "prototype_mitigation_model": "TEXT",
            "result_json": "TEXT",
            "memo_json": "TEXT",
            "record_type": "TEXT NOT NULL DEFAULT 'production'",
            **REVIEW_COLUMNS,
        }.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE submissions ADD COLUMN {name} {definition}"))


def init_db() -> None:
    url = database_url()
    if url in _ready:
        return
    metadata.create_all(get_engine())
    ensure_submission_columns()
    seed_properties_from_csv()
    _ready.add(url)


def _loads(value: str | None, default: Any) -> Any:
    try:
        return json.loads(value) if value else default
    except Exception:
        return default


def _flags(value: str | None) -> list[str]:
    return [flag.strip() for flag in str(value or "").split(",") if flag.strip()]


def save_submission(state: dict[str, Any]) -> dict[str, Any]:
    payload = state.get("raw_input", {})
    values = {
        "property_id": state.get("property_id", payload.get("property_id", "")),
        "raw_input": json.dumps(payload, ensure_ascii=False, default=str),
        "decision": state.get("decision", ""),
        "risk_score": state.get("risk_score", 0),
        "risk_flags": ", ".join(state.get("risk_flags", [])),
        "risk_breakdown": json.dumps(state.get("risk_breakdown", {}), ensure_ascii=False),
        "prototype_mitigation_model": json.dumps(state.get("prototype_mitigation_model", {}), ensure_ascii=False),
        "memo_json": json.dumps(state.get("memo_json", {}), ensure_ascii=False),
        "record_type": state.get("record_type", "production"),
        "review_status": state.get("review_status", "not_required"),
        "final_decision": state.get("final_decision"),
        "thread_id": state.get("thread_id"),
    }
    with get_engine().begin() as conn:
        submission_id = conn.execute(insert(submissions).values(values).returning(submissions.c.id)).scalar_one()
        state_with_id = {**state, "id": submission_id}
        conn.execute(
            update(submissions)
            .where(submissions.c.id == submission_id)
            .values(result_json=json.dumps(state_with_id, ensure_ascii=False, default=str))
        )
    return {
        "id": submission_id,
        "property_id": values["property_id"],
        "decision": values["decision"],
        "risk_score": values["risk_score"],
        "risk_flags": state.get("risk_flags", []),
        "risk_breakdown": state.get("risk_breakdown", {}),
        "prototype_mitigation_model": state.get("prototype_mitigation_model", {}),
        "memo_json": state.get("memo_json", {}),
    }


def record_review(submission_id: int, final_decision: str, reviewer: str, note: str, review_status: str) -> None:
    with get_engine().begin() as conn:
        row = conn.execute(select(submissions.c.result_json).where(submissions.c.id == submission_id)).first()
        detail = _loads(row.result_json if row else None, {})
        review = {
            "review_status": review_status,
            "final_decision": final_decision,
            "reviewer": reviewer,
            "review_note": note,
            "reviewed_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
        conn.execute(
            update(submissions)
            .where(submissions.c.id == submission_id)
            .values(**review, result_json=json.dumps({**detail, **review}, ensure_ascii=False, default=str))
        )


def fetch_history() -> list[dict[str, Any]]:
    with get_engine().connect() as conn:
        rows = conn.execute(select(submissions).order_by(submissions.c.id.desc())).all()
    results = []
    for row in rows:
        raw_input = _loads(row.raw_input, {})
        results.append(
            {
                "id": row.id,
                "property_id": row.property_id,
                "raw_input": raw_input,
                "decision": row.decision,
                "risk_score": row.risk_score,
                "risk_flags": _flags(row.risk_flags),
                "risk_breakdown": _loads(row.risk_breakdown, {}),
                "prototype_mitigation_model": _loads(row.prototype_mitigation_model, {}),
                "memo_json": _loads(row.memo_json, {}),
                "record_type": row.record_type,
                "review_status": row.review_status,
                "final_decision": row.final_decision or row.decision,
                "total_value_at_risk_inr": raw_input.get("total_value_at_risk_inr", raw_input.get("tiv")),
                "created_at": str(row.created_at),
            }
        )
    return results


def fetch_submission_detail(submission_id: int) -> dict[str, Any] | None:
    with get_engine().connect() as conn:
        row = conn.execute(select(submissions).where(submissions.c.id == submission_id)).first()
    if row is None:
        return None
    detail: dict[str, Any] = _loads(row.result_json, {})
    raw_input = _loads(row.raw_input, {})
    detail.setdefault("property_id", row.property_id)
    detail.setdefault("raw_input", raw_input)
    detail.setdefault("decision", row.decision)
    detail.setdefault("risk_score", row.risk_score)
    detail.setdefault("risk_flags", _flags(row.risk_flags))
    detail.setdefault("risk_breakdown", _loads(row.risk_breakdown, {}))
    detail.setdefault("prototype_mitigation_model", _loads(row.prototype_mitigation_model, {}))
    detail.setdefault("memo_json", _loads(row.memo_json, {}))
    detail.setdefault("record_type", row.record_type)
    detail.setdefault("extracted_features", {})
    detail.setdefault("guideline_chunks", [])
    detail.setdefault("comparables", [])
    detail.setdefault("rationale", "")
    detail["ai_memo_status"] = "Available" if detail.get("memo_json") else "Unavailable"
    if detail["ai_memo_status"] != "Available":
        detail["ai_memo_reason"] = detail.get("ai_memo_reason") or "Structured AI memo was not stored for this record"
    detail.setdefault("ai_memo_reason", "")
    detail.setdefault("policy_type", raw_input.get("policy_type"))
    detail.setdefault("total_value_at_risk_inr", raw_input.get("total_value_at_risk_inr"))
    detail["review_status"] = row.review_status
    detail["final_decision"] = row.final_decision or row.decision
    detail["reviewer"] = row.reviewer
    detail["review_note"] = row.review_note
    detail["reviewed_at"] = row.reviewed_at
    detail["thread_id"] = row.thread_id
    detail["id"] = row.id
    detail["created_at"] = str(row.created_at)
    return detail


def reference_candidates(filters: dict[str, Any], exclude_id: str | None, limit: int = 50) -> list[dict[str, Any]]:
    query = select(properties)
    for column, value in filters.items():
        query = query.where(properties.c[column] == value)
    if exclude_id:
        query = query.where(properties.c.property_id != exclude_id)
    with get_engine().connect() as conn:
        return [dict(row._mapping) for row in conn.execute(query.limit(limit))]


def backup_and_cleanup_demo_database(backup_path: Path) -> dict[str, Any]:
    """Back up the SQLite database and retain only the canonical TIDEL demo record."""
    init_db()
    backup_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(DB_PATH, backup_path)
    with get_engine().begin() as conn:
        rows = conn.execute(select(submissions.c.id, submissions.c.property_id, submissions.c.result_json).order_by(submissions.c.id.desc())).all()
        before = len(rows)
        canonical_ids: list[int] = []
        for row in rows:
            detail = _loads(row.result_json, {})
            valid_detail = bool(detail.get("property_id") and detail.get("decision") is not None and detail.get("risk_score") is not None)
            if row.property_id == "REAL-IN-TIDEL-001" and valid_detail and not canonical_ids:
                canonical_ids.append(row.id)
        delete_ids = [row.id for row in rows if row.id not in canonical_ids]
        if delete_ids:
            conn.execute(submissions.delete().where(submissions.c.id.in_(delete_ids)))
        if canonical_ids:
            conn.execute(update(submissions).where(submissions.c.id.in_(canonical_ids)).values(record_type="demo"))
        after = conn.execute(select(func.count()).select_from(submissions)).scalar()
    return {"backup_path": str(backup_path), "before": before, "after": after, "retained_ids": canonical_ids, "removed_ids": delete_ids, "timestamp": datetime.now().isoformat()}
