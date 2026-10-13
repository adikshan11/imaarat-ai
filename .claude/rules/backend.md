---
description: Rules for the FastAPI backend, agents and pipeline
paths:
  - "backend/**"
  - "api/**"
  - "pipeline/**"
applyTo: "backend/**,api/**,pipeline/**"
---

# Backend

- The rule engine in `backend/app/tools/risk_calculator.py` decides every score and decision. AI output is checked against it and may never change it.
- Every model call goes through `backend/app/llm.py` (`generate`, `budgeted`) so limits, retries, timeouts and Langfuse tracing apply.
- New settings go in `backend/app/config.py` with a safe default, and in the README configuration table if a user can set them.
- Request and response shapes are Pydantic models in `backend/app/schemas.py`.
- Tests in `backend/tests/` run on SQLite by default. Concurrency tests that need Postgres skip unless `TEST_DATABASE_URL` is set, which CI does; anything touching locking or atomic updates needs one of those.
- The Vercel function has a 180 MB budget (`.github/scripts/function_size.sh`). A new runtime dependency must fit; optional ones go in their own requirements file.
- Ruff at 200 columns; run `ruff check backend pipeline` and `ruff format --check backend pipeline`.
