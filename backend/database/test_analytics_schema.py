"""
TDD Test: Verify that placements and internships analytics tables exist
with the correct columns and constraints.

Run against the live Postgres container:
  python backend/database/test_analytics_schema.py
"""
import os
import sys
import psycopg2

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres123@localhost:5432/privacy_aware_db"
)

def get_conn():
    return psycopg2.connect(DB_URL)

def test_placements_table_exists(cur):
    cur.execute("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'placements'
        ORDER BY ordinal_position
    """)
    cols = {row[0]: row[1] for row in cur.fetchall()}
    required = {
        "placement_id", "org_id", "student_id", "company_id",
        "position", "salary", "placement_date", "location",
        "employment_type", "status"
    }
    missing = required - cols.keys()
    assert not missing, f"placements table missing columns: {missing}"
    assert cols["org_id"] in ("integer", "bigint"), "org_id must be integer"
    assert cols["salary"] in ("numeric", "double precision", "integer", "bigint"), "salary must be numeric"
    print("  [PASS] placements table — all required columns present")

def test_internships_table_exists(cur):
    cur.execute("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'internships'
        ORDER BY ordinal_position
    """)
    cols = {row[0]: row[1] for row in cur.fetchall()}
    required = {
        "internship_id", "org_id", "student_id", "company_id",
        "position", "start_date", "end_date", "stipend",
        "location", "status", "supervisor"
    }
    missing = required - cols.keys()
    assert not missing, f"internships table missing columns: {missing}"
    assert cols["org_id"] in ("integer", "bigint"), "org_id must be integer"
    assert cols["stipend"] in ("numeric", "double precision", "integer", "bigint"), "stipend must be numeric"
    print("  [PASS] internships table — all required columns present")

def test_org_id_index_exists(cur):
    cur.execute("""
        SELECT indexname FROM pg_indexes
        WHERE tablename IN ('placements', 'internships')
        AND indexname LIKE '%org_id%'
    """)
    indexes = [row[0] for row in cur.fetchall()]
    assert len(indexes) >= 2, f"Expected at least 2 org_id indexes, got: {indexes}"
    print(f"  [PASS] org_id indexes present: {indexes}")

def test_student_id_index_exists(cur):
    cur.execute("""
        SELECT indexname FROM pg_indexes
        WHERE tablename IN ('placements', 'internships')
        AND indexname LIKE '%student_id%'
    """)
    indexes = [row[0] for row in cur.fetchall()]
    assert len(indexes) >= 2, f"Expected at least 2 student_id indexes, got: {indexes}"
    print(f"  [PASS] student_id indexes present: {indexes}")

if __name__ == "__main__":
    print("Running analytics schema tests...")
    failed = 0
    try:
        conn = get_conn()
        cur = conn.cursor()
        tests = [
            test_placements_table_exists,
            test_internships_table_exists,
            test_org_id_index_exists,
            test_student_id_index_exists,
        ]
        for t in tests:
            try:
                t(cur)
            except AssertionError as e:
                print(f"  [FAIL] {t.__name__}: {e}")
                failed += 1
            except Exception as e:
                print(f"  [ERROR] {t.__name__}: {e}")
                failed += 1
        cur.close()
        conn.close()
    except Exception as e:
        print(f"  [ERROR] Could not connect to DB: {e}")
        sys.exit(1)

    if failed:
        print(f"\n{failed} test(s) FAILED — run the DDL schema first.")
        sys.exit(1)
    else:
        print("\nAll tests PASSED.")
