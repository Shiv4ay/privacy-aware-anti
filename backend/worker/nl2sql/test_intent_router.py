"""
TDD Test — Task 7: Intent Router.

Validation from TASKS.md:
  Standard queries hit ChromaDB (router returns None),
  while math/aggregate queries trigger the NL2SQL Agent (router returns a string).

Run:
  DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/privacy_aware" \
  OPENAI_API_KEY="<key>" \
  python backend/worker/nl2sql/test_intent_router.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from nl2sql.intent_router import is_aggregate_query, route_query

DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres123@localhost:5432/privacy_aware")
ORG_ID = 4


# ── is_aggregate_query() ─────────────────────────────────────────────────────

def test_aggregate_keywords_detected():
    cases = [
        "What is the highest CTC?",
        "How many students are placed?",
        "Average salary in our organization",
        "Which company hired the most students?",
        "Give me placement statistics",
        "Total internship count",
        "What is the max stipend?",
        "Placement rate for this year",
        "how many students got internship",
        "lowest salary offered",
        "count of placed students",
    ]
    for q in cases:
        assert is_aggregate_query(q), f"Should be aggregate: {q!r}"
    print(f"  [PASS] {len(cases)} aggregate patterns correctly detected")


def test_personal_queries_not_aggregate():
    """These are individual entity lookups — must go to ChromaDB."""
    cases = [
        "give me my details",
        "what is my GPA",
        "my semester 3 marks",
        "show my internship",
        "tell me about Rajesh",
        "what courses am I enrolled in",
        "my placement details",
        "PES1PG24CA169 profile",
    ]
    for q in cases:
        assert not is_aggregate_query(q), f"Should NOT be aggregate: {q!r}"
    print(f"  [PASS] {len(cases)} personal queries correctly excluded from aggregate")


def test_out_of_box_aggregate_phrasing():
    """Unconventional phrasing the router must still catch."""
    cases = [
        "top earner in our batch",
        "who got the biggest package",
        "breakdown of placements by company",
        "how's the placement scene this year",
        "salary distribution",
        "how many kids got jobs",
    ]
    for q in cases:
        assert is_aggregate_query(q), f"Should be aggregate: {q!r}"
    print(f"  [PASS] out-of-box phrasing detected correctly")


# ── route_query() ─────────────────────────────────────────────────────────────

def test_route_aggregate_admin_returns_answer():
    """Admin asking aggregate question → returns non-empty string from NL2SQL."""
    result = route_query(
        "How many students are placed?",
        org_id=ORG_ID, user_role="admin", db_url=DB_URL
    )
    assert result is not None, "Expected NL2SQL answer, got None (routed to ChromaDB)"
    assert len(result) > 5, f"Answer too short: {result!r}"
    print(f"  [PASS] admin aggregate routed to NL2SQL: {result[:100]}")


def test_route_personal_query_returns_none():
    """Personal query → returns None so caller falls through to ChromaDB."""
    result = route_query(
        "give me my details",
        org_id=ORG_ID, user_role="student", db_url=DB_URL
    )
    assert result is None, f"Personal query should return None, got: {result!r}"
    print("  [PASS] personal query correctly returns None → ChromaDB path")


def test_route_student_aggregate_returns_none():
    """Students cannot use the aggregate path — must return None."""
    result = route_query(
        "How many students are placed?",
        org_id=ORG_ID, user_role="student", db_url=DB_URL
    )
    assert result is None, "Student role must not access NL2SQL aggregate path"
    print("  [PASS] student role excluded from NL2SQL path")


def test_route_super_admin_aggregate():
    """super_admin also gets NL2SQL routing."""
    result = route_query(
        "What is the average salary?",
        org_id=ORG_ID, user_role="super_admin", db_url=DB_URL
    )
    assert result is not None, "super_admin aggregate should route to NL2SQL"
    print(f"  [PASS] super_admin aggregate routed: {result[:100]}")


if __name__ == "__main__":
    print("Running Intent Router tests...")
    failed = 0

    unit_tests = [
        test_aggregate_keywords_detected,
        test_personal_queries_not_aggregate,
        test_out_of_box_aggregate_phrasing,
    ]
    integration_tests = [
        test_route_aggregate_admin_returns_answer,
        test_route_personal_query_returns_none,
        test_route_student_aggregate_returns_none,
        test_route_super_admin_aggregate,
    ]

    print("\n-- Unit tests (no LLM) --")
    for t in unit_tests:
        try:
            t()
        except AssertionError as e:
            print(f"  [FAIL] {t.__name__}: {e}")
            failed += 1
        except Exception as e:
            print(f"  [ERROR] {t.__name__}: {e}")
            failed += 1

    print("\n-- Integration tests (requires OpenAI + Postgres) --")
    for t in integration_tests:
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
