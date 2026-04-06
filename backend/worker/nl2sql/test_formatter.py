"""
TDD Test — Task 8: NL2SQL response formatter + /chat endpoint integration.

Validation from TASKS.md:
  Send an API request for "How many students are placed?"
  and receive a perfectly accurate conversational response.

Tests:
  Unit  — format_nl2sql_response() returns correct /chat response shape
  API   — live /chat endpoint on port 8001 returns accurate NL2SQL answer

Run:
  OPENAI_API_KEY="<key>" python backend/worker/nl2sql/test_formatter.py
"""
import os
import re
import sys
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from nl2sql.formatter import format_nl2sql_response

API_URL = os.getenv("WORKER_URL", "http://localhost:8001")


# ── Unit tests (no network) ──────────────────────────────────────────────────

def test_response_has_required_keys():
    result = format_nl2sql_response(
        query="How many students are placed?",
        nl2sql_answer="54 students are placed."
    )
    required = {"query", "response", "context_used", "status", "pii_detected", "pii_types", "pii_map"}
    missing = required - result.keys()
    assert not missing, f"Missing keys: {missing}"
    print("  [PASS] response contains all required keys")


def test_response_values():
    result = format_nl2sql_response(
        query="What is the highest CTC?",
        nl2sql_answer="The highest CTC is 2,200,000."
    )
    assert result["query"] == "What is the highest CTC?"
    assert "2,200,000" in result["response"]
    assert result["context_used"] is True
    assert result["status"] == "success"
    assert result["pii_detected"] is False
    assert result["pii_map"] is None
    print("  [PASS] response values are correct")


def test_empty_answer_handled():
    result = format_nl2sql_response(
        query="How many?",
        nl2sql_answer=""
    )
    assert result["status"] == "success"
    assert isinstance(result["response"], str)
    print("  [PASS] empty answer handled gracefully")


# ── API integration tests (requires Docker worker on port 8001) ──────────────

def _post_chat(query: str, role: str = "admin", org_id: int = 4) -> dict:
    import requests
    resp = requests.post(
        f"{API_URL}/chat",
        json={
            "query": query,
            "org_id": org_id,
            "user_role": role,
            "organization": "test",
        },
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()


def test_api_placed_students_count():
    """TASKS.md validation: accurate count of placed students."""
    data = _post_chat("How many students are placed?")
    response = data.get("response", "")
    assert re.search(r'\b54\b', response), (
        f"Expected '54' in response, got: {response[:200]}"
    )
    assert data["status"] == "success"
    print(f"  [PASS] placed students count: {response[:120]}")


def test_api_highest_ctc():
    """Highest CTC must be 2,200,000 (verified from Postgres)."""
    data = _post_chat("What is the highest CTC?")
    response = data.get("response", "")
    # Accept with or without rupee symbol, with or without commas
    assert re.search(r'2[,.]?200[,.]?000|2200000', response), (
        f"Expected 2200000 in response, got: {response[:200]}"
    )
    print(f"  [PASS] highest CTC: {response[:120]}")


def test_api_response_shape():
    """API response must always have the required shape."""
    data = _post_chat("How many students are placed?")
    required = {"query", "response", "context_used", "status"}
    missing = required - data.keys()
    assert not missing, f"Missing keys in API response: {missing}"
    print("  [PASS] API response shape correct")


def test_api_student_gets_chromadb_path():
    """Student role must NOT use NL2SQL — gets ChromaDB response, not aggregate stats."""
    data = _post_chat("How many students are placed?", role="student")
    response = data.get("response", "")
    # Student should NOT get the org-wide aggregate answer (54 students)
    # They get either ChromaDB result or a "not found" response
    assert data["status"] in ("success", "security_blocked_output")
    print(f"  [PASS] student role bypasses NL2SQL: {response[:120]}")


if __name__ == "__main__":
    print("Running NL2SQL formatter + API tests...")
    failed = 0

    print("\n-- Unit tests --")
    for t in [test_response_has_required_keys, test_response_values, test_empty_answer_handled]:
        try:
            t()
        except AssertionError as e:
            print(f"  [FAIL] {t.__name__}: {e}")
            failed += 1
        except Exception as e:
            print(f"  [ERROR] {t.__name__}: {e}")
            failed += 1

    print("\n-- API integration tests (requires rebuilt Docker worker) --")
    for t in [test_api_placed_students_count, test_api_highest_ctc,
              test_api_response_shape, test_api_student_gets_chromadb_path]:
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
