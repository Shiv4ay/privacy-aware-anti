import sys
import os
import json
import csv

# Add app to path
sys.path.append('.')
from app import redact_text, extract_text_from_file

# Sample CSV content
csv_content = """student_id,first_name,last_name,email,gender,date_of_birth,address
PES1PG24CA001,Gayatri,Reddy,gayatri.pes1pg24ca001@pesu.edu.in,F,2003-02-27,"57, Hebbal, Bangalore - 560095, Karnataka"
"""

test_csv = "test_verification.csv"
with open(test_csv, "w") as f:
    f.write(csv_content)

print("--- TESTING CSV EXTRACTION ---")
extracted = extract_text_from_file(test_csv)
print(extracted)

print("\n--- TESTING REDACTION ---")
redacted, pii_map = redact_text(extracted, return_map=True)
print(redacted)

print("\n--- PII MAP ---")
print(json.dumps(pii_map, indent=2))

os.remove(test_csv)
