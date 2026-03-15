import json
import os
import re
from app import redact_text, search_documents, TOP_K

# Mock Search Results for PES1PG24CA169
mock_student_doc = "student_id: PES1PG24CA169 | first_name: Siba Sundar | last_name: Guntha | gender: M | home_state: Karnataka"
mock_results_doc = "RECORD: Results for PES1PG24CA169. GPA: 8.5"

# 1. Simulate the "Universal Chain" Name Resolution logic from app.py
# (Simulating what happens in search_documents around line 2154)
resolved_name = "Siba Sundar Guntha"
hop_id = "PES1PG24CA169"

print(f"--- STEP 1: Name Resolution ---")
print(f"Resolving {hop_id} -> {resolved_name}")

context_after_resolution = mock_student_doc.replace(hop_id, resolved_name) + "\n---\n" + mock_results_doc.replace(hop_id, resolved_name)
print(f"Context after Resolution:\n{context_after_resolution}")

# 2. Simulate the final "Redact Text" in generate_chat_response
print(f"\n--- STEP 2: Redaction (PII Masking) ---")
pii_map = {}
counters = {}
query = "PES1PG24CA169 give details"

redacted_query = redact_text(query, pii_map=pii_map, counters=counters)
redacted_context, context_pii_map = redact_text(context_after_resolution, pii_map=pii_map, counters=counters, return_map=True)

print(f"Redacted Query: {redacted_query}")
print(f"Redacted Context:\n{redacted_context}")

print(f"\n--- STEP 3: The Conflict ---")
if "[ID:idx" in redacted_query:
    target_token = re.search(r'\[ID:idx_\d+\]', redacted_query).group(0)
    print(f"Target Token from query: {target_token}")
    if target_token not in redacted_context:
        print(f"RESULT: CONFLICT DETECTED! {target_token} is missing from context.")
        print(f"Original ID was replaced by {resolved_name}, which became a PERSON token.")
    else:
        print("RESULT: No conflict detected.")
else:
    print("Could not find ID token in query.")
