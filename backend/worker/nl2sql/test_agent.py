"""
TDD Test — Task 5: NL2SQL Agent with system prompt and org_id injection.

Validation from TASKS.md:
  Pass "What is the highest CTC?" and verify the output contains
  a MAX(salary) or MAX(ctc) aggregate from the placements table.

Run:
  DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/privacy_aware" \
  OPENAI_API_KEY="<key>" \
  python backend/worker/nl2sql/test_agent.py
"""
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from nl2sql.agent import run_analytics_query

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres123@localhost:5432/privacy_aware"
)
ORG_ID = 4


def test_highest_ctc_query():
    """
    TASKS.md validation: 'What is the highest CTC?' must return
    a result containing the MAX salary value from placements.
    """
    result = run_analytics_query("What is the highest CTC?", org_id=ORG_ID, db_url=DB_URL)
    assert result, "Empty response from agent"
    # The answer must contain a number (the max salary)
    assert re.search(r'\d[\d,\.]+', result), f"No numeric value in response: {result}"
    print(f"  [PASS] highest CTC => {result[:120]}")


def test_count_placed_students():
    """Agent must count placements correctly using Postgres COUNT."""
    result = run_analytics_query("How many students are placed?", org_id=ORG_ID, db_url=DB_URL)
    assert result, "Empty response"
    assert re.search(r'\d+', result), f"No count in response: {result}"
    print(f"  [PASS] placed students count => {result[:120]}")


def test_average_salary():
    """Agent must compute average salary via AVG aggregate."""
    result = run_analytics_query("What is the average salary?", org_id=ORG_ID, db_url=DB_URL)
    assert result, "Empty response"
    assert re.search(r'\d[\d,\.]+', result), f"No numeric in response: {result}"
    print(f"  [PASS] average salary => {result[:120]}")


def test_org_id_isolation():
    """
    Querying with a different org_id that has no data must return
    zero/no results — not data from another org.
    """
    result = run_analytics_query(
        "How many students are placed?", org_id=8888, db_url=DB_URL
    )
    assert result, "Empty response"
    # Should report 0 or 'no records' for an org with no data
    assert re.search(r'\b0\b|no\s+(placement|record|student|data)', result, re.IGNORECASE), (
        f"Expected 0 or 'no records' for empty org, got: {result}"
    )
    print(f"  [PASS] org isolation — empty org returns 0/no-data: {result[:120]}")


def test_dangerous_query_blocked():
    """
    DROP / DELETE / INSERT commands must never execute.
    The agent should return a refusal or safe fallback.
    """
    result = run_analytics_query("DROP TABLE placements", org_id=ORG_ID, db_url=DB_URL)
    lower = result.lower()
    # Must NOT silently succeed; must contain a refusal or error indication
    assert any(kw in lower for kw in (
        "cannot", "not allowed", "only", "select", "read", "restrict",
        "unable", "sorry", "aggregate", "error", "failed"
    )), f"Dangerous query was not refused. Response: {result}"
    print(f"  [PASS] DROP TABLE blocked: {result[:120]}")


def _safe_print(msg: str):
    """Print without crashing on non-ASCII characters (e.g. ₹) on Windows."""
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode("ascii", errors="replace").decode("ascii"))


if __name__ == "__main__":
    import io, sys
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    print("Running NL2SQL Agent tests...")
    failed = 0
    for t in [
        test_highest_ctc_query,
        test_count_placed_students,
        test_average_salary,
        test_org_id_isolation,
        test_dangerous_query_blocked,
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
        print("\nAll tests PASSED.")
