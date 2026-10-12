import subprocess
import sys
from pathlib import Path

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
