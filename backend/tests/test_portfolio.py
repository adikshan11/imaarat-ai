from fastapi.testclient import TestClient

from app import db
from app.api import main


def seed(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "PROPERTIES_CSV", tmp_path / "missing.csv")
    db.init_db()
    rows = [
        ("P-1", "Chennai", 10, "Accept", ["Flood exposure"], {"sprinkler_system": "Y", "fire_alarm": True, "tiv": 100}),
        ("P-2", "Mumbai", 45, "Refer", ["Flood exposure", "Old roof"], {"sprinkler_system": "N", "tiv": 300}),
        ("P-3", "Bengaluru", 70, "Decline (mitigation possible)", [], {"flood_protection": True, "tiv": 200}),
        ("P-4", "Chennai", 90, "Auto-Decline", ["Old roof"], {"tiv": 50}),
    ]
    for property_id, city, score, decision, flags, extra in rows:
        db.save_submission({
            "raw_input": {"property_id": property_id, "city": city, "address": f"{property_id} Road", **extra},
            "decision": decision,
            "risk_score": score,
            "risk_flags": flags,
            "prototype_mitigation_model": {"mitigation_benefit": 2},
            "review_status": "pending_review" if score == 45 else "not_required",
        })


def test_portfolio_totals_match_every_submission(tmp_path, monkeypatch):
    seed(tmp_path, monkeypatch)
    summary = TestClient(main.app).get("/underwrite/portfolio").json()
    assert summary["submissions"] == 4
    assert summary["average_score"] == 54
    assert summary["pending_review"] == 1
    assert summary["total_value_inr"] == 650
    assert (summary["with_sprinklers"], summary["with_fire_alarm"], summary["with_flood_protection"]) == (1, 1, 1)
    assert summary["mitigation_benefit"] == 8
    assert summary["bands"] == {"Accept": 1, "Refer": 1, "Decline (mitigation possible)": 1, "Auto-Decline": 1}
    assert summary["top_drivers"][0] == ["Flood exposure", 2]


def test_history_pages_filters_and_sorts_on_the_server(tmp_path, monkeypatch):
    seed(tmp_path, monkeypatch)
    client = TestClient(main.app)
    first = client.get("/underwrite/history", params={"limit": 2})
    assert first.headers["x-total-count"] == "4"
    assert [row["property_id"] for row in first.json()] == ["P-4", "P-3"]
    second = client.get("/underwrite/history", params={"limit": 2, "offset": 2})
    assert [row["property_id"] for row in second.json()] == ["P-2", "P-1"]
    chennai = client.get("/underwrite/history", params={"q": "chennai", "sort": "score", "direction": "asc"})
    assert chennai.headers["x-total-count"] == "2"
    assert [row["property_id"] for row in chennai.json()] == ["P-1", "P-4"]
    refer = client.get("/underwrite/history", params={"decision": "Refer"})
    assert [row["property_id"] for row in refer.json()] == ["P-2"]
    by_value = client.get("/underwrite/history", params={"sort": "value"})
    assert [row["property_id"] for row in by_value.json()] == ["P-2", "P-3", "P-1", "P-4"]
    assert client.get("/underwrite/history", params={"limit": 500}).status_code == 422
