import json

import pytest
from fastapi.testclient import TestClient

from app import config
from app.api import main
from evals import run_evals as runner
from evals.golden import golden_cases


def test_empty_cases():
    assert runner.deterministic([])["accuracy"] is None
    assert runner.retrieval([])["recall"] is None
    assert runner.prompt_tokens([])["saving"] is None


def test_missing_report(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    response = TestClient(main.app).get("/underwrite/evals")
    assert response.status_code == 200
    report = response.json()
    assert report["status"] == "not_run"
    assert report["passed"] is None
    assert report["generated_at"] is None
    assert report["deterministic"] is None
    assert report["metadata"]["chunking"] == "section_boundaries"
    assert report["metadata"]["corpus_sections"] > 0
    assert report["metadata"]["corpus_tokens"] is None


def test_null_report(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    folder = tmp_path / "evals" / "results"
    folder.mkdir(parents=True)
    (folder / "latest.json").write_text("null")
    report = TestClient(main.app).get("/underwrite/evals").json()
    assert report["status"] == "not_run"


def test_no_live_default(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "GEMINI_API_KEY", "configured")
    monkeypatch.setattr(runner, "RESULTS", tmp_path)
    monkeypatch.setattr("sys.argv", ["evals"])
    def forbidden(*args, **kwargs):
        pytest.fail("Default evaluation must not call live AI")
    monkeypatch.setattr(runner, "retrieve", forbidden)
    assert runner.main() == 0
    report = json.loads((tmp_path / "latest.json").read_text())
    assert report["run_mode"] == "deterministic_only"
    assert report["passed"] is None
    assert report["deterministic"]["cases"] == 24
    assert report["sections"]["memos"]["status"] == "skipped"


@pytest.mark.parametrize("count", [0, -1, 3])
def test_live_bound(monkeypatch, count):
    monkeypatch.setattr("sys.argv", ["evals", "--live", "--memo-cases", str(count)])
    with pytest.raises(SystemExit) as error:
        runner.main()
    assert error.value.code == 2


def test_unavailable_memo(monkeypatch):
    monkeypatch.setattr(runner, "faithfulness_judge", lambda: object())
    monkeypatch.setattr(runner, "memo_state", lambda case: {})
    monkeypatch.setattr(runner, "pause", lambda: None)
    monkeypatch.setattr(runner, "generate_memo", lambda state: {})
    report = runner.memos(golden_cases()[:1])
    assert report["passed"] is False
    assert report["toon"]["failed"] == 1
    assert report["toon"]["faithfulness_cases"] == 0
    assert report["toon"]["faithfulness"] is None
    assert report["rows"][0]["status"] == "failed"


def test_judge_failure(monkeypatch):
    monkeypatch.setattr(runner, "faithfulness_judge", lambda: object())
    monkeypatch.setattr(runner, "memo_state", lambda case: {"guideline_hits": [{"id": "G6"}]})
    monkeypatch.setattr(runner, "pause", lambda: None)
    def generate(state):
        state["ai_memo_status"] = "Available"
        return {"guideline_citations": ["G6"]}
    def fail(*args):
        raise RuntimeError("private provider response")
    monkeypatch.setattr(runner, "generate_memo", generate)
    monkeypatch.setattr(runner, "judge", fail)
    previous = config.PROMPT_FORMAT
    report = runner.memos(golden_cases()[:1])
    assert report["passed"] is False
    assert report["toon"]["faithfulness"] is None
    assert report["toon"]["citation_precision"] is None
    assert report["rows"][0]["reason"] == "judge_failed: RuntimeError"
    assert config.PROMPT_FORMAT == previous


def test_failed_live_exit(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "GEMINI_API_KEY", "configured")
    monkeypatch.setattr(runner, "RESULTS", tmp_path)
    monkeypatch.setattr("sys.argv", ["evals", "--live", "--memo-cases", "2"])
    def fail(*args):
        raise RuntimeError("private provider response")
    monkeypatch.setattr(runner, "retrieval", fail)
    assert runner.main() == 1
    report = json.loads((tmp_path / "latest.json").read_text())
    assert report["passed"] is False
    assert report["status"] == "failed"
    assert report["sections"]["retrieval"]["reason"] == "RuntimeError"
    assert report["sections"]["memos"]["status"] == "skipped"
    assert "private provider" not in json.dumps(report)


def test_no_key_live(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "GEMINI_API_KEY", "")
    monkeypatch.setattr(runner, "RESULTS", tmp_path)
    monkeypatch.setattr("sys.argv", ["evals", "--live"])
    assert runner.main() == 1
    report = json.loads((tmp_path / "latest.json").read_text())
    assert report["passed"] is False
    assert report["sections"]["memos"]["reason"] == "missing_api_key"


def test_four_generations(monkeypatch):
    monkeypatch.setattr(runner, "faithfulness_judge", lambda: object())
    monkeypatch.setattr(runner, "memo_state", lambda case: {})
    monkeypatch.setattr(runner, "pause", lambda: None)
    calls = []
    def generate(state):
        assert config.GEMINI_FALLBACK_MODEL == config.GEMINI_MODEL_NAME
        calls.append(config.PROMPT_FORMAT)
        state["ai_memo_status"] = "Available"
        return {"guideline_citations": ["G6"]}
    monkeypatch.setattr(runner, "generate_memo", generate)
    monkeypatch.setattr(runner, "judge", lambda *args: {"faithfulness": 0.8, "reason": "grounded"})
    previous = config.GEMINI_FALLBACK_MODEL
    report = runner.memos(golden_cases()[:2])
    assert calls == ["toon", "json", "toon", "json"]
    assert report["passed"] is True
    assert report["toon"]["faithfulness_cases"] == 2
    assert config.GEMINI_FALLBACK_MODEL == previous


def test_failed_denominator(monkeypatch):
    monkeypatch.setattr(runner, "faithfulness_judge", lambda: object())
    monkeypatch.setattr(runner, "memo_state", lambda case: {})
    monkeypatch.setattr(runner, "pause", lambda: None)
    def generate(state):
        state["ai_memo_status"] = "Available"
        return {"guideline_citations": []}
    calls = []
    def measure(*args):
        calls.append(True)
        if len(calls) > 2:
            raise RuntimeError("judge unavailable")
        return {"faithfulness": 0.4, "reason": "unsupported"}
    monkeypatch.setattr(runner, "generate_memo", generate)
    monkeypatch.setattr(runner, "judge", measure)
    report = runner.memos(golden_cases()[:2])
    assert report["passed"] is False
    assert report["toon"]["failed"] == 1
    assert report["toon"]["faithfulness_cases"] == 1
    assert report["toon"]["faithfulness"] == 0.4


@pytest.mark.parametrize("hits", [[], [{"id": "irrelevant"}]])
def test_retrieval_gate(monkeypatch, tmp_path, hits):
    monkeypatch.setattr(config, "GEMINI_API_KEY", "offline-test")
    monkeypatch.setattr(runner, "RESULTS", tmp_path)
    monkeypatch.setattr("sys.argv", ["evals", "--live"])
    monkeypatch.setattr(runner, "retrieve", lambda *args, **kwargs: hits)
    monkeypatch.setattr(runner, "pause", lambda: None)
    monkeypatch.setattr(runner, "prompt_tokens", lambda cases: {"toon_tokens": 1, "json_tokens": 2, "saving": 0.5, "rows": []})
    monkeypatch.setattr(runner, "faithfulness_judge", lambda: object())
    monkeypatch.setattr(runner, "memo_state", lambda case: {})
    def generate(state):
        state["ai_memo_status"] = "Available"
        return {"guideline_citations": []}
    monkeypatch.setattr(runner, "generate_once", generate)
    monkeypatch.setattr(runner, "judge", lambda *args: {"faithfulness": 0.8, "reason": "grounded"})
    assert runner.main() == 1
    report = json.loads((tmp_path / "latest.json").read_text())
    assert report["status"] == "failed"
    assert report["passed"] is False
    assert report["memos"]["passed"] is True
    assert report["retrieval"]["hit_rate"] == 0
    assert report["retrieval"]["recall"] == 0
    assert report["retrieval"]["passed"] is False
    assert report["retrieval"]["thresholds"] == {"hit_rate": 1.0, "recall": 0.75}
    assert report["sections"]["retrieval"] == {"status": "completed", "reason": "checks_failed", "passed": False}
    assert report["metadata"]["retrieval_thresholds"] == report["retrieval"]["thresholds"]


def test_retrieval_minimum(monkeypatch):
    cases = golden_cases()[:1] + golden_cases()[12:13]
    monkeypatch.setattr(runner, "retrieve", lambda *args, **kwargs: [{"id": "G6"}, {"id": "G2"}])
    monkeypatch.setattr(runner, "pause", lambda: None)
    report = runner.retrieval(cases)
    assert report["passed"] is True
    assert report["thresholds"] == {"hit_rate": 1.0, "recall": 0.75}
    assert [row["recall_threshold"] for row in report["rows"]] == [1.0, 0.5]


@pytest.mark.parametrize("stage,attempts", [("preparation", 2), ("generation", 4), ("judge", 4), ("judge_setup", 0)])
def test_partial_memos(monkeypatch, tmp_path, stage, attempts):
    monkeypatch.setattr(config, "GEMINI_API_KEY", "offline-test")
    monkeypatch.setattr(runner, "RESULTS", tmp_path)
    monkeypatch.setattr("sys.argv", ["evals", "--live"])
    monkeypatch.setattr(runner, "pause", lambda: None)
    monkeypatch.setattr(runner, "retrieve", lambda *args, **kwargs: [{"id": "G6"}, {"id": "G2"}])
    monkeypatch.setattr(runner, "prompt_tokens", lambda cases: {"toon_tokens": 1, "json_tokens": 2, "saving": 0.5, "rows": []})
    def metric():
        if stage == "judge_setup":
            raise RuntimeError("private provider response")
        return object()
    monkeypatch.setattr(runner, "faithfulness_judge", metric)
    def prepare(case):
        if stage == "preparation" and case["id"] == "boundary_30":
            raise RuntimeError("private provider response")
        return {"id": case["id"]}
    monkeypatch.setattr(runner, "memo_state", prepare)
    calls = []
    def generate(state):
        calls.append(state["id"])
        if stage == "generation" and state["id"] == "boundary_30":
            raise RuntimeError("private provider response")
        state["ai_memo_status"] = "Available"
        return {"guideline_citations": ["G6"]}
    monkeypatch.setattr(runner, "generate_once", generate)
    def measure(metric, state, memo):
        if stage == "judge" and state["id"] == "boundary_30":
            raise RuntimeError("private provider response")
        return {"faithfulness": 0.8, "reason": "grounded"}
    monkeypatch.setattr(runner, "judge", measure)
    previous = config.PROMPT_FORMAT
    assert runner.main() == 1
    report = json.loads((tmp_path / "latest.json").read_text())
    assert report["passed"] is False
    assert report["metadata"]["memo_generations"] == attempts
    assert len(calls) == attempts
    assert report["memos"]["generation_attempts"] == attempts
    assert len(report["memos"]["rows"]) == 4
    assert report["memos"]["toon"]["memos"] == 2
    assert report["memos"]["toon"]["faithfulness_cases"] == (0 if stage == "judge_setup" else 1)
    if stage != "judge_setup":
        assert all(row["passed"] for row in report["memos"]["rows"][:2])
    assert report["memos"]["rows"][-1]["reason"] == f"{stage}_failed: RuntimeError"
    assert "private provider" not in json.dumps(report)
    assert config.PROMPT_FORMAT == previous