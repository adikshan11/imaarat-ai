---
name: live-check
description: Checks what is actually live on preprod or production (version, AI allowance, deploy run, served assets, traces) without spending the AI allowance. Use when the user asks whether something is deployed, live, working or traced.
---

# Live check

1. Version and health:
   ```bash
   curl -s https://imaarat-ai.vercel.app/api/health
   curl -s https://imaarat-ai.vercel.app/api/status
   ```
   `version` must match `backend/app/__init__.py` on `main`. For preprod use `https://imaarat-ai-preprod.vercel.app`.
2. Deploy run: `gh run list --branch main --limit 3` and `gh run view <run-id>`; the deploy job and smoke check must be green for the commit in question (`git rev-parse origin/main`).
3. Frontend change: fetch the page, find the hashed asset and search it for the change:
   ```bash
   curl -s https://imaarat-ai.vercel.app/app/ | grep -o '/assets/[^"]*\.css'
   curl -s https://imaarat-ai.vercel.app/assets/<file>.css | grep -o '<selector>[^}]*}'
   ```
4. Visual check: open the page with the Playwright MCP server at the viewport that matters and take a screenshot.
5. Runtime errors: with the Vercel MCP server, `get_runtime_errors` or `get_runtime_logs` for project `imaarat-ai`.
6. Traces: with the Langfuse MCP server, `listObservations` filtered by name or trace ID, or `queryMetrics` for latency and cost.

Do not run a live assessment, live evals or a load test unless the user agrees; they spend the shared daily allowance in `/api/status`.
