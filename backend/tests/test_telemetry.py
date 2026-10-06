from fastapi.testclient import TestClient
from sqlalchemy import select

from app import db, telemetry
from app.agents.graph import run_graph
from app.api import main


def test_requests_are_logged_by_route_template_without_inputs():
    client = TestClient(main.app)
    client.get("/hazard/600001")
    client.get("/hazard/999999")
    client.get("/health")
    telemetry.flush()
    with telemetry.engine().connect() as connection:
        rows = connection.execute(select(telemetry.requests.c.route, telemetry.requests.c.status)).all()
    assert sorted(rows) == [("/hazard/{pincode}", 200), ("/hazard/{pincode}", 404)]
    routes = client.get("/ops/summary").json()["requests"]["routes"]
    assert routes[0]["route"] == "/hazard/{pincode}" and routes[0]["count"] == 2
    assert "600001" not in str(client.get("/ops/summary").json())
    assert len(client.get("/ops/summary").json()["requests"]["timeline"]) == 25
    assert len(client.get("/ops/summary", params={"hours": 168}).json()["ai"]["timeline"]) == 8


def test_an_assessment_records_a_trace_with_its_steps(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "PROPERTIES_CSV", tmp_path / "missing.csv")
    db.init_db()
    run_graph({"property_id": "T-1", "construction_type": "Frame", "occupancy_type": "Office", "cat_zone": "None", "tiv": 1000000})
    recent = TestClient(main.app).get("/ops/summary").json()["assessments"]["recent"]
    names = [span["name"] for span in recent[0]["spans"]]
    assert names[:2] == ["intake", "photo review"]
    assert {"risk rules", "decision", "AI risk summary"} <= set(names)
    assert recent[0]["decision"]
    assert all(span["start_ms"] >= 0 and span["duration_ms"] >= 0 for span in recent[0]["spans"])


def test_a_broken_telemetry_store_never_fails_the_request(monkeypatch):
    def broken():
        raise RuntimeError("database down")

    monkeypatch.setattr(telemetry, "engine", broken)
    assert TestClient(main.app).get("/hazard/600001").status_code == 200
    telemetry.flush()
    assert telemetry.pending.empty()
