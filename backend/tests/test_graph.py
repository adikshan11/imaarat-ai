import time
from concurrent.futures import ThreadPoolExecutor

from app import db
from app.agents import graph as graph_module
from app.agents import report_agent
from app.tools import rag_lookup, vision_extract

REFER_PROPERTY = {
    "property_id": "HITL-001",
    "address": "1 Test Road",
    "city": "Pune",
    "state": "MH",
    "construction_type": "Non-Combustible",
    "occupancy_type": "Office",
    "sprinkler_system": "Y",
    "cat_zone": "Wind",
    "seismic_zone": "II",
    "prior_claims_count_5yr": 3,
    "square_footage": 50000,
    "year_built": 2005,
    "tiv": 10_000_000,
}


def use_temp_database(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "uw_risk.db")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    for module in (report_agent, rag_lookup, vision_extract):
        monkeypatch.setattr(module, "GEMINI_API_KEY", "")
    db.init_db()


def test_referral_pauses_for_review_and_resumes_with_override(tmp_path, monkeypatch):
    use_temp_database(tmp_path, monkeypatch)
    state = graph_module.run_graph(dict(REFER_PROPERTY))
    assert state["decision"] == "Refer"
    assert state["review_status"] == "pending_review"
    assert state["final_decision"] is None

    resumed = graph_module.resume_review(state["thread_id"], "Accept", "Test Underwriter", "Claims were from a single resolved event")
    assert resumed["review_status"] == "overridden"
    assert resumed["final_decision"] == "Accept"
    assert resumed["decision"] == "Refer"


def test_non_referral_needs_no_review(tmp_path, monkeypatch):
    use_temp_database(tmp_path, monkeypatch)
    state = graph_module.run_graph({**REFER_PROPERTY, "property_id": "HITL-002", "cat_zone": "None", "prior_claims_count_5yr": 0})
    assert state["decision"] == "Accept"
    assert state["review_status"] == "not_required"
    assert state["final_decision"] == "Accept"


def test_concurrent_first_requests_build_the_checkpointer_once(monkeypatch):
    built = []

    def slow_checkpointer():
        built.append(1)
        time.sleep(0.2)
        return graph_module.InMemorySaver()

    monkeypatch.setattr(graph_module, "checkpointer", slow_checkpointer)
    monkeypatch.setattr(graph_module, "_compiled", {})

    def first_request(_):
        return graph_module.graph()

    with ThreadPoolExecutor(max_workers=8) as pool:
        graphs = list(pool.map(first_request, range(8)))
    assert built == [1]
    assert all(compiled is graphs[0] for compiled in graphs)
