#!/usr/bin/env bash
# Every JSON file must parse; hand-edited ones must also match `jq --indent 2` formatting.
set -euo pipefail

status=0
while IFS= read -r file; do
  if ! jq empty "$file" 2>/dev/null; then
    echo "Invalid JSON: $file"
    status=1
    continue
  fi
  case "$file" in
    frontend/package-lock.json | backend/data/*) continue ;;
  esac
  if ! diff -q <(jq --indent 2 . "$file") "$file" >/dev/null; then
    echo "Not formatted like jq --indent 2: $file"
    status=1
  fi
done < <(git ls-files '*.json' ':!:frontend/tsconfig*.json')

if [[ $status -eq 0 ]]; then
  echo "All JSON files are valid and formatted"
fi
exit "$status"
