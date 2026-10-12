---
name: release
description: Pushes work on preprod, proves it on the preprod deploy, releases it to production and resets preprod afterwards. Use when the user says ship, release, merge, deploy or promote to production.
---

# Release

Run in the repository root on `preprod` with the GitHub CLI signed in to the account that owns the repository. Only `main` and `preprod` exist; there are no feature branches.

1. Confirm the work is ready: run the `pr-ready` skill first.
2. Push: `git push origin preprod`.
3. Watch the push run: `gh run list --branch preprod --limit 1`, then `gh run watch <run-id>`. Tests, deploy, smoke check and stress test must pass. If one fails, read `gh run view <run-id> --log-failed`, fix it with another commit on `preprod` and push again. Check `https://imaarat-ai-preprod.vercel.app/api/status` shows the new version.
4. Release: `gh pr create --base main --head preprod --title "Release X.Y.Z" --body-file <file>` with the body from `.github/pull_request_template.md` (`Version: *X.Y.Z*`, one "This PR ..." sentence, Type of change and Checks ticked only where true). Wait with `gh pr checks <number> --watch`, then `gh pr merge <number> --rebase`.
5. Watch the `main` run, then confirm `https://imaarat-ai.vercel.app/api/status` reports the new version and the change is visible live (run the `live-check` skill).
6. Reset `preprod` to `main` (repository admin only):
   ```bash
   git fetch -q origin
   git push -q --force-with-lease=preprod:"$(git rev-parse origin/preprod)" origin origin/main:refs/heads/preprod
   git fetch -q origin && git reset --keep origin/preprod
   ```
   The resulting CI run skips the deploy because the commit is already on `main`.

Ask the user before steps 2, 4 and 6. Never merge with failing or pending checks.
