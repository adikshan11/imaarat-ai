#!/usr/bin/env bash
set -euo pipefail

target=$(mktemp -d)
pip install --quiet --disable-pip-version-check --no-compile --target "$target" -r requirements.txt
total=$(du -sm "$target" | cut -f1)

{
  echo "### Vercel function dependencies: ${total} MB unpacked (budget ${BUDGET_MB} MB)"
  echo
  echo "| Package | MB |"
  echo "| --- | --- |"
  du -sm "$target"/* | sort -rn | head -15 | while read -r size path; do
    echo "| $(basename "$path") | $size |"
  done
} >> "$GITHUB_STEP_SUMMARY"

if [ "$total" -gt "$BUDGET_MB" ]; then
  echo "::error::The function's dependencies are ${total} MB, over the ${BUDGET_MB} MB budget"
  exit 1
fi
echo "Function dependencies: ${total} MB of ${BUDGET_MB} MB"
