import os
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app import budget, config, db, llm
from app.agents.graph import run_graph
from app.api import main


@pytest.fixture
def store(tmp_path, monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("VERCEL", raising=False)
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "budget.db")
    monkeypatch.setattr(config, "AI_DAILY_ADMISSIONS", 3)
    monkeypatch.setattr(config, "AI_CLIENT_DAILY_ADMISSIONS", 2)
    monkeypatch.setattr(config, "AI_DAILY_CALLS", 4)
    db.metadata.create_all(db.get_engine())


def test_budget_day_follows_pacific_midnight_like_gemini_quotas():
    assert budget.budget_day(datetime(2026, 10, 5, 6, 59, tzinfo=timezone.utc)) == "2026-10-04"
    assert budget.budget_day(datetime(2026, 10, 5, 7, 0, tzinfo=timezone.utc)) == "2026-10-05"
    assert budget.seconds_until_reset(datetime(2026, 10, 5, 6, 59, tzinfo=timezone.utc)) == 60


def test_visitor_cap_then_global_cap(store):
    budget.admit("10.0.0.1")
    budget.admit("10.0.0.1")
    with pytest.raises(budget.BudgetExceeded) as visitor:
        budget.admit("10.0.0.1")
    assert visitor.value.scope == "this visitor" and visitor.value.retry_after > 0
    budget.admit("10.0.0.2")
    with pytest.raises(budget.BudgetExceeded) as everyone:
        budget.admit("10.0.0.3")
    assert everyone.value.scope == "all visitors"


def test_failed_visitor_reservation_does_not_spend_global_budget(store):
    budget.admit("10.0.0.1")
    budget.admit("10.0.0.1")
    with pytest.raises(budget.BudgetExceeded):
        budget.admit("10.0.0.1")
    assert budget.remaining()["admissions_left"] == 1


def test_calls_are_capped_and_recorded(store):
    first = budget.reserve_call("memo")
    budget.finish_call(first, "succeeded", "gemini-test", 1200, 300, 900)
    for _ in range(3):
        budget.reserve_call("embed")
    with pytest.raises(budget.BudgetExceeded):
        budget.reserve_call("embed")
    left = budget.remaining()
    assert left["calls_left"] == 0
    assert left["tokens_today"] == {"input": 1200, "output": 300}


def test_ai_is_not_ready_without_key_or_shared_store(store, monkeypatch):
    monkeypatch.setattr(config, "GEMINI_API_KEY", "")
    assert budget.admission_note("10.0.0.1") == "AI is not configured on this deployment"
    monkeypatch.setattr(config, "GEMINI_API_KEY", "set")
    monkeypatch.setenv("VERCEL", "1")
    assert budget.admission_note("10.0.0.1") == "AI needs a shared budget database on this deployment"
    assert budget.remaining()["admissions_left"] == 3


def test_admission_note_reports_reset_time(store, monkeypatch):
    monkeypatch.setattr(config, "GEMINI_API_KEY", "set")
    assert budget.admission_note("10.0.0.1") is None
    assert budget.admission_note("10.0.0.1") is None
    assert budget.admission_note("10.0.0.1").startswith("Daily AI limit reached for this visitor; resets in ")


class ApiError(Exception):
    def __init__(self, code):
        super().__init__(f"HTTP {code}")
        self.code = code


def test_retries_reserve_budget_and_never_switch_model(store, monkeypatch):
    slept = []
    monkeypatch.setattr(llm.time, "sleep", slept.append)
    calls = []

    def flaky(model):
        calls.append(model)
        if len(calls) < 3:
            raise ApiError(429)
        return "ok"

    response, _, _ = llm.budgeted("memo", flaky, model="gemini-test")
    assert response == "ok" and calls == ["gemini-test"] * 3 and slept == [2, 4]
    assert budget.remaining()["calls_left"] == 1


def test_client_errors_are_not_retried(store):
    calls = []

    def rejected():
        calls.append(1)
        raise ApiError(400)

    with pytest.raises(ApiError):
        llm.budgeted("memo", rejected)
    assert calls == [1]


def test_exhausted_budget_stops_the_call_before_it_is_made(store):
    for _ in range(4):
        budget.reserve_call("embed")
    calls = []
    with pytest.raises(budget.BudgetExceeded):
        llm.budgeted("memo", calls.append, item=1)
    assert calls == []


def test_ai_stages_skip_with_the_reason_shown(store, monkeypatch):
    monkeypatch.setattr(config, "GEMINI_API_KEY", "set")
    for module in ("app.agents.report_agent", "app.tools.vision_extract", "app.tools.rag_lookup"):
        monkeypatch.setattr(f"{module}.GEMINI_API_KEY", "set")
    note = "Daily AI limit reached for this visitor; resets in 3h 0m"
    state = run_graph({"property_id": "B-1", "construction_type": "Frame", "occupancy_type": "Office", "cat_zone": "None", "tiv": 1000000}, ai_note=note)
    assert state["ai_memo_status"] == "Unavailable" and state["ai_memo_reason"] == note
    assert state["guideline_hits"] == []
    assert budget.remaining()["calls_left"] == 4


def test_read_form_returns_429_with_retry_after(store, monkeypatch):
    monkeypatch.setattr(config, "GEMINI_API_KEY", "set")
    client = TestClient(main.app)
    for _ in range(2):
        budget.admit("testclient")
    response = client.post("/underwrite/read-form", files={"image": ("page.jpg", b"x", "image/jpeg")})
    assert response.status_code == 429
    assert int(response.headers["retry-after"]) > 0


@pytest.mark.skipif(not os.getenv("TEST_DATABASE_URL"), reason="needs a real Postgres to prove concurrent atomicity")
def test_postgres_never_admits_beyond_the_cap_under_concurrency(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setattr(config, "AI_DAILY_ADMISSIONS", 5)
    monkeypatch.setattr(config, "AI_CLIENT_DAILY_ADMISSIONS", 100)
    engine = db.get_engine()
    budget.counters.drop(engine, checkfirst=True)
    budget.usage.drop(engine, checkfirst=True)
    db.metadata.create_all(engine, tables=[budget.counters, budget.usage])

    def attempt(index):
        try:
            budget.admit(f"10.1.0.{index}")
            return True
        except budget.BudgetExceeded:
            return False

    with ThreadPoolExecutor(max_workers=20) as pool:
        admitted = sum(pool.map(attempt, range(20)))
    assert admitted == 5
    assert budget.remaining()["admissions_left"] == 0


def test_no_attempt_starts_without_time_left_in_the_request(store, monkeypatch):
    calls = []
    token = llm.deadline.set(time.perf_counter() + 5)
    try:
        with pytest.raises(TimeoutError):
            llm.budgeted("memo", calls.append, item=1)
    finally:
        llm.deadline.reset(token)
    assert calls == []
    assert budget.remaining()["calls_left"] == 4


def test_retries_stop_when_the_next_attempt_would_overrun(store, monkeypatch):
    slept = []
    monkeypatch.setattr(llm.time, "sleep", slept.append)
    calls = []

    def busy(model):
        calls.append(model)
        raise ApiError(503)

    token = llm.deadline.set(time.perf_counter() + llm.config.GEMINI_TIMEOUT_MS / 1000 + 1)
    try:
        with pytest.raises(ApiError):
            llm.budgeted("memo", busy, model="gemini-test")
    finally:
        llm.deadline.reset(token)
    assert calls == ["gemini-test"] and slept == []
