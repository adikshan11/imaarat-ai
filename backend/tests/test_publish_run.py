import json

from fastapi.testclient import TestClient

from app.api import main
from ops import publish_run

LOAD_CSV = """Type,Name,Request Count,Failure Count,Median Response Time,Average Response Time,Min Response Time,Max Response Time,Average Content Size,Requests/s,Failures/s,50%,66%,75%,80%,90%,95%,98%,99%,99.9%,99.99%,100%
POST,/underwrite/submit,10,0,30,40,10,90,500,1.5,0,30,35,40,45,60,80,85,90,90,90,90
,Aggregated,100,1,5,8,1,90,300,20.25,0.1,5,6,7,8,10,15,20,40,90,90,90
"""


def lighthouse(form_factor, score):
    return {
        "configSettings": {"formFactor": form_factor},
        "categories": {"performance": {"score": score}, "accessibility": {"score": 1}},
        "audits": {"largest-contentful-paint": {"numericValue": 2300.4}, "total-blocking-time": {"numericValue": 680}, "cumulative-layout-shift": {"numericValue": 0.0471}},
    }


def test_ci_runs_are_published_and_shown_newest_first(tmp_path, monkeypatch):
    (tmp_path / "load_stats.csv").write_text(LOAD_CSV, encoding="utf-8")
    (tmp_path / "mobile.json").write_text(json.dumps(lighthouse("mobile", 0.79)), encoding="utf-8")
    (tmp_path / "latest.json").write_text(json.dumps({"run_mode": "live_bounded", "passed": False, "deterministic": {"accuracy": 1, "cases": 24}, "retrieval": {"hit_rate": 0.5, "recall": 0.25, "cases": 2}, "prompt_tokens": {"saving": 0.34}, "sections": {"memos": {"status": "failed", "reason": "checks_failed"}}}), encoding="utf-8")
    monkeypatch.setenv("USERS", "200")
    for argv in (["publish_run", "load", str(tmp_path / "load_stats.csv")], ["publish_run", "lighthouse", str(tmp_path / "mobile.json")], ["publish_run", "evals", str(tmp_path / "latest.json")]):
        monkeypatch.setattr("sys.argv", argv)
        assert publish_run.main() == 0
    runs = TestClient(main.app).get("/ops/summary").json()["ci_runs"]
    assert runs["load"][0]["summary"] == {"users": 200, "duration": "", "requests": 100, "failures": 1, "rps": 20.2, "p50_ms": 5, "p95_ms": 15, "p99_ms": 40, "submit_p95_ms": 80}
    assert runs["lighthouse"][0]["summary"]["mobile"] == {"performance": 79, "accessibility": 100, "lcp_ms": 2300, "tbt_ms": 680, "cls": 0.047}
    assert runs["evals"][0]["summary"]["retrieval_recall"] == 0.25


def test_app_and_landing_audits_are_kept_apart(tmp_path):
    app = {**lighthouse("mobile", 0.88), "requestedUrl": "https://imaarat-ai.vercel.app/app/"}
    landing = {**lighthouse("mobile", 1), "requestedUrl": "https://imaarat-ai.vercel.app/"}
    for name, report in (("app.json", app), ("landing.json", landing)):
        (tmp_path / name).write_text(json.dumps(report), encoding="utf-8")
    summary = publish_run.lighthouse_summary([str(tmp_path / "app.json"), str(tmp_path / "landing.json")])
    assert summary["app mobile"]["performance"] == 88 and summary["mobile"]["performance"] == 100
