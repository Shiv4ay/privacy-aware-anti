"""
T9.2 — Company Name Corruption Fix Tests
TDD RED phase: these tests define the expected behavior of COMP_ name resolution.

Bug A — Primary pass (line 2500):
    `target_labels` for COMP includes generic "name".
    `any(tl in label for tl in target_labels)` evaluates True for label "student_name"
    because Python string membership: "name" in "student_name" → True.
    Result: student names are picked as company names.

Bug B — Tertiary pass (lines 2564-2584):
    The fallback splits on [,|:\n]. For a placement chunk like:
        student_name: Siba Sundar
        company_name: Swiggy
    After splitting on ":" and "\n", sub_parts includes "Siba Sundar".
    No guard checks whether the *previous* token was a student-name label.
    Result: "Siba Sundar" passes all existing guards and becomes the company name.

Run inside worker container:
    docker exec privacy-aware-worker python -m pytest test_comp_resolution.py -v
"""
import re
import sys
import pytest

sys.path.insert(0, "/app")

# ────────────────────────────────────────────────────────────────────────────
# Import helpers — will fail (RED phase) until T9.2 fix is applied
# ────────────────────────────────────────────────────────────────────────────
try:
    from app import _extract_entity_name, _STUDENT_NAME_LABELS
    _HELPERS_IMPORTED = True
except ImportError:
    _HELPERS_IMPORTED = False

requires_helpers = pytest.mark.skipif(
    not _HELPERS_IMPORTED,
    reason="_extract_entity_name / _STUDENT_NAME_LABELS not yet implemented (RED phase — expected)"
)


# ────────────────────────────────────────────────────────────────────────────
# Sanity: RED indicator
# ────────────────────────────────────────────────────────────────────────────

def test_helpers_exist():
    """
    RED: Fails until _extract_entity_name and _STUDENT_NAME_LABELS are added to app.py.
    GREEN: Passes once T9.2 fix is applied.
    """
    assert _HELPERS_IMPORTED, (
        "RED PHASE: _extract_entity_name or _STUDENT_NAME_LABELS not found in app.py. "
        "Apply T9.2 fix to turn GREEN."
    )


# ────────────────────────────────────────────────────────────────────────────
# Bug A tests — Primary pass: "name" in target_labels MUST NOT match "student_name"
# ────────────────────────────────────────────────────────────────────────────

class TestBugA_TargetLabelMatching:
    """Verify that removing 'name' from COMP target_labels fixes the primary pass."""

    # ── Demonstrate the bug ──────────────────────────────────────────────────

    def test_name_substring_in_student_name_label(self):
        """
        Documents the BUG: "name" is a substring of "student_name".
        This is a pure Python string test — no app code needed.
        After the fix, COMP target_labels must NOT contain "name".
        """
        buggy_target_labels = ["company_name", "company name", "company", "organization", "name"]
        label = "student_name"
        # BUG: this evaluates True because "name" in "student_name"
        assert any(tl in label for tl in buggy_target_labels), \
            "BUG CONFIRMED: generic 'name' matches 'student_name' — causes student name → company leak"

    def test_fixed_labels_do_not_match_student_name(self):
        """
        FIXED: After removing 'name' from COMP target_labels,
        label 'student_name' must NOT match any target label.
        """
        fixed_target_labels = ["company_name", "company name", "company", "organization"]
        label = "student_name"
        assert not any(tl in label for tl in fixed_target_labels), \
            "FIXED: 'student_name' label must NOT match COMP target_labels"

    def test_fixed_labels_still_match_company_name_label(self):
        """FIXED labels must still match legitimate company-name labels."""
        fixed_target_labels = ["company_name", "company name", "company", "organization"]
        company_labels = ["company_name", "company name", "company", "organization"]
        for label in company_labels:
            assert any(tl in label for tl in fixed_target_labels), \
                f"FIXED labels must match '{label}'"

    # ── _extract_entity_name tests ────────────────────────────────────────────

    @requires_helpers
    def test_primary_pass_resolves_company_not_student_name(self):
        """
        Given a placement chunk with both student_name and company_name fields,
        _extract_entity_name for a COMP_ hop must return the company name.
        """
        target_block = (
            "student_name: Siba Sundar\n"
            "company_name: Swiggy\n"
            "role: SDE-I\n"
            "salary: 12 LPA"
        )
        result = _extract_entity_name(target_block, "COMP_MCA015")
        assert result == "Swiggy", \
            f"Expected 'Swiggy', got '{result}'. Bug A: 'name' in target_labels matched student_name."

    @requires_helpers
    def test_primary_pass_works_for_different_student_names(self):
        """Universal: Different student names must never become the company name."""
        student_names = [
            "Yash Guntha",
            "Priya Sharma",
            "Rahul Kumar",
            "Ananya Rao",
        ]
        target_block_template = (
            "student_name: {name}\n"
            "company_name: Infosys\n"
            "role: Software Engineer\n"
        )
        for name in student_names:
            target_block = target_block_template.format(name=name)
            result = _extract_entity_name(target_block, "COMP_MCA099")
            assert result == "Infosys", \
                f"For student '{name}': expected 'Infosys', got '{result}'. Not universal."

    @requires_helpers
    def test_primary_pass_handles_first_name_field(self):
        """first_name field value must never become a company name."""
        target_block = (
            "first_name: Siba\n"
            "last_name: Sundar\n"
            "company_name: Amazon\n"
        )
        result = _extract_entity_name(target_block, "COMP_MCA001")
        assert result == "Amazon", f"Expected 'Amazon', got '{result}'"

    @requires_helpers
    def test_primary_pass_handles_name_field_alone(self):
        """'name:' field in a chunk where COMP lookup runs must not be mistaken for company."""
        # This represents a chunk where a student's name field appears before company
        target_block = (
            "name: John Doe\n"
            "company: TCS\n"
        )
        result = _extract_entity_name(target_block, "COMP_MCA002")
        assert result == "TCS", f"Expected 'TCS', got '{result}'"


# ────────────────────────────────────────────────────────────────────────────
# Bug B tests — Tertiary pass: context guard must track student-label state
# ────────────────────────────────────────────────────────────────────────────

class TestBugB_TertiaryPassContextGuard:
    """Verify that prev_was_student_label tracking prevents student names in tertiary pass."""

    def test_student_name_after_label_should_be_skipped(self):
        """
        Documents the BUG: tertiary pass splits 'student_name: Siba Sundar' on ':'
        and '\n'. Without context tracking, 'Siba Sundar' passes all existing guards.
        After the fix, a token immediately following a student-name label must be skipped.
        """
        target_block = "student_name: Siba Sundar\ncompany_name: Swiggy"
        sub_parts = re.split(r'[,|:\n]', target_block)
        # sub_parts → ['student_name', ' Siba Sundar', 'company_name', ' Swiggy']
        stripped = [p.strip() for p in sub_parts]
        assert "Siba Sundar" in stripped, \
            "Test setup: 'Siba Sundar' must appear as a sub_part after split (demonstrates exposure)"
        assert "Swiggy" in stripped, \
            "Test setup: 'Swiggy' must also appear as a sub_part"

    @requires_helpers
    def test_student_name_labels_frozenset_exists(self):
        """_STUDENT_NAME_LABELS must be a frozenset containing required label strings."""
        assert isinstance(_STUDENT_NAME_LABELS, frozenset), \
            "_STUDENT_NAME_LABELS must be a frozenset"
        required = {"student_name", "student name", "first_name", "first name",
                    "last_name", "last name", "name", "student"}
        missing = required - _STUDENT_NAME_LABELS
        assert not missing, f"_STUDENT_NAME_LABELS missing entries: {missing}"

    @requires_helpers
    def test_tertiary_pass_does_not_pick_student_name(self):
        """
        Tertiary pass fallback must skip tokens that follow a student-name label.
        'Siba Sundar' appears right after 'student_name:' — must be skipped.
        """
        target_block = (
            "student_name: Siba Sundar\n"
            "company_name: Swiggy"
        )
        result = _extract_entity_name(target_block, "COMP_MCA015")
        assert result != "Siba Sundar", \
            "Bug B: tertiary pass picked student name 'Siba Sundar' as company name"
        assert result == "Swiggy", f"Expected 'Swiggy', got '{result}'"

    @requires_helpers
    def test_tertiary_pass_universal_for_any_student_name(self):
        """
        Student names of any length/style must not leak through tertiary pass.
        Tests different name patterns (single word, hyphenated, multi-word).
        """
        cases = [
            ("Yash Guntha", "Google"),
            ("Priya", "Microsoft"),
            ("Raj Kumar Singh", "Flipkart"),
            ("Ananya-Rao", "Ola"),
        ]
        for student_name, company in cases:
            target_block = f"student_name: {student_name}\ncompany_name: {company}"
            result = _extract_entity_name(target_block, "COMP_MCA050")
            assert result == company, \
                f"For student '{student_name}': expected '{company}', got '{result}'"

    @requires_helpers
    def test_tertiary_pass_handles_first_name_last_name_labels(self):
        """first_name and last_name label values must be skipped in tertiary pass."""
        target_block = (
            "first_name: John\n"
            "last_name: Doe\n"
            "company_name: Wipro"
        )
        result = _extract_entity_name(target_block, "COMP_MCA030")
        assert result == "Wipro", f"Expected 'Wipro', got '{result}'"
        assert result not in ("John", "Doe"), \
            "first_name / last_name values must not become company names"


# ────────────────────────────────────────────────────────────────────────────
# Happy path: legitimate company name resolution must still work
# ────────────────────────────────────────────────────────────────────────────

class TestCompResolutionHappyPath:
    """Regression: the fix must not break legitimate company name resolution."""

    @requires_helpers
    def test_resolves_company_from_company_name_field(self):
        """Standard placement chunk — company_name field must resolve correctly."""
        target_block = (
            "placement_id: PLC00028\n"
            "student_name: Siba Sundar\n"
            "company_name: Swiggy\n"
            "role: SDE-I\n"
            "salary: 12 LPA\n"
            "status: Placed"
        )
        result = _extract_entity_name(target_block, "COMP_MCA015")
        assert result == "Swiggy", f"Expected 'Swiggy', got '{result}'"

    @requires_helpers
    def test_resolves_company_from_organization_field(self):
        """Some chunks use 'organization' as the label."""
        target_block = "organization: Infosys\ntype: IT Services"
        result = _extract_entity_name(target_block, "COMP_MCA033")
        assert result == "Infosys", f"Expected 'Infosys', got '{result}'"

    @requires_helpers
    def test_resolves_company_from_csv_positional_format(self):
        """Headerless CSV format: ID,CompanyName,Industry,City"""
        target_block = "COMP_MCA015,Swiggy,FoodTech,Bangalore"
        result = _extract_entity_name(target_block, "COMP_MCA015")
        assert result == "Swiggy", f"Expected 'Swiggy', got '{result}'"

    @requires_helpers
    def test_resolves_multiword_company_name(self):
        """Multi-word company names (e.g. 'Tata Consultancy Services') must resolve."""
        target_block = "company_name: Tata Consultancy Services\nstudent_name: Jane Doe"
        result = _extract_entity_name(target_block, "COMP_MCA020")
        assert result == "Tata Consultancy Services", f"Got '{result}'"

    @requires_helpers
    def test_does_not_resolve_to_redacted_entity_for_known_company(self):
        """When company name is clearly present, must not return 'REDACTED_ENTITY'."""
        target_block = (
            "student_name: Alice B\n"
            "company: Amazon\n"
            "location: Bangalore"
        )
        result = _extract_entity_name(target_block, "COMP_MCA040")
        assert result != "REDACTED_ENTITY", "Must resolve 'Amazon', not return REDACTED_ENTITY"
        assert result == "Amazon", f"Expected 'Amazon', got '{result}'"

    @requires_helpers
    def test_salary_never_becomes_company_name(self):
        """Salary strings must never be returned as company names."""
        target_block = (
            "student_name: Bob\n"
            "company_name: Google\n"
            "salary: 18 LPA\n"
            "ctc: Rs. 18,00,000"
        )
        result = _extract_entity_name(target_block, "COMP_MCA055")
        assert result == "Google", f"Expected 'Google', got '{result}'"
        assert "LPA" not in result and "Rs." not in result, "Salary must not become company name"

    @requires_helpers
    def test_city_name_never_becomes_company_name(self):
        """City names (Bangalore, Hyderabad) must not be returned as company names."""
        target_block = (
            "student_name: Carol\n"
            "company_name: Ola\n"
            "location: Bangalore"
        )
        result = _extract_entity_name(target_block, "COMP_MCA060")
        assert result == "Ola", f"Expected 'Ola', got '{result}'"
