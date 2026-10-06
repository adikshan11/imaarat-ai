"""Request, trace and span telemetry kept in the app database for the public status page: route templates and timings only, never inputs."""

from __future__ import annotations

import os
import random
import statistics
import time
from contextvars import ContextVar
from datetime import datetime, timedelta, timezone
from functools import wraps
from operator import itemgetter
from queue import Empty, SimpleQueue
from threading import Lock, Thread
from typing import Any, Callable

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Table, delete, select

from app.db import get_engine, metadata

RETENTION_DAYS = 14
FLUSH_SECONDS = 2
process_started = time.time()
first_request = {"pending": True}
current_spans: ContextVar[list[dict[str, Any]] | None] = ContextVar("current_spans", default=None)
_ready_engines: set[str] = set()
pending: SimpleQueue = SimpleQueue()
writer = {"started": False}
writer_lock = Lock()
flush_lock = Lock()

requests = Table(
    "ops_requests",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("created_at", DateTime(timezone=True), nullable=False, index=True),
    Column("route", String(120), nullable=False),
    Column("method", String(10), nullable=False),
    Column("status", Integer, nullable=False),
    Column("latency_ms", Integer, nullable=False),
    Column("cold_start", Boolean, nullable=False),
    Column("region", String(20)),
    Column("error_type", String(80)),
)

traces = Table(
    "ops_traces",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("trace_id", String(64), nullable=False, unique=True),
    Column("created_at", DateTime(timezone=True), nullable=False, index=True),
    Column("total_ms", Integer, nullable=False),
    Column("memo_status", String(20)),
    Column("decision", String(40)),
)

spans = Table(
    "ops_spans",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("trace_id", String(64), nullable=False, index=True),
    Column("name", String(60), nullable=False),
    Column("start_ms", Integer, nullable=False),
    Column("duration_ms", Integer, nullable=False),
    Column("status", String(20), nullable=False),
)


def engine() -> Any:
    current = get_engine()
    if str(current.url) not in _ready_engines:
        metadata.create_all(current, tables=[requests, traces, spans])
        _ready_engines.add(str(current.url))
    return current


def add_span(name: str, started: float, ended: float, status: str) -> None:
    collected = current_spans.get()
    if collected is not None:
        collected.append({"name": name, "started": started, "ended": ended, "status": status})


def timed(name: str) -> Callable:
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            started = time.perf_counter()
            status = "ok"
            try:
                result = func(*args, **kwargs)
            except Exception:
                status = "error"
                raise
            finally:
                add_span(name, started, time.perf_counter(), status)
            return result

        return wrapper

    return decorator


def record_request(route: str, method: str, status: int, latency_ms: int, error_type: str | None) -> None:
    cold_start = first_request["pending"]
    first_request["pending"] = False
    pending.put(("request", {
        "created_at": datetime.now(timezone.utc), "route": route[:120], "method": method, "status": status,
        "latency_ms": latency_ms, "cold_start": cold_start, "region": os.getenv("VERCEL_REGION"), "error_type": error_type,
    }, None))
    start_writer()


def record_trace(trace_id: str, collected: list[dict[str, Any]], memo_status: str | None, decision: str | None) -> None:
    if not collected:
        return
    origin = min(span["started"] for span in collected)
    total_ms = round((max(span["ended"] for span in collected) - origin) * 1000)
    trace_row = {"trace_id": trace_id, "created_at": datetime.now(timezone.utc), "total_ms": total_ms, "memo_status": memo_status, "decision": decision}
    span_rows = [
        {"trace_id": trace_id, "name": span["name"], "start_ms": round((span["started"] - origin) * 1000),
         "duration_ms": round((span["ended"] - span["started"]) * 1000), "status": span["status"]}
        for span in collected
    ]
    pending.put(("trace", trace_row, span_rows))
    start_writer()


def start_writer() -> None:
    if writer["started"]:
        return
    with writer_lock:
        if not writer["started"]:
            Thread(target=write_forever, name="telemetry-writer", daemon=True).start()
            writer["started"] = True


def write_forever() -> None:
    while True:
        time.sleep(FLUSH_SECONDS)
        flush()


def flush() -> None:
    with flush_lock:
        items = []
        while True:
            try:
                items.append(pending.get_nowait())
            except Empty:
                break
        if not items:
            return
        try:
            with engine().begin() as connection:
                request_rows = [row for kind, row, _ in items if kind == "request"]
                if request_rows:
                    connection.execute(requests.insert(), request_rows)
                for kind, row, span_rows in items:
                    if kind == "trace":
                        connection.execute(traces.insert().values(**row))
                        connection.execute(spans.insert(), span_rows)
                if random.random() < 0.05:
                    prune(connection)
        except Exception as error:
            print(f"[telemetry] {len(items)} records not written: {type(error).__name__}")


def prune(connection: Any) -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    old = select(traces.c.trace_id).where(traces.c.created_at < cutoff)
    connection.execute(delete(spans).where(spans.c.trace_id.in_(old)))
    connection.execute(delete(traces).where(traces.c.created_at < cutoff))
    connection.execute(delete(requests).where(requests.c.created_at < cutoff))


def percentile(values: list[int], share: float) -> int | None:
    if not values:
        return None
    if len(values) == 1:
        return values[0]
    return round(statistics.quantiles(values, n=100, method="inclusive")[round(share * 100) - 1])


def bucket(moment: datetime, hours: int) -> str:
    moment = moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)
    moment = moment.astimezone(timezone.utc)
    if hours <= 48:
        return moment.strftime("%Y-%m-%dT%H:00Z")
    return moment.strftime("%Y-%m-%d")


def buckets(since: datetime, hours: int) -> list[str]:
    step = timedelta(hours=1) if hours <= 48 else timedelta(days=1)
    moment = since.replace(minute=0, second=0, microsecond=0) if hours <= 48 else since.replace(hour=0, minute=0, second=0, microsecond=0)
    keys = []
    while moment <= datetime.now(timezone.utc):
        keys.append(bucket(moment, hours))
        moment += step
    return keys


def summary(hours: int) -> dict[str, Any]:
    from app import budget

    flush()
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    with engine().connect() as connection:
        request_rows = connection.execute(
            select(requests.c.created_at, requests.c.route, requests.c.status, requests.c.latency_ms, requests.c.cold_start, requests.c.error_type)
            .where(requests.c.created_at >= since).order_by(requests.c.id.desc()).limit(50_000)
        ).all()
        trace_rows = connection.execute(
            select(traces.c.trace_id, traces.c.created_at, traces.c.total_ms, traces.c.memo_status, traces.c.decision)
            .where(traces.c.created_at >= since).order_by(traces.c.id.desc())
        ).all()
        recent = [row.trace_id for row in trace_rows[:8]]
        span_rows = connection.execute(
            select(spans.c.trace_id, spans.c.name, spans.c.start_ms, spans.c.duration_ms, spans.c.status).where(spans.c.trace_id.in_(recent)).order_by(spans.c.id)
        ).all() if recent else []
    with budget.engine().connect() as connection:
        ai_rows = connection.execute(
            select(budget.usage.c.created_at, budget.usage.c.stage, budget.usage.c.status, budget.usage.c.input_tokens, budget.usage.c.output_tokens, budget.usage.c.latency_ms)
            .where(budget.usage.c.created_at >= since)
        ).all()

    timeline: dict[str, dict[str, int]] = {}
    routes: dict[str, list[Any]] = {}
    errors: dict[str, int] = {}
    for row in request_rows:
        point = timeline.setdefault(bucket(row.created_at, hours), {"requests": 0, "client_errors": 0, "server_errors": 0})
        point["requests"] += 1
        point["client_errors"] += 400 <= row.status < 500
        point["server_errors"] += row.status >= 500
        routes.setdefault(row.route, []).append(row)
        if row.error_type:
            errors[row.error_type] = errors.get(row.error_type, 0) + 1

    stages: dict[str, dict[str, Any]] = {}
    ai_timeline: dict[str, dict[str, int]] = {}
    for row in ai_rows:
        stage = stages.setdefault(row.stage, {"calls": 0, "succeeded": 0, "failed": 0, "latencies": [], "input_tokens": 0, "output_tokens": 0})
        stage["calls"] += 1
        stage["succeeded"] += row.status == "succeeded"
        stage["failed"] += row.status == "failed"
        stage["input_tokens"] += row.input_tokens or 0
        stage["output_tokens"] += row.output_tokens or 0
        if row.latency_ms is not None:
            stage["latencies"].append(row.latency_ms)
        point = ai_timeline.setdefault(bucket(row.created_at, hours), {"calls": 0, "failed": 0, "tokens": 0})
        point["calls"] += 1
        point["failed"] += row.status == "failed"
        point["tokens"] += (row.input_tokens or 0) + (row.output_tokens or 0)

    memo_outcomes: dict[str, int] = {}
    for row in trace_rows:
        key = row.memo_status or "Unknown"
        memo_outcomes[key] = memo_outcomes.get(key, 0) + 1
    waterfall: dict[str, list[dict[str, Any]]] = {}
    for row in span_rows:
        waterfall.setdefault(row.trace_id, []).append({"name": row.name, "start_ms": row.start_ms, "duration_ms": row.duration_ms, "status": row.status})

    return {
        "window_hours": hours,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "process_uptime_s": round(time.time() - process_started),
        "requests": {
            "total": len(request_rows),
            "server_errors": sum(row.status >= 500 for row in request_rows),
            "client_errors": sum(400 <= row.status < 500 for row in request_rows),
            "cold_starts": sum(bool(row.cold_start) for row in request_rows),
            "timeline": [{"bucket": key, **timeline.get(key, {"requests": 0, "client_errors": 0, "server_errors": 0})} for key in buckets(since, hours)],
            "routes": sorted(({
                "route": route,
                "count": len(rows),
                "error_rate": round(sum(row.status >= 500 for row in rows) / len(rows), 4),
                "p50_ms": percentile([row.latency_ms for row in rows], 0.5),
                "p95_ms": percentile([row.latency_ms for row in rows], 0.95),
                "p99_ms": percentile([row.latency_ms for row in rows], 0.99),
            } for route, rows in routes.items()), key=itemgetter("count"), reverse=True),
            "error_types": errors,
        },
        "ai": {
            "budget": budget.remaining(),
            "stages": {name: {**{key: value for key, value in stage.items() if key != "latencies"}, "p50_ms": percentile(stage["latencies"], 0.5), "p95_ms": percentile(stage["latencies"], 0.95)} for name, stage in stages.items()},
            "timeline": [{"bucket": key, **ai_timeline.get(key, {"calls": 0, "failed": 0, "tokens": 0})} for key in buckets(since, hours)],
            "memo_outcomes": memo_outcomes,
        },
        "assessments": {
            "total": len(trace_rows),
            "p50_ms": percentile([row.total_ms for row in trace_rows], 0.5),
            "p95_ms": percentile([row.total_ms for row in trace_rows], 0.95),
            "recent": [{"created_at": row.created_at.isoformat() if hasattr(row.created_at, "isoformat") else str(row.created_at), "total_ms": row.total_ms, "memo_status": row.memo_status, "decision": row.decision, "spans": waterfall.get(row.trace_id, [])} for row in trace_rows[:8]],
        },
    }
