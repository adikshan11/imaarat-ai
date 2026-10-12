---
name: release
description: Takes a finished branch through preprod to production and resets preprod afterwards. Use when the user says ship, release, merge, deploy or promote to production.
---

# Release

Run in the repository root with the GitHub CLI signed in to the account that owns the repository.

1. Confirm the branch is ready: run the `pr-ready` skill first.
2. Push and open the pull request against `preprod`:
   ```bash
   git push -u origin "$(git branch --show-current)"
   gh pr create --base preprod --title "<one line>" --body "Version: *X.Y.Z*

   This PR <what changes for users>."
   ```
   Keep the rest of `.github/pull_request_template.md` (Type of change, Checks) and tick only what is true.
3. Wait for every check: `gh pr checks <number> --watch`. If one fails, read its log with `gh run view <run-id> --log-failed`, fix it on the branch and push again.
4. Merge: `gh pr merge <number> --rebase --delete-branch`.
5. Watch the push run on `preprod`: `gh run list --branch preprod --limit 1`, then `gh run watch <run-id>`. Deploy, smoke check and stress test must pass. Check `https://imaarat-ai-preprod.vercel.app/api/status` shows the new version.
6. Release: `gh pr create --base main --head preprod --title "Release X.Y.Z" --body "Version: *X.Y.Z*

   This PR releases X.Y.Z to production."`, wait for checks, then `gh pr merge <number> --rebase`.
7. Watch the `main` run, then confirm `https://imaarat-ai.vercel.app/api/status` reports the new version and the change is visible live (run the `live-check` skill).
8. Reset `preprod` to `main` (repository admin only, after asking the user):
   ```bash
   git fetch -q origin
   git push -q --force-with-lease=preprod:"$(git rev-parse origin/preprod)" origin origin/main:refs/heads/preprod
   ```
   The resulting CI run skips the deploy because the commit is already on `main`.
9. Update local branches: `git switch main && git pull --ff-only`.

Ask the user before steps 2, 4, 6 and 8. Never merge with failing or pending checks.
