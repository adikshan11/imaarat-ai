#!/usr/bin/env bash
# Checks a running site: /api/status reports this checkout's version, every public page returns 200, security headers are set.
# Usage: smoke_check.sh <site>. Set BYPASS to send Vercel's protection-bypass header for preview deployments.
set -euo pipefail
site=${1%/}
expected=$(sed -n 's/^__version__ = "\(.*\)"/\1/p' backend/app/__init__.py)
header=()
if [ -n "${BYPASS:-}" ]; then header=(-H "x-vercel-protection-bypass: $BYPASS"); fi

live=""
for _ in $(seq 1 30); do
  live=$(curl -fsS "${header[@]}" "$site/api/status" | python3 -c 'import json, sys; print(json.load(sys.stdin)["version"])' || true)
  [ "$live" = "$expected" ] && break
  sleep 5
done
[ "$live" = "$expected" ] || { echo "::error::$site reports version '$live', expected $expected"; exit 1; }

for path in / /app/ /privacy/ /terms/ /changelog/; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "${header[@]}" "$site$path")
  [ "$code" = "200" ] || { echo "::error::$site$path returned $code"; exit 1; }
done
curl -sI "${header[@]}" "$site/app/" | grep -qi '^content-security-policy:' || { echo "::error::security headers missing on $site/app/"; exit 1; }
echo "$site: version $expected, every public page 200, security headers present"
