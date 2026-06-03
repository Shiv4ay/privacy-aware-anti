"""
Check bulk test progress and auto-run validation + report when complete.

Usage:
    python backend/scripts/check_and_finalize.py

Run this at any time to see how many queries are done.
If the bulk test is complete, it automatically runs validate + report.
"""

import json
import os
import subprocess
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RESULTS_FILE = os.path.join(SCRIPT_DIR, "results.jsonl")
VALIDATION_FILE = os.path.join(SCRIPT_DIR, "validation_results.jsonl")
REPORT_FILE = os.path.join(SCRIPT_DIR, "test_report.html")
QUERY_FILE = os.path.join(SCRIPT_DIR, "queries.jsonl")
TOTAL_QUERIES = 1105


def load_results():
    if not os.path.exists(RESULTS_FILE):
        return []
    results = []
    with open(RESULTS_FILE, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    results.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return results


def deduplicate_results(results: list) -> list:
    """For any query_id that appears multiple times, keep the 200 OK record
    if one exists; otherwise keep the last record. Rewrites results.jsonl."""
    seen: dict = {}
    for r in results:
        qid = r.get("query_id")
        if qid not in seen:
            seen[qid] = r
        else:
            # Prefer 200 OK over error
            existing = seen[qid]
            if r.get("status_code") == 200 and existing.get("status_code") != 200:
                seen[qid] = r
            elif r.get("status_code") != 200 and existing.get("status_code") == 200:
                pass  # keep existing OK
            else:
                seen[qid] = r  # keep most recent
    deduped = list(seen.values())
    if len(deduped) < len(results):
        removed = len(results) - len(deduped)
        print(f"[DEDUP] Removed {removed} duplicate result(s), {len(deduped)} unique queries remain")
        with open(RESULTS_FILE, "w", encoding="utf-8") as f:
            for r in deduped:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
    return deduped


def main():
    results = load_results()
    results = deduplicate_results(results)
    total_done = len(results)

    if total_done == 0:
        print("[INFO] No results yet. Is run_bulk_test.py running?")
        print(f"  Start it with: python backend/scripts/run_bulk_test.py")
        return

    errors = [r for r in results if r.get("status_code", 0) not in (200,) or r.get("status") == "error"]
    ok = total_done - len(errors)
    pct = 100 * total_done // TOTAL_QUERIES

    from collections import Counter
    cat_counts = Counter(r["category"] for r in results)
    status_counts = Counter(r.get("status_code", 0) for r in results)

    print(f"\n{'Bulk Test Progress':=^60}")
    print(f"  Done: {total_done}/{TOTAL_QUERIES} ({pct}%)")
    print(f"  OK (200): {ok}  |  Errors: {len(errors)}")
    print(f"  Status codes: {dict(status_counts)}")
    print(f"  Categories: A={cat_counts.get('A',0)}, B={cat_counts.get('B',0)}, "
          f"C={cat_counts.get('C',0)}, D={cat_counts.get('D',0)}, "
          f"E={cat_counts.get('E',0)}, F={cat_counts.get('F',0)}")

    if total_done < TOTAL_QUERIES:
        remaining = TOTAL_QUERIES - total_done
        print(f"\n  Remaining: {remaining} queries")
        print("  [TEST IS STILL RUNNING — check back later]")
        print("\nTo restart if the process died:")
        print("  MAX_WORKERS=5 python backend/scripts/run_bulk_test.py")
        print("  (Resume is automatic — already-completed queries are skipped)")
        return

    print(f"\n  [COMPLETE] All {TOTAL_QUERIES} queries done!")
    print("\nRunning validation...")
    result = subprocess.run(
        [sys.executable, os.path.join(SCRIPT_DIR, "validate_responses.py")],
        capture_output=False
    )
    if result.returncode != 0:
        print("[ERROR] Validation failed")
        return

    print("\nGenerating HTML report...")
    result = subprocess.run(
        [sys.executable, os.path.join(SCRIPT_DIR, "generate_report.py")],
        capture_output=False
    )
    if result.returncode != 0:
        print("[ERROR] Report generation failed")
        return

    print(f"\n[DONE] Report saved to: {REPORT_FILE}")
    print(f"  Open with: start {REPORT_FILE}")
    try:
        os.startfile(REPORT_FILE)
    except Exception:
        pass


if __name__ == "__main__":
    main()
