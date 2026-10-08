"""Daily AI budget: per-visitor and global admissions plus every Gemini call, reserved atomically before use."""

from __future__ import annotations

import hashlib
import os
from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import Column, DateTime, Integer, String, Table, func, select, update
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app import config
from app.db import get_engine, is_postgres, metadata

PACIFIC = ZoneInfo("America/Los_Angeles")
UNCAPPED_STAGES = {"embed", "count_tokens"}
SIGN_IN_NOTE = "Sign in to use the AI"
INTEROP_NOTE = "AI summaries run in the web app; MCP and A2A return the rule-engine decision"
_ready_engines: set[str] = set()

counters = Table(
    "ai_budget_counters",
    metadata,
    Column("day", String(10), primary_key=True),
    Column("scope", String(80), primary_key=True),
    Column("used", Integer, nullable=False),
)

usage = Table(
    "ai_usage",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("day", String(10), nullable=False, index=True),
    Column("stage", String(40), nullable=False),
    Column("model", String(80)),
    Column("status", String(20), nullable=False),
    Column("input_tokens", Integer),
    Column("output_tokens", Integer),
    Column("latency_ms", Integer),
    Column("created_at", DateTime(timezone=True), nullable=False),
)


class BudgetExceeded(Exception):
    def __init__(self, scope: str, retry_after: int):
        super().__init__(f"AI budget reached for {scope}")
        self.scope = scope
        self.retry_after = retry_after


def limits() -> dict[str, int]:
    return {
        "admissions": config.AI_DAILY_ADMISSIONS,
        "client_admissions": config.AI_CLIENT_DAILY_ADMISSIONS,
        "calls": config.AI_DAILY_CALLS,
        "generations": config.AI_DAILY_GENERATIONS,
        "minute_generations": config.AI_MINUTE_GENERATIONS,
    }


def budget_day(now: datetime | None = None) -> str:
    return (now or datetime.now(UTC)).astimezone(PACIFIC).date().isoformat()


def seconds_until_reset(now: datetime | None = None) -> int:
    local = (now or datetime.now(UTC)).astimezone(PACIFIC)
    midnight = datetime.combine(local.date() + timedelta(days=1), datetime.min.time(), tzinfo=PACIFIC)
    return max(1, int((midnight - local).total_seconds()))


def shared_store() -> bool:
    return is_postgres() or not os.getenv("VERCEL")


def ai_ready() -> tuple[bool, str | None]:
    if not config.AI_API_KEY:
        return False, "AI is not configured on this deployment"
    if not shared_store():
        return False, "AI needs a shared budget database on this deployment"
    return True, None


def admission_note(address: str | None) -> str | None:
    ready, reason = ai_ready()
    if not ready:
        return reason
    try:
        admit(address)
    except BudgetExceeded as exceeded:
        hours, minutes = divmod(exceeded.retry_after // 60, 60)
        return f"Daily AI limit reached for {exceeded.scope}; resets in {hours}h {minutes}m"
    return None


def client_address(headers: Any, fallback: str | None) -> str | None:
    forwarded = headers.get("x-forwarded-for", "")
    return forwarded.split(",")[0].strip() or fallback


def client_scope(address: str | None, now: datetime | None = None) -> str:
    digest = hashlib.sha256(f"{budget_day(now)}:{address or 'unknown'}".encode()).hexdigest()[:16]
    return f"client:{digest}"


def engine() -> Any:
    current = get_engine()
    if str(current.url) not in _ready_engines:
        metadata.create_all(current, tables=[counters, usage])
        _ready_engines.add(str(current.url))
    return current


def _reserve(connection: Any, day: str, scope: str, amount: int, limit: int) -> bool:
    insert = postgres_insert if is_postgres() else sqlite_insert
    connection.execute(insert(counters).values(day=day, scope=scope, used=0).on_conflict_do_nothing())
    result = connection.execute(update(counters).where(counters.c.day == day, counters.c.scope == scope, counters.c.used + amount <= limit).values(used=counters.c.used + amount))
    return result.rowcount == 1


def admit(address: str | None, now: datetime | None = None) -> None:
    day = budget_day(now)
    with engine().begin() as connection:
        if not _reserve(connection, day, "admissions", 1, limits()["admissions"]):
            raise BudgetExceeded("all visitors", seconds_until_reset(now))
        if not _reserve(connection, day, client_scope(address, now), 1, limits()["client_admissions"]):
            raise BudgetExceeded("this visitor", seconds_until_reset(now))


def reserve_call(stage: str, now: datetime | None = None) -> int:
    current = now or datetime.now(UTC)
    day = budget_day(current)
    with engine().begin() as connection:
        if stage not in UNCAPPED_STAGES:
            if not _reserve(connection, day, f"minute:{current.astimezone(UTC):%H:%M}", 1, limits()["minute_generations"]):
                raise BudgetExceeded("this minute", 60 - current.second)
            if not _reserve(connection, day, "generations", 1, limits()["generations"]):
                raise BudgetExceeded("AI generations", seconds_until_reset(current))
        if not _reserve(connection, day, "calls", 1, limits()["calls"]):
            raise BudgetExceeded("AI calls", seconds_until_reset(current))
        return connection.execute(usage.insert().values(day=day, stage=stage, status="reserved", created_at=current)).inserted_primary_key[0]


def finish_call(call_id: int, status: str, model: str | None = None, input_tokens: int | None = None, output_tokens: int | None = None, latency_ms: int | None = None) -> None:
    with engine().begin() as connection:
        connection.execute(update(usage).where(usage.c.id == call_id).values(status=status, model=model, input_tokens=input_tokens, output_tokens=output_tokens, latency_ms=latency_ms))


def remaining(now: datetime | None = None) -> dict[str, Any]:
    day = budget_day(now)
    with engine().connect() as connection:
        used = dict(connection.execute(select(counters.c.scope, counters.c.used).where(counters.c.day == day, counters.c.scope.in_(["admissions", "calls", "generations"]))).all())
        tokens = connection.execute(select(func.coalesce(func.sum(usage.c.input_tokens), 0), func.coalesce(func.sum(usage.c.output_tokens), 0)).where(usage.c.day == day)).one()
    caps = limits()
    return {
        "day": day,
        "resets_in_seconds": seconds_until_reset(now),
        "admissions_left": max(0, caps["admissions"] - used.get("admissions", 0)),
        "calls_left": max(0, caps["calls"] - used.get("calls", 0)),
        "generations_left": max(0, caps["generations"] - used.get("generations", 0)),
        "per_visitor_admissions": caps["client_admissions"],
        "tokens_today": {"input": int(tokens[0]), "output": int(tokens[1])},
        "shared_store": shared_store(),
    }
