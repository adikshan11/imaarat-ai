---
description: Working rules for every task in this repository
---

# Workflow

- Before acting, run `git status --short`, `git branch --show-current` and `git log -1 --oneline`, then say in one sentence which branch and version you are on.
- Read the code, tests and workflow that own the behaviour before changing it. Do not guess paths, settings or limits; find them.
- Test locally first where possible, then let CI and preprod prove it before production.
- Only `main` and `preprod` exist. Work and commit directly on `preprod`, started from its latest remote state; never create another branch. Keep each commit to one purpose. Do not touch unrelated files or reformat code you did not change.
- Never print or commit secrets, `.env` files or tokens. Never paste a token into chat.
- Delete scratch scripts and output files when a check is done.
- Report what was verified, how, and what was not. Re-check live state (CI run, deploy, `/api/status`) right before reporting it.
- Ask before anything that spends the daily AI allowance, writes to the shared database, or changes Vercel, GitHub or Langfuse settings.
