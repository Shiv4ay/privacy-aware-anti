import sys, os, re
sys.path.append(r"/app")
from app import redact_text

test_text = """BATCH_4_11707_INTERNSHIP RECORD 75:
  Internship Id: INT00075
  Student Id: PES1PG24CA169
  Company Id: COMP_MCA003
  Position: Machine Learning Intern
  Start Date: 2024-05-05
  End Date: 2024-10-26
  Stipend: 25000
  Enrollment Date: 2024-06-03
  Location: Bangalore
  Status: Completed
  Supervisor: Wipro - HR Manager"""

print("--- PII REDACTION TEST ---")
redacted, pii_map = redact_text(test_text, return_map=True, internal_only=False)
print("REDACTED:\n", redacted)
print("\nPII MAP:\n", pii_map)

print("\n--- RESOLVER PATTERN TEST ---")
found = re.findall(r'\b(?:COMP|FAC|CRS|DEPT|STU|RES|INT|PLC|MCA|ALU|USR)[A-Z0-9_]+\b', test_text, re.IGNORECASE)
print("Found IDs:", found)
