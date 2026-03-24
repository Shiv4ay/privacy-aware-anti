"""
test_intent_aware.py — Phase 10 Intent-Aware AI Response Tests (TDD RED → GREEN)

Tests that the LLM answers ONLY what was asked, not a full profile dump.

Run:
    docker exec privacy-aware-worker python test_intent_aware.py

Or locally:
    python test_intent_aware.py
"""
import requests
import re
import sys
from typing import Optional

BASE_URL = "http://127.0.0.1:8001"

# Student used for all scoped tests (must be indexed)
ENTITY_ID = "PES1PG24CA169"

# Base payload shared by all tests
def make_payload(query: str, extra: Optional[dict] = None) -> dict:
    p = {
        "query": query,
        "org_id": 4,
        "organization": "pes_mca_dataset",
        "user_role": "student",
        "user_id": ENTITY_ID,
        "entity_id": ENTITY_ID,
        "conversation_history": []
    }
    if extra:
        p.update(extra)
    return p


# ── Helpers ──────────────────────────────────────────────────────────────────

def contains_any(text: str, keywords: list[str]) -> bool:
    t = text.lower()
    return any(k.lower() in t for k in keywords)

def contains_table_header(text: str, headers: list[str]) -> bool:
    """True if ANY of the given <th> headers appear in the HTML response."""
    for h in headers:
        if re.search(rf'<th[^>]*>.*?{re.escape(h)}.*?</th>', text, re.IGNORECASE | re.DOTALL):
            return True
    return False

def chat(query: str, extra: Optional[dict] = None) -> str:
    resp = requests.post(f"{BASE_URL}/chat", json=make_payload(query, extra), timeout=120)
    if resp.status_code != 200:
        return f"HTTP_ERROR_{resp.status_code}"
    data = resp.json()
    return data.get("response", "")


# ── PLACEMENT_INDICATORS / PROFILE_INDICATORS ─────────────────────────────
PLACEMENT_HEADERS = ["position", "company", "salary", "ctc", "package", "placed", "placement", "organization", "offer"]
INTERNSHIP_HEADERS = ["internship", "stipend", "intern", "company", "duration"]
PROFILE_ONLY_HEADERS = ["gender", "date of birth", "dob", "home state", "category", "quota", "blood group", "pincode", "enrollment date"]
ACADEMIC_HEADERS = ["semester", "subject", "grade", "credits", "score", "result", "marks", "sgpa", "cgpa"]
SEMESTER_3_MARKERS = ["semester 3", "sem 3", "3rd semester", "s3", "semester-3"]


pass_count = 0
fail_count = 0

def check(test_id: str, description: str, result: bool, detail: str = ""):
    global pass_count, fail_count
    if result:
        pass_count += 1
        print(f"  ✅ {test_id}: {description}")
    else:
        fail_count += 1
        print(f"  ❌ {test_id}: {description}")
        if detail:
            print(f"     Detail: {detail[:300]}")


# ═══════════════════════════════════════════════════════════════════════════
# SECTION A: SCOPED QUERIES — must NOT show unrelated sections
# ═══════════════════════════════════════════════════════════════════════════

print("\n" + "═" * 60)
print("SECTION A: Scoped Queries (should show ONLY the asked topic)")
print("═" * 60)

# T10.1 — "sem 3 marks" → only semester 3 results, NO placement table
print("\n[T10.1] Query: 'sem 3 marks'")
r = chat("sem 3 marks")
has_academic = contains_any(r, ["semester 3", "sem 3", "grade", "marks", "result", "sgpa"])
has_placement_table = contains_table_header(r, ["position", "company", "package", "ctc"])
has_profile_fields = contains_any(r, ["date of birth", "gender", "home state", "blood group", "pincode"])
check("T10.1a", "Response contains semester 3 academic data", has_academic, r[:200])
check("T10.1b", "Response does NOT contain placement table", not has_placement_table, r[:200])
check("T10.1c", "Response does NOT dump full profile fields", not has_profile_fields, r[:200])

# T10.2 — "third semester performance" → same as T10.1
print("\n[T10.2] Query: 'third semester performance'")
r = chat("third semester performance")
has_academic = contains_any(r, ["semester 3", "sem 3", "third", "grade", "marks", "result", "sgpa"])
has_placement_table = contains_table_header(r, ["position", "company", "package", "ctc"])
check("T10.2a", "Response contains semester/academic data", has_academic, r[:200])
check("T10.2b", "Response does NOT contain placement table", not has_placement_table, r[:200])

# T10.3 — "how did I do in 3rd sem" → only sem 3
print("\n[T10.3] Query: 'how did I do in 3rd sem'")
r = chat("how did I do in 3rd sem")
has_academic = contains_any(r, ["semester 3", "3rd", "grade", "marks", "result", "sgpa", "gpa"])
has_placement_table = contains_table_header(r, ["position", "company", "package"])
check("T10.3a", "Response focuses on academic/result data", has_academic, r[:200])
check("T10.3b", "Response does NOT spill into placement section", not has_placement_table, r[:200])

# T10.4 — "S3 results" → only sem 3 academic
print("\n[T10.4] Query: 'S3 results'")
r = chat("S3 results")
has_academic = contains_any(r, ["semester 3", "sem 3", "s3", "grade", "marks", "result"])
has_placement_table = contains_table_header(r, ["position", "company", "package", "ctc"])
check("T10.4a", "Response contains academic results", has_academic, r[:200])
check("T10.4b", "Response does NOT contain placement table", not has_placement_table, r[:200])

# T10.5 — "where am I placed" → only placement, NO personal fields
print("\n[T10.5] Query: 'where am I placed'")
r = chat("where am I placed")
has_placement = contains_any(r, ["placed", "company", "position", "offer", "package", "swiggy", "wipro", "infosys", "SDE"])
has_profile_field = contains_any(r, ["date of birth", "gender", "home state", "blood group", "pincode", "enrollment"])
has_semester_table = contains_table_header(r, ["semester", "subject", "marks", "grade", "credits"])
check("T10.5a", "Response contains placement info", has_placement, r[:200])
check("T10.5b", "Response does NOT dump personal profile fields", not has_profile_field, r[:200])
check("T10.5c", "Response does NOT show semester marks table", not has_semester_table, r[:200])

# T10.6 — "my package" → only placement/salary
print("\n[T10.6] Query: 'my package'")
r = chat("my package")
has_placement = contains_any(r, ["salary", "ctc", "package", "lpa", "placed", "company", "offer", "redacted"])
has_profile_field = contains_any(r, ["date of birth", "gender", "home state", "blood group"])
check("T10.6a", "Response contains salary/placement info", has_placement, r[:200])
check("T10.6b", "Response does NOT dump full profile", not has_profile_field, r[:200])

# T10.7 — "my gpa" or "my cgpa" → only GPA row
print("\n[T10.7] Query: 'my cgpa'")
r = chat("my cgpa")
has_gpa = contains_any(r, ["cgpa", "gpa", "grade point", "cumulative", "grade", "score"])
has_placement_table = contains_table_header(r, ["position", "company", "package"])
has_profile_field = contains_any(r, ["date of birth", "gender", "home state", "blood group"])
check("T10.7a", "Response contains GPA/CGPA info", has_gpa, r[:200])
check("T10.7b", "Response does NOT show placement table", not has_placement_table, r[:200])
check("T10.7c", "Response does NOT dump full profile", not has_profile_field, r[:200])

# T10.8 — "my internship" → only internship info
print("\n[T10.8] Query: 'my internship'")
r = chat("my internship")
# Internship may or may not exist; if no records, expect a "not found" message (still scoped)
has_internship_or_none = contains_any(r, ["internship", "intern", "stipend", "no internship", "not found", "no record", "not available"])
has_profile_field = contains_any(r, ["date of birth", "gender", "home state", "blood group", "enrollment date"])
has_semester_table = contains_table_header(r, ["semester", "subject", "marks", "grade"])
check("T10.8a", "Response addresses internship topic (or states none found)", has_internship_or_none, r[:200])
check("T10.8b", "Response does NOT dump profile fields", not has_profile_field, r[:200])
check("T10.8c", "Response does NOT show semester marks table", not has_semester_table, r[:200])

# T10.9 — Out-of-box: "what company did I get" → only placement
print("\n[T10.9] Query: 'what company did I get' (out-of-box phrasing)")
r = chat("what company did I get")
has_placement = contains_any(r, ["company", "placed", "offer", "position", "hired", "selected", "no placement", "not placed"])
has_profile_field = contains_any(r, ["date of birth", "gender", "home state", "blood group"])
check("T10.9a", "Response addresses placement/company (or states none)", has_placement, r[:200])
check("T10.9b", "Response does NOT dump profile fields", not has_profile_field, r[:200])

# T10.10 — Out-of-box: "my dob" → only DOB field, not full profile
print("\n[T10.10] Query: 'my dob' (out-of-box abbreviation)")
r = chat("my dob")
has_dob = contains_any(r, ["date of birth", "dob", "born", "birth"])
is_full_profile = contains_any(r, ["gender", "home state", "blood group", "pincode", "enrollment date", "category"]) and \
                  contains_any(r, ["semester", "grade", "marks", "placement", "company"])
check("T10.10a", "Response contains DOB info", has_dob, r[:200])
check("T10.10b", "Response is NOT a full profile dump (multiple unrelated sections)", not is_full_profile, r[:200])


# ═══════════════════════════════════════════════════════════════════════════
# SECTION B: FULL (BROAD) QUERIES — must show complete profile
# ═══════════════════════════════════════════════════════════════════════════

print("\n" + "═" * 60)
print("SECTION B: Broad Overview Queries (should show FULL profile)")
print("═" * 60)

# T10.11 — "my details" → full profile
print("\n[T10.11] Query: 'my details'")
r = chat("my details")
has_personal = contains_any(r, ["name", "gender", "date of birth", "dob", "email", "phone"])
has_academic = contains_any(r, ["semester", "grade", "cgpa", "marks", "result"])
# Must have BOTH personal AND academic indicators for a full profile
check("T10.11a", "Full profile: contains personal info fields", has_personal, r[:200])
check("T10.11b", "Full profile: contains academic data", has_academic, r[:200])

# T10.12 — "tell me about myself" → full profile
print("\n[T10.12] Query: 'tell me about myself'")
r = chat("tell me about myself")
has_personal = contains_any(r, ["name", "gender", "date of birth", "dob", "email", "phone"])
has_academic_or_professional = contains_any(r, ["semester", "grade", "cgpa", "placed", "company", "internship"])
check("T10.12a", "Full profile: contains personal info", has_personal, r[:200])
check("T10.12b", "Full profile: contains academic or professional data", has_academic_or_professional, r[:200])


# ═══════════════════════════════════════════════════════════════════════════
# SECTION C: NLU ALIAS — build_search_query normalization
# ═══════════════════════════════════════════════════════════════════════════

print("\n" + "═" * 60)
print("SECTION C: NLU Alias Normalization (build_search_query)")
print("═" * 60)

try:
    from app import build_search_query

    # T10.C1 — "3rd sem marks" → should contain "semester 3"
    q = build_search_query("3rd sem marks", [])
    check("T10.C1", "'3rd sem marks' normalises to contain 'semester 3'", "semester 3" in q.lower(), f"Got: {q}")

    # T10.C2 — "third semester performance" → should contain "semester 3"
    q = build_search_query("third semester performance", [])
    check("T10.C2", "'third semester performance' normalises to contain 'semester 3'", "semester 3" in q.lower(), f"Got: {q}")

    # T10.C3 — "my package" → should contain "placement" or "salary"
    q = build_search_query("my package", [])
    check("T10.C3", "'my package' normalises to contain 'placement' or 'salary'",
          "placement" in q.lower() or "salary" in q.lower(), f"Got: {q}")

    # T10.C4 — "where am I working" → should contain "placement" or "company"
    q = build_search_query("where am I working", [])
    check("T10.C4", "'where am I working' normalises to contain 'placement' or 'company'",
          "placement" in q.lower() or "company" in q.lower(), f"Got: {q}")

    # T10.C5 — "my birthday" → should contain "birth" or "dob"
    q = build_search_query("my birthday", [])
    check("T10.C5", "'my birthday' normalises to contain 'birth' or 'dob'",
          "birth" in q.lower() or "dob" in q.lower(), f"Got: {q}")

    # T10.C6 — "how did I do in sem 4" → should contain "semester 4"
    q = build_search_query("how did I do in sem 4", [])
    check("T10.C6", "'how did I do in sem 4' normalises to contain 'semester 4'",
          "semester 4" in q.lower(), f"Got: {q}")

except ImportError as e:
    print(f"  ⚠️  Skipping Section C (cannot import app directly): {e}")
    print("     Run inside the docker container for Section C tests.")


# ═══════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════

print("\n" + "═" * 60)
total = pass_count + fail_count
print(f"RESULTS: {pass_count}/{total} PASSED | {fail_count} FAILED")
print("═" * 60)

if fail_count > 0:
    print("\n⚠️  Some tests failed — implement Phase 10 fixes (Tasks 10.1 & 10.2) and re-run.")
    sys.exit(1)
else:
    print("\n🎉 All tests passed! Intent-aware AI is working correctly.")
    sys.exit(0)
