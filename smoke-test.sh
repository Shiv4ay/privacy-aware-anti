#!/usr/bin/env bash
set -euo pipefail

API_HOST="127.0.0.1"
API_PORT=3001
FRONTEND_HOST="127.0.0.1"
FRONTEND_PORT=3002

echo "1) Waiting for API health (http://${API_HOST}:${API_PORT}/api/health)..."
for i in {1..30}; do
  if curl -sS "http://${API_HOST}:${API_PORT}/api/health" -m 3 >/dev/null 2>&1; then
    echo "   API healthy"
    break
  fi
  echo -n "."
  sleep 2
done

echo
echo "2) Check frontend root (http://${FRONTEND_HOST}:${FRONTEND_PORT}/) and proxy health (/api/health via frontend)..."
curl -I "http://${FRONTEND_HOST}:${FRONTEND_PORT}/" || true
echo
curl -sS "http://${FRONTEND_HOST}:${FRONTEND_PORT}/api/health" || true
echo

echo "3) Perform sample search POST to API gateway (http://${API_HOST}:${API_PORT}/api/search)"
PAYLOAD='{"query":"What is GDPR?"}'
HTTP_CODE=$(curl -sS -w "%{http_code}" -o /tmp/smoke_resp.json -X POST "http://${API_HOST}:${API_PORT}/api/search" \
  -H "Content-Type: application/json" -d "$PAYLOAD" || true)

echo "HTTP status: $HTTP_CODE"
echo "Response (first 1000 chars):"
head -c 1000 /tmp/smoke_resp.json || true
echo
echo "Saved full response to /tmp/smoke_resp.json"

echo "4) Perform same search through frontend proxy (http://${FRONTEND_HOST}:${FRONTEND_PORT}/api/search)"
HTTP_CODE_F=$(curl -sS -w "%{http_code}" -o /tmp/smoke_resp_front.json -X POST "http://${FRONTEND_HOST}:${FRONTEND_PORT}/api/search" \
  -H "Content-Type: application/json" -d "$PAYLOAD" || true)
echo "Proxy HTTP status: $HTTP_CODE_F"
echo "Proxy response sample:"
head -c 1000 /tmp/smoke_resp_front.json || true
echo "Saved full frontend-proxied response to /tmp/smoke_resp_front.json"

echo "SMOKE TEST COMPLETE."
