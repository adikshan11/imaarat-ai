# imaarat.ai agent guide

Shared instructions for every coding agent (Claude Code, GitHub Copilot, Codex). Tool-specific notes live in `CLAUDE.md` and `.github/copilot-instructions.md`; scoped rules live in `.claude/rules/` and task playbooks in `.claude/skills/`.

## What this is

imaarat.ai assesses commercial property proposals for Indian insurers. **Rules decide, AI explains, a person approves.** The deterministic rule engine makes every decision; the AI only reads forms, reviews photos and writes summaries that are checked against the rule engine before anyone sees them. Never let model output change a score or decision.

## Repository map

| Path | What lives there |
|---|---|
| `api/index.py` | Vercel entry point that mounts the FastAPI app |
| `backend/app/api/main.py` | REST routes, `/health`, `/status`, uploads, MCP and A2A mounts |
| `backend/app/agents/` | LangGraph workflow (`graph.py`), state and the report agent |
| `backend/app/tools/` | Hazard lookup, rule engine (`risk_calculator.py`), form reader, vision, guideline search |
| `backend/app/llm.py`, `budget.py`, `providers/` | Every model call: daily and per-minute limits, retries, fallback model, timeouts |
| `backend/app/observability.py` | Langfuse traces, spans and generations |
| `backend/tests/` | pytest suite; SQLite locally, plus Postgres-only tests in CI |
| `frontend/src/` | React 19 + TypeScript + Vite app; `landing/` is the public site, `components/` the app |
| `frontend/src/i18n/locales/` | 26 locale files that must match `en.json` key for key |
| `frontend/scripts/` | Build, type check, locale and deprecation checks, node tests and browser tests |
| `pipeline/` | Extract script and dbt project for the analytics pipeline |
| `.github/workflows/` | `ci-cd.yml`, `benchmarks.yml`, `nightly_elt.yml` |
| `.github/scripts/` | Release rules, smoke check, JSON format check, function size budget, Lighthouse summary |

`README.md` explains the product and configuration, `ARCHITECTURE.md` the design, `CHANGELOG.md` every release.

## Checks

CI is the source of truth. These are the commands it runs:

| Check | Command |
|---|---|
| Release rules | `python3 .github/scripts/release_check.py` |
| Secret scan | `gitleaks git --redact --no-banner --config .gitleaks.toml --exit-code 1 .` |
| Python lint | `ruff check backend pipeline` and `ruff format --check backend pipeline` (line length 200) |
| JSON | `.github/scripts/check_json.sh` (every JSON file must match `jq --indent 2`) |
| YAML and workflows | `yamllint --strict`, `check-jsonschema`, `actionlint`, `shellcheck` |
| Function size | `.github/scripts/function_size.sh` (budget 180 MB) |
| Backend | `cd backend && pytest -q --timeout=120` |
| Frontend | `cd frontend && npm run check:locales && npm run lint && npm run check:deprecated && npm run build && npm test` (the build includes the type check) |
| Browser tests | `cd frontend && npm run test:browser` |
| Pipeline | `cd pipeline && python extract.py`, then `cd dbt && dbt build --profiles-dir .` |
| Container | `docker compose build && docker compose up --wait`, then `.github/scripts/smoke_check.sh http://localhost:8080` |

## Branches and releases

This is a one-person project, so there are exactly two branches: `main` (production) and `preprod` (all work). Do not create feature, fix or other branches, and do not open pull requests into `preprod`.

1. Start every task on an up-to-date `preprod`: `git fetch -q origin && git switch preprod && git reset --keep origin/preprod`. After each release `preprod` is reset to `main`, so this also brings in the latest `main`. If `git log --oneline origin/preprod..origin/main` lists anything, ask before going further.
2. Commit straight to `preprod`, with commit messages of a few words. The first user-visible change after a release bumps the version once in `backend/app/__init__.py`, `frontend/package.json` and both version fields of `frontend/package-lock.json`, and adds a plain-English `CHANGELOG.md` entry; later changes before the next release add lines to that same entry. CI, docs and tooling changes bump nothing.
3. Push with `git push origin preprod`. CI tests the commit, deploys `https://imaarat-ai-preprod.vercel.app`, smoke-checks it and runs a read-only stress test. Fix any failure with another commit on `preprod`.
4. Release with one pull request from `preprod` into `main` using `.github/pull_request_template.md` (`Version: *X.Y.Z*`, then one "This PR ..." sentence), merged with rebase once every check is green. `main` only accepts pull requests; that push deploys production.
5. Reset `preprod` to `main` afterwards so the two never drift. CI skips the redeploy because the commit is already on `main`.

Deploys happen only from CI on a push. Never deploy from a laptop, never push to `main`, and never force-push anything except the post-release `preprod` reset with `--force-with-lease`.

## Code conventions

- Lean code that keeps the same behaviour, accuracy, performance and cost. No speculative abstractions, flags or helpers used once.
- No code comments. Docstrings are one short line.
- No leading underscores in new names.
- No deprecated APIs; `npm run check:deprecated` and Ruff enforce part of this.
- Keep LF line endings.
- Tests are few, short and about the change. No fake data that pretends to be real.
- Python: Ruff at 200 columns, type hints on public functions, Pydantic models in `schemas.py`.
- Frontend: React function components, plain CSS in `App.css` and `index.css`, no component kit. Every visible string goes through i18n in all 26 locales. Layouts must work right-to-left and keep the `prefers-reduced-motion`, `prefers-reduced-transparency` and `prefers-contrast` fallbacks working.

## AI, cost and data

- Every model call goes through `backend/app/llm.py` so limits, retries, the fallback model, timeouts and tracing apply. Do not call a provider SDK directly.
- The live demo runs on a free daily allowance (see `/api/status`). Live assessments, evals with `live: true` and load tests spend it; ask before running them.
- Production and preprod share one Neon database. Anything run against preprod must be read-only.
- Vercel is on the Hobby plan: keep the function under the size budget and avoid extra deploys.
- Never print, log, commit or paste secrets. Configuration names are in the README; values live in Vercel and GitHub secrets.

## Definition of done

1. Every CI job on the `preprod` push is green, including the deploy, smoke check and stress test.
2. The release pull request into `main` is green and merged.
3. After the release, `https://imaarat-ai.vercel.app/api/status` reports the new version and the change is visible on the live site.
4. State what was verified and how. Re-check live state before reporting it; never claim something is deployed, fixed or passing without that evidence.
