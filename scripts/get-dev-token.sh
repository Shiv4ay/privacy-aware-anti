#!/usr/bin/env bash
set -e
API_URL="${API_URL:-http://127.0.0.1:3001}"
DEV_KEY="${DEV_AUTH_KEY:-super-secret-dev-key}"

resp=$(curl -sS -X POST -H "Content-Type: application/json" -H "x-dev-auth-key:${DEV_KEY}" --data-raw '{}' "${API_URL}/api/dev/token")
# print token (jq recommended)
if command -v jq >/dev/null 2>&1; then
  echo "$resp" | jq -r .token
else
  echo "$resp"
fi
