---
name: pr-ready
description: Runs the pre-push checklist for this repository (branch, version bump, changelog, lint, tests, line endings, secrets). Use before committing, pushing or opening the release pull request.
---

# PR ready

1. Branch: `git branch --show-current` is `preprod`, and `git fetch -q origin && git log --oneline HEAD..origin/preprod` prints nothing.
2. Diff: `git diff --stat origin/main...HEAD` plus `git status --short` show only intended files. `git diff --check origin/main...HEAD` prints nothing.
3. Version, for user-visible changes: if `origin/main` is still on the same version, bump it once in `backend/app/__init__.py`, `frontend/package.json` and both version fields at the top of `frontend/package-lock.json`, and add a plain-English entry at the top of `CHANGELOG.md`; if already bumped since the release, add to that entry. `python3 .github/scripts/release_check.py` passes.
4. Line endings: `git ls-files --eol -- $(git diff --name-only origin/main...HEAD)` shows `i/lf` for every changed file.
5. Checks for what changed (see the Checks table in `AGENTS.md`):
   - Python: `ruff check backend pipeline` and `ruff format --check backend pipeline`, then `cd backend && pytest -q --timeout=120`.
   - Frontend: `cd frontend && npm run check:locales && npm run lint && npm run check:deprecated && npm run build && npm test && npm run test:browser`.
   - JSON: `bash .github/scripts/check_json.sh`.
   - Workflows and scripts: `yamllint --strict`, `actionlint`, `shellcheck`.
   If a check cannot run locally, say so and let CI run it; never claim it passed.
6. Secrets: nothing in the diff looks like a key, token or password, and no `.env` file is staged.
7. Code: no comments, one-line docstrings, no leading-underscore names, no debug output, scratch files deleted.

Report each item as passed, failed or not run, with the command output that proves it.
