import os
import time
from concurrent.futures import ThreadPoolExecutor

import pytest
from app import auth, db, profile
from app.api import main
from fastapi.testclient import TestClient
from sqlalchemy import update

ORIGIN = "https://imaarat.test"
PROPOSAL = {"property_id": "DUP-1", "address": "12, Rajiv Gandhi Salai", "zip": "600113"}


@pytest.fixture
def app_db(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "PROPERTIES_CSV", tmp_path / "missing.csv")
    db.init_db()
    auth._ready_engines.clear()
    monkeypatch.setenv("PUBLIC_BASE_URL", ORIGIN)
    monkeypatch.setenv("OPERATOR_GITHUB_IDS", "7")


def pending_referral() -> int:
    return db.save_submission({"property_id": "DUP-1", "raw_input": PROPOSAL, "decision": "Refer", "risk_score": 45, "review_status": "pending_review"})["id"]


def reviewer(github_id: int, name: str) -> tuple[TestClient, dict]:
    grant = auth.create_member(github_id, name=name)
    profile.save(grant.principal.owner_id, name.capitalize(), "9876543210")
    with auth.engine().begin() as conn:
        conn.execute(update(auth.users).where(auth.users.c.github_id == github_id).values(role="reviewer"))
    client = TestClient(main.app, base_url="https://testserver")
    client.cookies.set(auth.SESSION_COOKIE, grant.token)
    return client, {"origin": ORIGIN, "x-csrf-token": grant.csrf_token}


def test_a_claimed_referral_tells_the_second_reviewer_who_has_it(app_db):
    submission_id = pending_referral()
    ana, ana_headers = reviewer(7, "ana")
    bea, bea_headers = reviewer(8, "bea")

    claimed = ana.post(f"/underwrite/history/{submission_id}/claim", headers=ana_headers)
    assert claimed.status_code == 200
    assert claimed.json()["claimed_by"] == "Ana"

    blocked = bea.post(f"/underwrite/history/{submission_id}/claim", headers=bea_headers)
    assert blocked.status_code == 409
    assert blocked.json()["detail"].startswith("Ana is reviewing this referral until")
    assert bea.post(f"/underwrite/history/{submission_id}/review", json={"final_decision": "Refer"}, headers=bea_headers).status_code == 409

    decided = ana.post(f"/underwrite/history/{submission_id}/review", json={"final_decision": "Refer"}, headers=ana_headers)
    assert decided.status_code == 200
    assert decided.json()["reviewer"] == "Ana"
    assert decided.json()["claimed_by"] is None

    late = bea.post(f"/underwrite/history/{submission_id}/review", json={"final_decision": "Accept", "note": "x"}, headers=bea_headers)
    assert late.status_code == 409
    assert late.json()["detail"] == "This referral was already decided by Ana."


def test_a_released_or_expired_claim_frees_the_referral(app_db):
    submission_id = pending_referral()
    ana, ana_headers = reviewer(7, "ana")
    bea, bea_headers = reviewer(8, "bea")
    ana.post(f"/underwrite/history/{submission_id}/claim", headers=ana_headers)
    assert ana.delete(f"/underwrite/history/{submission_id}/claim", headers=ana_headers).json()["claimed_by"] is None
    assert bea.post(f"/underwrite/history/{submission_id}/claim", headers=bea_headers).status_code == 200

    now = int(time.time())
    assert db.claim_review(submission_id, "someone-else", "@cy", now) is not None
    assert db.claim_review(submission_id, "someone-else", "@cy", now + db.CLAIM_SECONDS) is None


def test_a_member_cannot_claim(app_db):
    submission_id = pending_referral()
    grant = auth.create_member(42, name="member")
    client = TestClient(main.app, base_url="https://testserver")
    client.cookies.set(auth.SESSION_COOKIE, grant.token)
    assert client.post(f"/underwrite/history/{submission_id}/claim", headers={"origin": ORIGIN, "x-csrf-token": grant.csrf_token}).status_code == 403


def test_the_same_address_and_pin_code_is_flagged(app_db):
    first = pending_referral()
    assert [match["id"] for match in db.find_duplicates("12 rajiv gandhi salai", "600113")] == [first]
    assert db.find_duplicates("12 Rajiv Gandhi Salai", "600001") == []
    assert db.find_duplicates("", "600113") == []


@pytest.mark.skipif(not os.getenv("TEST_DATABASE_URL"), reason="needs a real Postgres to prove the conditional update under concurrency")
def test_only_one_of_many_simultaneous_decisions_is_saved(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    db.init_db()
    submission_id = pending_referral()
    now = int(time.time())

    def decide(index):
        return db.record_review(submission_id, "Refer", f"owner-{index}", f"@r{index}", "", "approved", now)

    with ThreadPoolExecutor(max_workers=20) as pool:
        outcomes = list(pool.map(decide, range(20)))
    assert outcomes.count(None) == 1
    winner = db.fetch_submission_detail(submission_id)["reviewer"]
    assert all(outcome == f"This referral was already decided by {winner}." for outcome in outcomes if outcome)
