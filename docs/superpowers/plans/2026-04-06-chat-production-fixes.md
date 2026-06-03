# Chat Production-Grade Fixes — Phase 10

**Branch:** `feature/chat-prod-fixes`
**Date:** 2026-04-06
**Goal:** Fix 4 confirmed bugs and 3 production-hardening gaps that affect correctness/privacy for all roles.

---

## Confirmed Bugs (must fix)

### F2 — Faculty Cross-Student Bypass (line 1463)

**File:** `backend/worker/app.py:1463`
**Bug:** `detect_cross_student_query()` early-exits when `user_role not in ('student', 'faculty')`.
That double-negative means faculty BYPASSES the detector — they can query other students' SRNs.
**Fix:** Flip the condition: exit only for admin/super_admin.

```python
# BEFORE (line 1463):
if not entity_id or user_role not in ('student', 'faculty'):

# AFTER:
if not entity_id or user_role in ('admin', 'super_admin'):
```

**Test file:** `backend/worker/test_cross_student_faculty.py`

---

### F4 — Faculty Aggregate No Department Scope (line 3831)

**File:** `backend/worker/app.py:3831`
**Bug:** `_try_faculty_aggregate_query()` counts ALL students in org. Faculty should only see
their own department's student count (anonymized), not org-wide.
**Fix:** Look up faculty department from `users` table, then filter the count query.

```python
# Lookup faculty dept first (entity_id is FAC_ prefixed SRN or UUID)
dept_row = cur.execute("SELECT department FROM users WHERE user_id=%s", (entity_id,))
faculty_dept = (dept_row.fetchone() or (None,))[0]

# Then filter student count:
if faculty_dept:
    cur.execute(
        "SELECT COUNT(*) FROM users WHERE role='student' AND department=%s" +
        (" AND org_id=%s" if org_id else ""),
        (faculty_dept, org_id) if org_id else (faculty_dept,)
    )
    label = f"ENROLLED STUDENTS IN YOUR DEPARTMENT ({faculty_dept}): {cnt}"
else:
    # Fall back to org-wide (no dept info available)
    cur.execute("SELECT COUNT(*) FROM users WHERE role='student'" + ...)
    label = f"ENROLLED STUDENTS IN ORGANIZATION: {cnt}"
```

**Test file:** `backend/worker/test_faculty_aggregate.py`

---

### F6 — Company Name Guard: Exact Match Only (line 699)

**File:** `backend/worker/app.py:699`
**Bug:** The PROTECTED VALUES GUARD uses `val in _protected` (checks if val is a substring of
a protected term). This is correct for sub-word matching. BUT — `_protected_terms` may contain
`"Wipro - HR (Bangalore)"` while Presidio detects `"Wipro"` as PERSON — `"Wipro" in "Wipro - HR (Bangalore)"` is True, so it SHOULD work.
**Actual bug:** `_protected_terms` is built from `id_to_name` which stores the full resolved
company name, but company names with special characters may fail the `in` check. Also the guard
explicitly excludes `PERSON` type (line 698) — meaning company names classified as PERSON
by Presidio are NOT protected. Indian company names (Swiggy, Wipro, Infosys) are classified
as PERSON by spaCy. So they slip through.

**Fix:** In the PROTECTED VALUES GUARD, when entity_type is PERSON AND val is an exact match
(case-insensitive) of any entry in `_protected`, skip it (it's a company name, not a person name).

```python
# line 698 condition — add PERSON exception for exact-match company names:
if _protected and res.entity_type not in ("EMAIL_ADDRESS", "PHONE_NUMBER", "STUDENT_ID", "SYSTEM_ID"):
    # For PERSON type: only protect if it's an EXACT match of a protected term (company name)
    # Do NOT protect PERSON sub-words (e.g. "Siba" from "Siba Sundar" must still be redacted)
    if res.entity_type == "PERSON":
        if val in _protected:  # exact full-string match only
            continue
    else:
        if val in _protected or any(val in pterm for pterm in _protected):
            continue
```

**Test file:** `backend/worker/test_company_name_guard.py`

---

### F1 — OpenAI DPA Enforcement

**File:** `backend/worker/app.py` — `call_openai_chat()` at line 1626 and streaming at line 5074
**Bug:** Admin queries containing real student PII (names, emails, SRNs) are sent to OpenAI
without any data-processing agreement (DPA) enforcement. OpenAI retains training data unless
DPA is in place.
**Fix:** Add env-var gate. If `OPENAI_DPA_SIGNED` != `"true"`, strip student names from context
before sending to OpenAI, and log a warning.

```python
DPA_SIGNED = os.getenv("OPENAI_DPA_SIGNED", "false").lower() == "true"

# In generate_chat_response() before building messages:
if not DPA_SIGNED and user_role == 'admin' and student_names:
    logger.warning("[DPA] OPENAI_DPA_SIGNED not set — stripping student names before cloud call")
    for name in student_names:
        context = context.replace(name, "[STUDENT]")
```

**Test file:** `backend/worker/test_dpa_enforcement.py`

---

## Tasks

| # | Task | File | Status |
|---|------|------|--------|
| 1 | F2 RED: write failing test for faculty cross-student bypass | `test_cross_student_faculty.py` | TODO |
| 2 | F2 GREEN: fix line 1463 | `app.py:1463` | TODO |
| 3 | F2 VERIFY: run test | — | TODO |
| 4 | F4 RED: write failing test for faculty aggregate dept scope | `test_faculty_aggregate.py` | TODO |
| 5 | F4 GREEN: fix `_try_faculty_aggregate_query()` | `app.py:3831` | TODO |
| 6 | F4 VERIFY: run test | — | TODO |
| 7 | F6 RED: write failing test for company-as-PERSON guard | `test_company_name_guard.py` | TODO |
| 8 | F6 GREEN: fix PROTECTED VALUES GUARD condition | `app.py:698` | TODO |
| 9 | F6 VERIFY: run test | — | TODO |
| 10 | F1 RED: write failing test for DPA enforcement | `test_dpa_enforcement.py` | TODO |
| 11 | F1 GREEN: add DPA gate to generate_chat_response + streaming | `app.py` | TODO |
| 12 | F1 VERIFY: run test | — | TODO |
| 13 | Final: restart worker, run demo_test.py | — | TODO |
