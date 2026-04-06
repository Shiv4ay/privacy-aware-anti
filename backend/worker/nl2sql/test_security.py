"""
TDD Test — Task 6: SQL Security / Hardening Parser.

Validation from TASKS.md:
  A malicious query attempt ("Give me all students") fails execution,
  while a scoped query (WHERE org_id = 4) succeeds.

Run:
  DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/privacy_aware" \
  python backend/worker/nl2sql/test_security.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from nl2sql.security import validate_sql, SQLSecurityError

ORG_ID = 4


# ── VALID queries (must PASS) ────────────────────────────────────────────────

def test_valid_select_with_org_id():
    sql = "SELECT MAX(salary) FROM placements WHERE org_id = 4"
    result = validate_sql(sql, org_id=ORG_ID)
    assert result == sql.strip()
    print("  [PASS] valid SELECT with org_id passes")


def test_valid_with_additional_conditions():
    sql = "SELECT COUNT(*) FROM internships WHERE org_id = 4 AND status = 'Completed'"
    validate_sql(sql, org_id=ORG_ID)
    print("  [PASS] valid SELECT with extra conditions passes")


def test_valid_with_org_id_in_and_clause():
    sql = "SELECT AVG(salary) FROM placements WHERE status = 'Placed' AND org_id = 4"
    validate_sql(sql, org_id=ORG_ID)
    print("  [PASS] org_id in AND clause passes")


def test_valid_case_insensitive_where():
    sql = "select count(*) from placements where ORG_ID = 4"
    validate_sql(sql, org_id=ORG_ID)
    print("  [PASS] case-insensitive WHERE org_id passes")


# ── DANGEROUS queries (must RAISE SQLSecurityError) ─────────────────────────

def test_missing_org_id_filter():
    """SELECT without org_id — cross-tenant data leak."""
    try:
        validate_sql("SELECT * FROM placements", org_id=ORG_ID)
        raise AssertionError("Should have raised SQLSecurityError")
    except SQLSecurityError as e:
        assert "org_id" in str(e).lower()
        print(f"  [PASS] missing org_id blocked: {e}")


def test_wrong_org_id():
    """Query for a different org_id — cross-tenant violation."""
    try:
        validate_sql("SELECT * FROM placements WHERE org_id = 9999", org_id=ORG_ID)
        raise AssertionError("Should have raised SQLSecurityError")
    except SQLSecurityError as e:
        print(f"  [PASS] wrong org_id blocked: {e}")


def test_drop_table_blocked():
    try:
        validate_sql("DROP TABLE placements", org_id=ORG_ID)
        raise AssertionError("Should have raised SQLSecurityError")
    except SQLSecurityError as e:
        print(f"  [PASS] DROP TABLE blocked: {e}")


def test_delete_blocked():
    try:
        validate_sql("DELETE FROM placements WHERE org_id = 4", org_id=ORG_ID)
        raise AssertionError("Should have raised SQLSecurityError")
    except SQLSecurityError as e:
        print(f"  [PASS] DELETE blocked: {e}")


def test_insert_blocked():
    try:
        validate_sql("INSERT INTO placements VALUES (1,2,3)", org_id=ORG_ID)
        raise AssertionError("Should have raised SQLSecurityError")
    except SQLSecurityError as e:
        print(f"  [PASS] INSERT blocked: {e}")


def test_update_blocked():
    try:
        validate_sql("UPDATE placements SET salary = 0 WHERE org_id = 4", org_id=ORG_ID)
        raise AssertionError("Should have raised SQLSecurityError")
    except SQLSecurityError as e:
        print(f"  [PASS] UPDATE blocked: {e}")


def test_disallowed_table_blocked():
    """Agent must not query users or audit_logs."""
    try:
        validate_sql("SELECT * FROM users WHERE org_id = 4", org_id=ORG_ID)
        raise AssertionError("Should have raised SQLSecurityError")
    except SQLSecurityError as e:
        print(f"  [PASS] disallowed table (users) blocked: {e}")


def test_sql_injection_attempt():
    """Classic injection: 1=1 to bypass org filter."""
    try:
        validate_sql("SELECT * FROM placements WHERE org_id = 4 OR 1=1", org_id=ORG_ID)
        raise AssertionError("Should have raised SQLSecurityError")
    except SQLSecurityError as e:
        print(f"  [PASS] OR 1=1 injection blocked: {e}")


def test_empty_sql_blocked():
    try:
        validate_sql("", org_id=ORG_ID)
        raise AssertionError("Should have raised SQLSecurityError")
    except SQLSecurityError as e:
        print(f"  [PASS] empty SQL blocked: {e}")


if __name__ == "__main__":
    print("Running SQL security parser tests...")
    failed = 0
    for t in [
        test_valid_select_with_org_id,
        test_valid_with_additional_conditions,
        test_valid_with_org_id_in_and_clause,
        test_valid_case_insensitive_where,
        test_missing_org_id_filter,
        test_wrong_org_id,
        test_drop_table_blocked,
        test_delete_blocked,
        test_insert_blocked,
        test_update_blocked,
        test_disallowed_table_blocked,
        test_sql_injection_attempt,
        test_empty_sql_blocked,
    ]:
        try:
            t()
        except AssertionError as e:
            print(f"  [FAIL] {t.__name__}: {e}")
            failed += 1
        except Exception as e:
            print(f"  [ERROR] {t.__name__}: {e}")
            failed += 1

    if failed:
        print(f"\n{failed} test(s) FAILED.")
        sys.exit(1)
    else:
        print(f"\nAll tests PASSED.")
