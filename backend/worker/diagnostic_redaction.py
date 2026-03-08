import sys
import os
import json

# Add app to path
sys.path.append('.')
from app import redact_text, _merge_split_name_fields

# Mock record for STU20240507
raw_record = "roll_number: STU20240507 | student_id: STU20240507 | batch: 2024 | course: B.Tech | current_company: Microsoft | current_position: Software Engineer | linkedin_profile: https://linkedin.com/in/john-fritz | email: john.fritz@gmail.com | phone: 292-836-5346 | is_placed: True | first_name: John | last_name: Fritz"

print("--- RAW RECORD ---")
print(raw_record)

# 1. Merge names
merged = _merge_split_name_fields(raw_record)
print("\n--- MERGED NAMES ---")
print(merged)

# 2. Redact
redacted, pii_map = redact_text(merged, return_map=True)
print("\n--- REDACTED CONTENT ---")
print(redacted)

print("\n--- PII MAP ---")
print(json.dumps(pii_map, indent=2))
