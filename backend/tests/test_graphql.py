from fastapi.testclient import TestClient

from app import db
from app.api import main


def test_one_query_returns_status_hazard_totals_and_a_page(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "PROPERTIES_CSV", tmp_path / "missing.csv")
    db.init_db()
    for property_id, score in (("G-1", 20), ("G-2", 70)):
        db.save_submission({"raw_input": {"property_id": property_id, "city": "Pune", "tiv": 100}, "decision": "Accept", "risk_score": score, "risk_flags": []})
    query = """
      { status hazard(pincode: "600001") portfolio { submissions average_score }
        history(limit: 1, sort: SCORE, direction: DESC) { total rows { property_id risk_score } } }
    """
    body = TestClient(main.app).post("/graphql", json={"query": query}).json()
    assert "errors" not in body
    data = body["data"]
    assert data["status"]["version"]
    assert data["hazard"]["district"] == "Chennai"
    assert data["portfolio"] == {"submissions": 2, "average_score": 45}
    assert data["history"] == {"total": 2, "rows": [{"property_id": "G-2", "risk_score": 70}]}


def test_unknown_pincode_is_null_not_an_error():
    body = TestClient(main.app).post("/graphql", json={"query": '{ hazard(pincode: "999999") }'}).json()
    assert body == {"data": {"hazard": None}}
