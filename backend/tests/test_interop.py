import subprocess
import sys
from pathlib import Path

from a2a.types.a2a_pb2 import TaskState
from app import db, interop
from app.api import main
from fastapi.testclient import TestClient


def test_startup_skips_mcp_and_a2a():
    code = "import sys, app.api.main; print(sorted(name for name in ('mcp', 'a2a') if name in sys.modules))"
    loaded = subprocess.run([sys.executable, "-c", code], cwd=Path(__file__).resolve().parents[1], capture_output=True, text=True, check=True)
    assert loaded.stdout.strip() == "[]"


def test_mcp_and_a2a_load_on_first_request():
    client = TestClient(main.app)
    card = client.get("/.well-known/agent-card.json")
    tools = client.post("/mcp/", json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"}, headers={"Accept": "application/json, text/event-stream"})
    assert card.status_code == 200 and card.json()["name"] == "imaarat.ai"
    assert "assess_property" in {tool["name"] for tool in tools.json()["result"]["tools"]}


def test_a2a_task_follows_the_underwriter_review(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "PROPERTIES_CSV", tmp_path / "missing.csv")
    db.init_db()
    saved = db.save_submission({"raw_input": {"property_id": "A2A-1"}, "decision": "Refer", "risk_score": 45, "review_status": "pending_review", "thread_id": "a2a:ctx-1:task-1"})
    waiting = interop.assessment_task("task-1")
    assert (waiting.status.state, waiting.context_id) == (TaskState.TASK_STATE_WORKING, "ctx-1")
    db.record_review(saved["id"], "Accept", "owner-1", "Asha Rao", "", "approved", 0)
    done = interop.assessment_task("task-1")
    assert done.status.state == TaskState.TASK_STATE_COMPLETED
    assert interop.assessment_task("task-2") is None
