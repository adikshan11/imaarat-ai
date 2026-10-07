"""Submission and reference-property storage: Postgres when DATABASE_URL is set, SQLite otherwise."""

from __future__ import annotations

import csv
import json
import os
import re
import shutil
import time
from datetime import UTC, datetime
from operator import itemgetter
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
from app.tools.hazard_lookup import hazard_flags
from app.tools.hazard_lookup import lookup as hazard_lookup

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
    Column("claim_owner", Text),
    Column("claim_name", Text),
    Column("claim_expires", Integer),
    Column("created_at", Text, server_default=func.current_timestamp()),
)

REVIEW_COLUMNS = {
    "review_status": "TEXT NOT NULL DEFAULT 'not_required'",
    "final_decision": "TEXT",
    "reviewer": "TEXT",
    "review_note": "TEXT",
    "reviewed_at": "TEXT",
    "thread_id": "TEXT",
    "claim_owner": "TEXT",
    "claim_name": "TEXT",
    "claim_expires": "INTEGER",
}
CLAIM_SECONDS = 1800

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
        conn.execute(update(submissions).where(submissions.c.id == submission_id).values(result_json=json.dumps(state_with_id, ensure_ascii=False, default=str)))
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


def open_to(owner_id: str, now: int) -> Any:
    """A referral this reviewer may act on: still pending, and unclaimed, claimed by them, or with an expired claim."""
    unclaimed = submissions.c.claim_owner.is_(None) | (submissions.c.claim_expires <= now) | (submissions.c.claim_owner == owner_id)
    return (submissions.c.review_status == "pending_review") & unclaimed


def conflict(conn: Any, submission_id: int, now: int) -> str:
    row = conn.execute(select(submissions.c.review_status, submissions.c.reviewer, submissions.c.claim_name, submissions.c.claim_expires).where(submissions.c.id == submission_id)).one()
    if row.review_status != "pending_review":
        return f"This referral was already decided by {row.reviewer or 'another reviewer'}."
    until = datetime.fromtimestamp(row.claim_expires, UTC).strftime("%H:%M")
    return f"{row.claim_name or 'Another reviewer'} is reviewing this referral until {until} UTC."


def claim_review(submission_id: int, owner_id: str, name: str, now: int) -> str | None:
    """Hold a pending referral for one reviewer for 30 minutes; returns why not when someone else holds or decided it."""
    with get_engine().begin() as conn:
        claim = {"claim_owner": owner_id, "claim_name": name, "claim_expires": now + CLAIM_SECONDS}
        if conn.execute(update(submissions).where(submissions.c.id == submission_id, open_to(owner_id, now)).values(claim)).rowcount:
            return None
        return conflict(conn, submission_id, now)


def release_claim(submission_id: int, owner_id: str) -> None:
    with get_engine().begin() as conn:
        conn.execute(update(submissions).where(submissions.c.id == submission_id, submissions.c.claim_owner == owner_id).values(claim_owner=None, claim_name=None, claim_expires=None))


def record_review(submission_id: int, final_decision: str, owner_id: str, reviewer: str, note: str, review_status: str, now: int) -> str | None:
    """Save the decision only if the referral is still pending and not held by someone else, in one conditional update."""
    review = {
        "review_status": review_status,
        "final_decision": final_decision,
        "reviewer": reviewer,
        "review_note": note,
        "reviewed_at": datetime.now(UTC).isoformat(timespec="seconds"),
    }
    with get_engine().begin() as conn:
        released = {"claim_owner": None, "claim_name": None, "claim_expires": None}
        if not conn.execute(update(submissions).where(submissions.c.id == submission_id, open_to(owner_id, now)).values(**review, **released)).rowcount:
            return conflict(conn, submission_id, now)
        row = conn.execute(select(submissions.c.result_json).where(submissions.c.id == submission_id)).one()
        conn.execute(update(submissions).where(submissions.c.id == submission_id).values(result_json=json.dumps({**_loads(row.result_json, {}), **review}, ensure_ascii=False, default=str)))
    return None


def address_key(address: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(address or "").lower())


def find_duplicates(address: str | None, zip_code: str | None, limit: int = 5) -> list[dict[str, Any]]:
    """Earlier assessments of the same address and PIN code, newest first."""
    key = address_key(address)
    pin = str(zip_code or "").strip()
    if not key or not pin:
        return []
    query = select(submissions.c.id, submissions.c.property_id, submissions.c.decision, submissions.c.final_decision, submissions.c.raw_input, submissions.c.created_at)
    with get_engine().connect() as conn:
        rows = conn.execute(query.order_by(submissions.c.id.desc())).all()
    matches = []
    for row in rows:
        raw_input = _loads(row.raw_input, {})
        if str(raw_input.get("zip") or "").strip() == pin and address_key(raw_input.get("address")) == key:
            matches.append({"id": row.id, "property_id": row.property_id, "decision": row.final_decision or row.decision, "created_at": str(row.created_at)})
    return matches[:limit]


def history_row(row: Any) -> dict[str, Any]:
    raw_input = _loads(row.raw_input, {})
    return {
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


def fetch_history() -> list[dict[str, Any]]:
    with get_engine().connect() as conn:
        rows = conn.execute(select(submissions).order_by(submissions.c.id.desc())).all()
    return [history_row(row) for row in rows]


def insured_value(raw_input: dict[str, Any]) -> float:
    try:
        return float(raw_input.get("total_value_at_risk_inr", raw_input.get("tiv")) or 0)
    except (TypeError, ValueError):
        return 0.0


def sort_value(row: Any, raw_input: dict[str, Any], sort: str) -> Any:
    if sort == "property":
        return row.property_id
    if sort == "location":
        return f"{raw_input.get('city', '')} {raw_input.get('state', '')}"
    if sort == "score":
        return row.risk_score or 0
    if sort == "value":
        return insured_value(raw_input)
    return row.id


def history_page(limit: int, offset: int, decision: str | None, query: str | None, sort: str, direction: str) -> tuple[list[dict[str, Any]], int]:
    lean = select(submissions.c.id, submissions.c.property_id, submissions.c.decision, submissions.c.risk_score, submissions.c.raw_input)
    if decision:
        lean = lean.where(submissions.c.decision == decision)
    with get_engine().connect() as conn:
        rows = [(row, _loads(row.raw_input, {})) for row in conn.execute(lean).all()]
    if query:
        needle = query.lower()
        rows = [(row, raw) for row, raw in rows if needle in f"{row.property_id} {raw.get('address', '')} {raw.get('city', '')}".lower()]
    ranked = sorted(((sort_value(row, raw, sort), row.id) for row, raw in rows), reverse=direction != "asc")
    ids = [submission_id for _, submission_id in ranked[offset : offset + limit]]
    if not ids:
        return [], len(rows)
    with get_engine().connect() as conn:
        full = {row.id: history_row(row) for row in conn.execute(select(submissions).where(submissions.c.id.in_(ids))).all()}
    return [full[submission_id] for submission_id in ids], len(rows)


def portfolio_summary() -> dict[str, Any]:
    lean = select(submissions.c.decision, submissions.c.risk_score, submissions.c.review_status, submissions.c.risk_flags, submissions.c.raw_input, submissions.c.prototype_mitigation_model)
    with get_engine().connect() as conn:
        rows = conn.execute(lean).all()
    decisions: dict[str, int] = {}
    drivers: dict[str, int] = {}
    bands = {"Accept": 0, "Refer": 0, "Decline (mitigation possible)": 0, "Auto-Decline": 0}
    totals = {"value": 0.0, "sprinklers": 0, "fire_alarm": 0, "flood_protection": 0, "mitigation": 0.0, "pending": 0, "score": 0}
    hazards = {"pincode_matched": 0, "declared_seismic_zone_below_official": 0, "flood_history_at_pincode": 0, "imd_cyclone_prone_district": 0}
    for row in rows:
        raw_input = _loads(row.raw_input, {})
        official = hazard_lookup(raw_input.get("zip"))
        hazards["pincode_matched"] += official is not None
        for flag in hazard_flags(official, raw_input.get("seismic_zone")):
            hazards[flag] += 1
        score = row.risk_score or 0
        decisions[row.decision] = decisions.get(row.decision, 0) + 1
        for flag in _flags(row.risk_flags):
            drivers[flag] = drivers.get(flag, 0) + 1
        band = "Accept" if score <= 30 else "Refer" if score <= 60 else "Decline (mitigation possible)" if score <= 84 else "Auto-Decline"
        bands[band] += 1
        totals["score"] += score
        totals["pending"] += row.review_status == "pending_review"
        totals["value"] += insured_value(raw_input)
        totals["sprinklers"] += str(raw_input.get("sprinkler_system")).upper() == "Y"
        totals["fire_alarm"] += raw_input.get("fire_alarm") is True
        totals["flood_protection"] += raw_input.get("flood_protection") is True
        totals["mitigation"] += float(_loads(row.prototype_mitigation_model, {}).get("mitigation_benefit") or 0)
    return {
        "submissions": len(rows),
        "average_score": round(totals["score"] / len(rows)) if rows else 0,
        "pending_review": totals["pending"],
        "total_value_inr": totals["value"],
        "with_sprinklers": totals["sprinklers"],
        "with_fire_alarm": totals["fire_alarm"],
        "with_flood_protection": totals["flood_protection"],
        "mitigation_benefit": totals["mitigation"],
        "decisions": decisions,
        "bands": bands,
        "top_drivers": sorted(drivers.items(), key=itemgetter(1), reverse=True)[:5],
        "hazard_checks": hazards,
    }


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
    held = row.review_status == "pending_review" and row.claim_owner and row.claim_expires > time.time()
    detail["claimed_by"] = row.claim_name if held else None
    detail["claimed_until"] = datetime.fromtimestamp(row.claim_expires, UTC).isoformat(timespec="seconds") if held else None
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
