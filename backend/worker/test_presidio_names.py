"""
M1 — Presidio Indian Name False-Negative Fix
TDD RED phase: These tests FAIL before the fix (student_names kwarg not yet implemented).

spaCy en_core_web_sm misses ~10% of Indian given names when they appear without a field-label
prefix. The fix adds a student_names kwarg to redact_text() that performs whole-word matching
against known names extracted from the resolved context.

Run: docker exec privacy-aware-worker python test_presidio_names.py
"""
import sys
import os
import re

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

PASS_MARK = "\033[92m✓\033[0m"
FAIL_MARK = "\033[91m✗\033[0m"

results = []

def check(label, condition, detail=""):
    status = PASS_MARK if condition else FAIL_MARK
    results.append(condition)
    msg = f"  {status}  {label}"
    if detail:
        msg += f"  [{detail}]"
    print(msg)


def extract_token_type(text, name):
    """Return the token type (e.g. 'PERSON') if the name was replaced by a badge."""
    m = re.search(r'\[([A-Z_]+):idx_\d+\]', text)
    return m.group(1) if m else None


print("\n══════════════════════════════════════════════")
print("  M1 — Presidio Indian Name False-Negative Fix")
print("══════════════════════════════════════════════\n")

try:
    from app import redact_text
except Exception as e:
    print(f"  {FAIL_MARK}  IMPORT FAILED: {e}")
    sys.exit(1)

# ── Test 1: Standalone Indian given name — "Siba" ───────────────────────────
print("── Test 1: Standalone first name without label ──")
t1_map, t1_counters = {}, {}
t1_out = redact_text(
    "Siba is placed at a company.",
    return_map=False,
    pii_map=t1_map,
    counters=t1_counters,
    student_names={"Siba", "Sundar"}
)
print(f"  Input : Siba is placed at a company.")
print(f"  Output: {t1_out}")
t1_has_person = "[PERSON:" in t1_out
check("'Siba' in sentence → redacted as [PERSON:idx_N]", t1_has_person, f"out='{t1_out}'")
check("pii_map contains 'Siba' value", any(v.lower() == "siba" for v in t1_map.values()), f"map={t1_map}")


# ── Test 2: Standalone South Indian name — "Sundar" ─────────────────────────
print("\n── Test 2: Another standalone Indian name ──")
t2_map, t2_counters = {}, {}
t2_out = redact_text(
    "Sundar's CGPA is 8.5.",
    return_map=False,
    pii_map=t2_map,
    counters=t2_counters,
    student_names={"Sundar"}
)
print(f"  Input : Sundar's CGPA is 8.5.")
print(f"  Output: {t2_out}")
check("'Sundar' in sentence → redacted as [PERSON:idx_N]", "[PERSON:" in t2_out, f"out='{t2_out}'")


# ── Test 3: Multi-word name match → full name as single token ────────────────
print("\n── Test 3: Full name passed as multi-word student_name ──")
t3_map, t3_counters = {}, {}
t3_out = redact_text(
    "Yash Guntha joined Google.",
    return_map=False,
    pii_map=t3_map,
    counters=t3_counters,
    student_names={"Yash Guntha"}
)
print(f"  Input : Yash Guntha joined Google.")
print(f"  Output: {t3_out}")
check("'Yash Guntha' as full name → at least one [PERSON:idx_N] token in output", "[PERSON:" in t3_out, f"out='{t3_out}'")
# Ensure the name was consumed as one token (not two separate badges → "Yash" and "Guntha" each
# map to the SAME token index since one is a prefix of the full name, or at least one is present)
person_count = len(re.findall(r'\[PERSON:idx_\d+\]', t3_out))
check("At most 2 [PERSON] tokens for a 2-word name (no runaway fragmentation)", person_count <= 2, f"tokens={person_count}")


# ── Test 4: Name NOT in student_names → not redacted by the new guard ────────
print("\n── Test 4: Unknown name without student_names kwarg → no forced PERSON badge ──")
t4_map, t4_counters = {}, {}
t4_out = redact_text(
    "Ramesh applied for internship.",
    return_map=False,
    pii_map=t4_map,
    counters=t4_counters,
    student_names=set()   # empty set — no known names
)
print(f"  Input : Ramesh applied for internship.")
print(f"  Output: {t4_out}")
# Ramesh might or might not be caught by spaCy NER — the point is the *new guard*
# doesn't fire for empty student_names. We can only check the guard doesn't crash.
check("Empty student_names set → no crash, output is a string", isinstance(t4_out, str), f"out='{t4_out}'")


# ── Test 5: Labeled field still works (regression — _NAME_FIELD_RE unchanged) ─
print("\n── Test 5: Labeled name field still works (regression guard) ──")
t5_map, t5_counters = {}, {}
t5_out = redact_text(
    "First Name: Priya",
    return_map=False,
    pii_map=t5_map,
    counters=t5_counters,
    student_names={"Priya"}
)
print(f"  Input : First Name: Priya")
print(f"  Output: {t5_out}")
check("Labeled field 'First Name: Priya' still produces [PERSON:idx_N]", "[PERSON:" in t5_out, f"out='{t5_out}'")
# Ensure no double-token (label guard + student_names guard both firing → same value → reuse)
person_count_t5 = len(re.findall(r'\[PERSON:idx_\d+\]', t5_out))
check("No duplicate PERSON tokens for same name value (token reuse works)", person_count_t5 == 1, f"count={person_count_t5}")


# ── Test 6: Structural label word in student_names → not redacted ────────────
print("\n── Test 6: Name that collides with structural label never gets redacted ──")
t6_map, t6_counters = {}, {}
# "Intern" is in _STRUCTURAL_LABELS; if a student were ironically named "Intern"
# the structural label guard should still win and prevent PERSON badge
t6_out = redact_text(
    "Employment Type: Intern",
    return_map=False,
    pii_map=t6_map,
    counters=t6_counters,
    student_names={"Intern"}
)
print(f"  Input : Employment Type: Intern")
print(f"  Output: {t6_out}")
check("'Intern' in student_names but also structural label → NOT redacted as PERSON", "[PERSON:" not in t6_out, f"out='{t6_out}'")


# ── Summary ───────────────────────────────────────────────────────────────────
print("\n══════════════════════════════════════════════")
passed = sum(results)
total = len(results)
print(f"  Results: {passed}/{total} tests passed")
if passed == total:
    print("  \033[92mALL PASS — M1 fix is working\033[0m")
else:
    print(f"  \033[91m{total - passed} FAILING — implement student_names guard in redact_text()\033[0m")
print("══════════════════════════════════════════════\n")
sys.exit(0 if passed == total else 1)
