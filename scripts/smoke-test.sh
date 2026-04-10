#!/usr/bin/env bash
# Post-deploy smoke test — sanity check of all public endpoints.
# Usage: bash scripts/smoke-test.sh [api_host] [worker_host]
# Exit 0 on all-pass, exit 1 on any failure.
set -euo pipefail

# Require curl — fail early with a clear message rather than cryptic errors
command -v curl >/dev/null 2>&1 || { echo "ERROR: curl not found — install it before running smoke tests"; exit 1; }

API_HOST="${1:-http://localhost:3001}"
WORKER_HOST="${2:-http://localhost:8001}"
DEV_AUTH="${DEV_AUTH_KEY:-super-secret-dev-key}"

PASS=0
FAIL=0

check() {
  local name="$1"
  local url="$2"
  local expected_status="$3"

  actual=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "x-dev-auth: ${DEV_AUTH}" \
    "${url}" 2>/dev/null || echo "000")

  if [ "${actual}" = "${expected_status}" ]; then
    echo "  PASS  ${name} -> ${actual}"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  ${name} -> got ${actual}, expected ${expected_status}"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Smoke Test: ${API_HOST} ==="
echo ""
echo "--- API Gateway ---"
check "API /healthz"     "${API_HOST}/healthz"     200
check "API /metrics"     "${API_HOST}/metrics"     200
check "API /api/health"  "${API_HOST}/api/health"  200

echo ""
echo "--- Worker (internal) ---"
if curl -sf "${WORKER_HOST}/health" > /dev/null 2>&1; then
  check "Worker /health"  "${WORKER_HOST}/health"  200
  check "Worker /ready"   "${WORKER_HOST}/ready"   200
else
  echo "  SKIP  Worker checks (${WORKER_HOST} unreachable from this host)"
fi

echo ""
echo "==================================="
echo "Results: ${PASS} passed, ${FAIL} failed"
echo "==================================="

[ "${FAIL}" -eq 0 ] && exit 0 || exit 1
