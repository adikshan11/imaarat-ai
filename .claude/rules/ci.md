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
- CI runs only on pushes to `preprod` or `main`. The release pull request reuses the checks of its `preprod` commit; the forced post-release reset of `preprod` skips every job.
- Workflows must pass `yamllint --strict`, `check-jsonschema --builtin-schema vendor.github-workflows` and `actionlint`; shell scripts must pass `shellcheck`.
- CI-only changes are committed on `preprod` like any other work and need no version bump or changelog entry.
