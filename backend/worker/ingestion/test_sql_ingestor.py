"""
TDD Test: Verify dual ingestion writes placement/internship rows to Postgres.

Run against live Postgres container:
  DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/privacy_aware" \
  python backend/worker/ingestion/test_sql_ingestor.py
"""
import os
import sys
import csv
import tempfile
import psycopg2

# Allow importing from worker root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from ingestion.sql_ingestor import ingest_to_sql

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres123@localhost:5432/privacy_aware"
)
TEST_ORG_ID = 9999  # isolated test org — cleaned up after each run

PLACEMENT_ROWS = [
    {"placement_id": "TPLC001", "student_id": "PES1PG24CA001", "company_id": "COMP_TEST1",
     "position": "SWE", "salary": "1200000", "placement_date": "2025-08-01",
     "location": "Bangalore", "employment_type": "Full-time", "status": "Placed"},
    {"placement_id": "TPLC002", "student_id": "PES1PG24CA002", "company_id": "COMP_TEST2",
     "position": "Data Analyst", "salary": "850000", "placement_date": "2025-09-15",
     "location": "Chennai", "employment_type": "Full-time", "status": "Placed"},
]

INTERNSHIP_ROWS = [
    {"internship_id": "TINT001", "student_id": "PES1PG24CA001", "company_id": "COMP_TEST1",
     "position": "SWE Intern", "start_date": "2024-11-01", "end_date": "2025-03-01",
     "stipend": "20000", "location": "Bangalore", "status": "Completed",
     "supervisor": "Test Supervisor"},
]


def get_conn():
    return psycopg2.connect(DB_URL)


def cleanup(cur):
    cur.execute("DELETE FROM placements WHERE org_id = %s", (TEST_ORG_ID,))
    cur.execute("DELETE FROM internships WHERE org_id = %s", (TEST_ORG_ID,))


def make_csv(rows: list, tmp_dir: str, name: str) -> str:
    path = os.path.join(tmp_dir, name)
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    return path


def test_placements_inserted(cur, tmp_dir):
    path = make_csv(PLACEMENT_ROWS, tmp_dir, "placements.csv")
    count = ingest_to_sql(path, "placements.csv", TEST_ORG_ID, cur)
    assert count == len(PLACEMENT_ROWS), f"Expected {len(PLACEMENT_ROWS)} rows, got {count}"

    cur.execute("SELECT placement_id, salary FROM placements WHERE org_id = %s ORDER BY placement_id", (TEST_ORG_ID,))
    rows = cur.fetchall()
    assert len(rows) == len(PLACEMENT_ROWS), f"DB has {len(rows)} rows, expected {len(PLACEMENT_ROWS)}"
    assert rows[0][0] == "TPLC001"
    assert float(rows[0][1]) == 1200000.0, f"salary mismatch: {rows[0][1]}"
    print("  [PASS] placements — rows inserted with correct salary")


def test_internships_inserted(cur, tmp_dir):
    path = make_csv(INTERNSHIP_ROWS, tmp_dir, "internships.csv")
    count = ingest_to_sql(path, "internships.csv", TEST_ORG_ID, cur)
    assert count == len(INTERNSHIP_ROWS), f"Expected {len(INTERNSHIP_ROWS)} rows, got {count}"

    cur.execute("SELECT internship_id, stipend FROM internships WHERE org_id = %s", (TEST_ORG_ID,))
    rows = cur.fetchall()
    assert len(rows) == len(INTERNSHIP_ROWS)
    assert rows[0][0] == "TINT001"
    assert float(rows[0][1]) == 20000.0
    print("  [PASS] internships — rows inserted with correct stipend")


def test_upsert_idempotent(cur, tmp_dir):
    """Running ingestion twice should not duplicate rows."""
    path = make_csv(PLACEMENT_ROWS, tmp_dir, "placements.csv")
    ingest_to_sql(path, "placements.csv", TEST_ORG_ID, cur)
    ingest_to_sql(path, "placements.csv", TEST_ORG_ID, cur)

    cur.execute("SELECT COUNT(*) FROM placements WHERE org_id = %s", (TEST_ORG_ID,))
    total = cur.fetchone()[0]
    assert total == len(PLACEMENT_ROWS), f"Expected {len(PLACEMENT_ROWS)} after double-insert, got {total}"
    print("  [PASS] upsert is idempotent — no duplicate rows on re-ingestion")


def test_non_csv_returns_zero(cur, tmp_dir):
    """Non-placement/internship filenames should return 0 (skip SQL)."""
    path = make_csv(PLACEMENT_ROWS, tmp_dir, "students.csv")
    count = ingest_to_sql(path, "students.csv", TEST_ORG_ID, cur)
    assert count == 0, f"Expected 0 for non-structured file, got {count}"
    print("  [PASS] non-structured CSV returns 0 — no SQL writes")


if __name__ == "__main__":
    print("Running dual ingestion SQL tests...")
    failed = 0
    try:
        conn = get_conn()
        cur = conn.cursor()
        cleanup(cur)
        conn.commit()

        with tempfile.TemporaryDirectory() as tmp_dir:
            tests = [
                test_placements_inserted,
                test_internships_inserted,
                test_upsert_idempotent,
                test_non_csv_returns_zero,
            ]
            for t in tests:
                cleanup(cur)
                conn.commit()
                try:
                    t(cur, tmp_dir)
                    conn.commit()
                except AssertionError as e:
                    print(f"  [FAIL] {t.__name__}: {e}")
                    conn.rollback()
                    failed += 1
                except Exception as e:
                    print(f"  [ERROR] {t.__name__}: {e}")
                    conn.rollback()
                    failed += 1

        cleanup(cur)
        conn.commit()
        cur.close()
        conn.close()

    except Exception as e:
        print(f"  [ERROR] DB connection failed: {e}")
        sys.exit(1)

    if failed:
        print(f"\n{failed} test(s) FAILED.")
        sys.exit(1)
    else:
        print("\nAll tests PASSED.")
