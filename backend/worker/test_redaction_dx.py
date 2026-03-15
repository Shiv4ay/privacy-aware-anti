import re
import sys
import os

# Set up path to import app.py
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from app import redact_text
except ImportError as e:
    print(f"Failed to import from app: {e}")
    sys.exit(1)

test_strings = [
    "PESA ID: PES120244116 dx_7]16",
    "Student name is John with id PES1PG24CA165 and PES120244116 dx_7]16 in his profile.",
    "Company is Wipro."
]

print("--- Testing Redaction ---")
for s in test_strings:
    redacted = redact_text(s)
    print(f"Original: {s}")
    print(f"Redacted: {redacted}")
    print("-" * 40)
    
    if "dx_7]16" in redacted:
        print("❌ BUG CONFIRMED: Suffix was not fully redacted.")
    else:
        print("✅ PASS: Suffix successfully caught.")
    print("=" * 40)
