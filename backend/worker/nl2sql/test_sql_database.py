"""
TDD Test — Task 4: LangChain SQLDatabase connection (read-only).

Validation criteria from TASKS.md:
  Run a test script where the LangChain object successfully lists
  the schema of the `placements` table.

Run:
  DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/privacy_aware" \
  python backend/worker/nl2sql/test_sql_database.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from nl2sql.sql_database import get_analytics_db

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres123@localhost:5432/privacy_aware"
)


def test_returns_sqldatabase_object():
    """get_analytics_db() must return a LangChain SQLDatabase instance."""
    from langchain_community.utilities import SQLDatabase
    db = get_analytics_db(DB_URL)
    assert isinstance(db, SQLDatabase), f"Expected SQLDatabase, got {type(db)}"
    print("  [PASS] returns SQLDatabase instance")


def test_placements_table_in_schema():
    """Schema info must include the placements table."""
    db = get_analytics_db(DB_URL)
    schema = db.get_table_info()
    assert "placements" in schema, "placements table not in schema"
    assert "salary" in schema, "'salary' column not found in schema"
    print("  [PASS] placements table with salary column in schema")


def test_internships_table_in_schema():
    """Schema info must include the internships table."""
    db = get_analytics_db(DB_URL)
    schema = db.get_table_info()
    assert "internships" in schema, "internships table not in schema"
    assert "stipend" in schema, "'stipend' column not found in schema"
    print("  [PASS] internships table with stipend column in schema")


def test_only_analytics_tables_exposed():
    """
    Only placements and internships must be visible to the agent.
    Tables like users, audit_logs, documents must NOT appear.
    """
    db = get_analytics_db(DB_URL)
    usable = db.get_usable_table_names()
    assert set(usable) == {"placements", "internships"}, (
        f"Expected only [placements, internships], got {usable}"
    )
    print(f"  [PASS] only analytics tables exposed: {sorted(usable)}")


def test_read_only_blocks_write():
    """
    Executing a write statement must raise an exception.
    The connection is in read-only mode.
    """
    db = get_analytics_db(DB_URL)
    try:
        db.run("INSERT INTO placements (placement_id, org_id) VALUES ('TEST', 0)")
        raise AssertionError("Write succeeded — connection is NOT read-only!")
    except Exception as e:
        err = str(e).lower()
        assert any(kw in err for kw in ("read-only", "readonly", "read only", "cannot", "denied", "not allowed", "permission")), (
            f"Write blocked but not by read-only guard. Error was: {e}"
        )
        print(f"  [PASS] write blocked by read-only connection")


def test_select_aggregate_runs():
    """A simple COUNT aggregate must execute successfully."""
    db = get_analytics_db(DB_URL)
    result = db.run("SELECT COUNT(*) FROM placements")
    assert result is not None and result != "", "Empty result from aggregate query"
    print(f"  [PASS] SELECT COUNT(*) FROM placements => {result}")


if __name__ == "__main__":
    print("Running SQL Database connection tests...")
    failed = 0
    for t in [
        test_returns_sqldatabase_object,
        test_placements_table_in_schema,
        test_internships_table_in_schema,
        test_only_analytics_tables_exposed,
        test_read_only_blocks_write,
        test_select_aggregate_runs,
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
        print(f"\n{failed} test(s) FAILED — implement nl2sql/sql_database.py first.")
        sys.exit(1)
    else:
        print("\nAll tests PASSED.")
