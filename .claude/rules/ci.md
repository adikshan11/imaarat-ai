---
description: Rules for GitHub workflows and repository scripts
paths:
  - ".github/**"
applyTo: ".github/**"
---

# CI and workflows

- Pin every action to a full commit SHA and every downloaded tool to a version with a SHA-256 check, as the existing steps do.
- Keep `permissions` minimal, `persist-credentials: false` on checkouts, and a `timeout-minutes` on every job.
- Secrets reach a step only through `env`, never inline in `run`.
- Deploys run only on a push to `preprod` or `main`; pull requests never deploy.
- Workflows must pass `yamllint --strict`, `check-jsonschema --builtin-schema vendor.github-workflows` and `actionlint`; shell scripts must pass `shellcheck`.
- `ci/` branches change only CI and need no version bump or changelog entry.
