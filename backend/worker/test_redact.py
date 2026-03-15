
import logging
import sys
import os

# Mock enough to import app or use its functions
sys.path.append('.')
os.environ["DATABASE_URL"] = "postgresql://admin:secure_password@postgres:5432/privacy_rag_db"
os.environ["REDIS_URL"] = "redis://redis:6379/0"

from app import redact_text, logger

# Set logger to info
logger.setLevel(logging.INFO)
handler = logging.StreamHandler(sys.stdout)
logger.addHandler(handler)

pii_map = {}
counters = {}

test_query = "Can you get me details for PES1PG24CA135?"
redacted_query = redact_text(test_query, pii_map=pii_map, counters=counters)
print(f"Redacted Query: {redacted_query}")
print(f"PII Map after Query: {pii_map}")

test_context = "STUDENT_ID: PES1PG24CA135 | Name: Vimala"
redacted_context = redact_text(test_context, pii_map=pii_map, counters=counters)
print(f"Redacted Context: {redacted_context}")
print(f"PII Map after Context: {pii_map}")

if redacted_query.split()[-1] == redacted_context.split()[1]:
    print("SUCCESS: Tokens match!")
else:
    print("FAILURE: Tokens do not match!")
