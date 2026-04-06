"""
F2 TDD — Faculty Cross-Student Bypass Fix
RED tests: verify current bug, then verify fix after GREEN implementation.

Bug: detect_cross_student_query() exits early for faculty, so faculty can
     query another student's SRN without being blocked.

Fix: Change line 1463 from
     `user_role not in ('student', 'faculty')`  →  `user_role in ('admin', 'super_admin')`
"""
import sys
import os

# Add worker dir to path so we can import directly
sys.path.insert(0, os.path.dirname(__file__))

from app import detect_cross_student_query


# ── RED tests (these must FAIL before the fix) ───────────────────────────────

def test_faculty_blocked_when_querying_other_student_srn():
    """Faculty querying another student's SRN must be BLOCKED."""
    result = detect_cross_student_query(
        query="PES1PG24CA165 give details",
        entity_id="FAC_MCA001",
        user_role="faculty",
        username="Ravi Kumar"
    )
    assert result is not None, (
        "FAIL: faculty was NOT blocked from querying student SRN PES1PG24CA165 — "
        "detect_cross_student_query() returned None (pass-through) for faculty role."
    )


def test_faculty_blocked_when_querying_different_student_srn():
    """Faculty with entity_id FAC_MCA002 must not access PES1PG24CA100."""
    result = detect_cross_student_query(
        query="can you show PES1PG24CA100 semester marks",
        entity_id="FAC_MCA002",
        user_role="faculty",
        username="Meera Sharma"
    )
    assert result is not None, (
        "FAIL: faculty was NOT blocked from querying PES1PG24CA100 — "
        "detect_cross_student_query() returned None for faculty role."
    )


# ── GREEN tests (these must PASS both before and after the fix) ──────────────

def test_student_blocked_when_querying_other_student_srn():
    """Student querying another SRN must be blocked — baseline check."""
    result = detect_cross_student_query(
        query="PES1PG24CA165 give details",
        entity_id="PES1PG24CA169",
        user_role="student",
        username="Siba Sundar"
    )
    assert result is not None, "Student was NOT blocked — baseline test should always pass."


def test_admin_not_blocked():
    """Admin querying any SRN must NOT be blocked."""
    result = detect_cross_student_query(
        query="PES1PG24CA165 give details",
        entity_id="USR_ADMIN001",
        user_role="admin",
        username="Admin User"
    )
    assert result is None, "Admin was wrongly blocked — admins must have full access."


def test_super_admin_not_blocked():
    """Super admin must not be blocked."""
    result = detect_cross_student_query(
        query="PES1PG24CA165 give details",
        entity_id="USR_SADMIN01",
        user_role="super_admin",
        username="Super Admin"
    )
    assert result is None, "Super admin was wrongly blocked."


def test_faculty_own_entity_not_blocked():
    """Faculty querying a query with no foreign SRN must pass through."""
    result = detect_cross_student_query(
        query="how many students are enrolled",
        entity_id="FAC_MCA001",
        user_role="faculty",
        username="Ravi Kumar"
    )
    assert result is None, "Faculty asking aggregate question was wrongly blocked."


def test_student_own_srn_not_blocked():
    """Student including their OWN SRN in query must not be blocked."""
    result = detect_cross_student_query(
        query="PES1PG24CA169 my details",
        entity_id="PES1PG24CA169",
        user_role="student",
        username="Siba Sundar"
    )
    assert result is None, "Student querying their OWN SRN was wrongly blocked."


if __name__ == "__main__":
    import traceback

    tests = [
        test_faculty_blocked_when_querying_other_student_srn,
        test_faculty_blocked_when_querying_different_student_srn,
        test_student_blocked_when_querying_other_student_srn,
        test_admin_not_blocked,
        test_super_admin_not_blocked,
        test_faculty_own_entity_not_blocked,
        test_student_own_srn_not_blocked,
    ]

    passed = failed = 0
    for t in tests:
        try:
            t()
            print(f"  PASS  {t.__name__}")
            passed += 1
        except AssertionError as e:
            print(f"  FAIL  {t.__name__}: {e}")
            failed += 1
        except Exception as e:
            print(f"  ERROR {t.__name__}: {e}")
            traceback.print_exc()
            failed += 1

    print(f"\n{passed}/{passed+failed} tests passed")
    sys.exit(0 if failed == 0 else 1)
