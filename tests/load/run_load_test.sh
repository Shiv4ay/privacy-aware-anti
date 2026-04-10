#!/usr/bin/env bash
# Run the Locust load test and check thresholds.
# Usage: bash tests/load/run_load_test.sh [host]
set -euo pipefail

HOST="${1:-http://localhost:3001}"
RESULTS_DIR="$(mktemp -d)"
CSV_PREFIX="${RESULTS_DIR}/load"

echo "=== Load Test: ${HOST} ==="
echo "Users: 20 | Spawn rate: 2/s | Duration: 60s"

LOCUST_EXIT=0
locust \
  -f "$(dirname "$0")/locustfile.py" \
  --host "${HOST}" \
  --headless \
  --users 20 \
  --spawn-rate 2 \
  --run-time 60s \
  --csv "${CSV_PREFIX}" \
  --loglevel WARNING || LOCUST_EXIT=$?

STATS_FILE="${CSV_PREFIX}_stats.csv"

if [ ! -f "${STATS_FILE}" ]; then
  echo "ERROR: Load test did not produce results (locust exit code ${LOCUST_EXIT})"
  echo "       Check that the target host '${HOST}' is reachable."
  exit 1
fi

echo ""
echo "=== Results ==="
cat "${STATS_FILE}"

python3 - "${STATS_FILE}" <<'PYEOF'
import csv, sys

stats_file = sys.argv[1]
errors = []
with open(stats_file) as f:
    for row in csv.DictReader(f):
        name = row.get('Name', '')
        if name == 'Aggregated':
            continue
        total = float(row.get('Request Count', 1) or 1)
        fails = float(row.get('Failure Count', 0) or 0)
        fail_pct = fails / total * 100
        p95 = float(row.get('95%', 0) or 0)
        if fail_pct > 10:
            errors.append(f"FAIL: {name} error rate {fail_pct:.1f}% > 10%")
        if name == '/api/chat' and p95 > 10000:
            errors.append(f"FAIL: /api/chat p95 {p95:.0f}ms > 10000ms")
        if name == '/healthz' and p95 > 500:
            errors.append(f"FAIL: /healthz p95 {p95:.0f}ms > 500ms")

if errors:
    print("\n=== THRESHOLD VIOLATIONS ===")
    for e in errors: print(e)
    sys.exit(1)
print("\n=== All thresholds PASSED ===")
PYEOF
