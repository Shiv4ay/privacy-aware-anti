"""
Verify ChromaDB coverage — every student in students.csv must have
at least 1 indexed chunk in the privacy_documents_4 collection.

Runs a single Python call inside the worker container to batch-query
ChromaDB, so the check completes in one docker exec round-trip.

Usage (from repo root):
    python backend/scripts/check_coverage.py

Output:
    Console summary table + missing_coverage.txt (empty if all covered)
"""

import csv
import json
import os
import subprocess
import sys

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT  = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))

_csv_candidates = [
    os.path.join(REPO_ROOT, "Datasets", "University", "pes_mca_dataset"),
    os.path.join(REPO_ROOT, "..", "Datasets", "University", "pes_mca_dataset"),
]
CSV_BASE = next((p for p in _csv_candidates if os.path.isdir(p)), None)
if CSV_BASE is None:
    print("[ERROR] pes_mca_dataset directory not found.", file=sys.stderr)
    sys.exit(1)

STUDENTS_CSV  = os.path.join(CSV_BASE, "students.csv")
MISSING_FILE  = os.path.join(SCRIPT_DIR, "missing_coverage.txt")

DOCKER_WORKER = "privacy-aware-worker"


# ── Load SRNs from CSV ────────────────────────────────────────────────────────

def load_srns() -> list[str]:
    srns = []
    with open(STUDENTS_CSV, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f, skipinitialspace=True)
        for raw_row in reader:
            # Header keys have trailing spaces; strip them
            row = {k.strip(): (v.strip() if v else "") for k, v in raw_row.items() if k}
            srn = row.get("srn", "")
            if srn:
                srns.append(srn)
    return srns


# ── Query ChromaDB inside worker container ────────────────────────────────────

_CHROMA_SCRIPT = """
import json, sys
import chromadb

srns = json.loads(sys.argv[1])
client = chromadb.HttpClient(host='chromadb', port=8000)
col = client.get_collection('privacy_documents_4')

coverage = {}
for srn in srns:
    try:
        result = col.get(
            where={'source_id': {'$eq': srn}},
            limit=1,
            include=[]
        )
        coverage[srn] = len(result['ids'])
    except Exception as e:
        coverage[srn] = -1  # error

print(json.dumps(coverage))
"""


def check_chromadb_coverage(srns: list[str]) -> dict[str, int]:
    """Returns {srn: chunk_count}. Negative value = query error."""
    srns_json = json.dumps(srns)
    result = subprocess.run(
        ["docker", "exec", DOCKER_WORKER,
         "python", "-c", _CHROMA_SCRIPT, srns_json],
        capture_output=True, text=True, timeout=300
    )
    if result.returncode != 0:
        print(f"[ERROR] ChromaDB query failed:\n{result.stderr[:500]}", file=sys.stderr)
        sys.exit(1)

    # Last line of stdout should be the JSON dict
    for line in reversed(result.stdout.splitlines()):
        line = line.strip()
        if line.startswith("{"):
            return json.loads(line)

    print(f"[ERROR] Unexpected output from ChromaDB script:\n{result.stdout[:300]}")
    sys.exit(1)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    srns = load_srns()
    total = len(srns)
    print(f"[INFO] Checking ChromaDB coverage for {total} students...")

    coverage = check_chromadb_coverage(srns)

    covered   = [s for s, c in coverage.items() if c > 0]
    missing   = [s for s, c in coverage.items() if c == 0]
    errored   = [s for s, c in coverage.items() if c < 0]
    not_in_db = [s for s in srns if s not in coverage]

    truly_missing = missing + not_in_db

    print()
    print(f"{'SRN Coverage Report':=^60}")
    print(f"  Total students      : {total}")
    print(f"  Covered (>=1 chunk) : {len(covered)}")
    print(f"  Missing (0 chunks)  : {len(truly_missing)}")
    if errored:
        print(f"  Query errors        : {len(errored)}")
    print("=" * 60)

    if truly_missing:
        print(f"\n[WARN] {len(truly_missing)} SRNs have NO ChromaDB chunks:")
        for srn in truly_missing[:20]:
            print(f"  - {srn}")
        if len(truly_missing) > 20:
            print(f"  ... and {len(truly_missing) - 20} more (see {MISSING_FILE})")

        with open(MISSING_FILE, "w", encoding="utf-8") as f:
            f.write("\n".join(truly_missing) + "\n")
        print(f"\n[SAVED] Missing SRNs written to {MISSING_FILE}")
        print(
            "\n[ACTION NEEDED] Re-index missing students:\n"
            "  1. docker exec privacy-aware-postgres psql -U postgres privacy_docs \\\n"
            "       -c \"UPDATE documents SET status='pending' WHERE org_id=4 AND status='processed';\"\n"
            "  2. docker exec privacy-aware-worker python -c \\\n"
            "       \"import requests; r=requests.post('http://localhost:8001/process-batch"
            "?org_id=4&batch_size=50',timeout=10); print(r.json())\"\n"
            "  3. Run this script again after indexing completes."
        )
    else:
        # Write empty file to signal success
        with open(MISSING_FILE, "w", encoding="utf-8") as f:
            f.write("")
        print(f"\n[OK] All {total} students have ChromaDB coverage (>=1 chunk each).")
        print(f"[SAVED] {MISSING_FILE} is empty (no missing SRNs).")


if __name__ == "__main__":
    main()
