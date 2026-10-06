"""Store one CI run summary (load test, Lighthouse or evaluation) in the app database for the status page."""

import csv
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from app import telemetry


def load_summary(paths: list[str]) -> dict:
    rows = {row["Name"]: row for row in csv.DictReader(open(paths[0], encoding="utf-8"))}
    total = rows["Aggregated"]
    return {
        "users": int(os.getenv("USERS", "0")),
        "duration": os.getenv("DURATION", ""),
        "requests": int(total["Request Count"]),
        "failures": int(total["Failure Count"]),
        "rps": round(float(total["Requests/s"]), 1),
        "p50_ms": int(float(total["50%"])),
        "p95_ms": int(float(total["95%"])),
        "p99_ms": int(float(total["99%"])),
        "submit_p95_ms": int(float(rows.get("/underwrite/submit", total)["95%"])),
    }


def lighthouse_summary(paths: list[str]) -> dict:
    devices = {}
    for path in paths:
        report = json.loads(Path(path).read_text(encoding="utf-8"))
        audits = report["audits"]
        devices[report["configSettings"]["formFactor"]] = {
            "performance": round(report["categories"]["performance"]["score"] * 100),
            "accessibility": round(report["categories"]["accessibility"]["score"] * 100),
            "lcp_ms": round(audits["largest-contentful-paint"]["numericValue"]),
            "tbt_ms": round(audits["total-blocking-time"]["numericValue"]),
            "cls": round(audits["cumulative-layout-shift"]["numericValue"], 3),
        }
    return devices


def evals_summary(paths: list[str]) -> dict:
    report = json.loads(Path(paths[0]).read_text(encoding="utf-8"))
    retrieval = report.get("retrieval") or {}
    tokens = report.get("prompt_tokens") or {}
    return {
        "mode": report.get("run_mode"),
        "passed": report.get("passed"),
        "rules_agreement": report["deterministic"].get("accuracy"),
        "rules_cases": report["deterministic"].get("cases"),
        "retrieval_hit_rate": retrieval.get("hit_rate"),
        "retrieval_recall": retrieval.get("recall"),
        "retrieval_cases": retrieval.get("cases"),
        "toon_token_saving": tokens.get("saving"),
        "sections": {name: section.get("reason") or section.get("status") for name, section in report.get("sections", {}).items()},
    }


SUMMARIES = {"load": load_summary, "lighthouse": lighthouse_summary, "evals": evals_summary}


def main() -> int:
    kind, paths = sys.argv[1], sys.argv[2:]
    summary = SUMMARIES[kind](paths)
    with telemetry.engine().begin() as connection:
        connection.execute(telemetry.runs.insert().values(
            kind=kind, created_at=datetime.now(timezone.utc), git_sha=os.getenv("GITHUB_SHA", "")[:12],
            run_url=f"{os.getenv('GITHUB_SERVER_URL', '')}/{os.getenv('GITHUB_REPOSITORY', '')}/actions/runs/{os.getenv('GITHUB_RUN_ID', '')}",
            summary=json.dumps(summary),
        ))
    print(f"published {kind}: {json.dumps(summary)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
