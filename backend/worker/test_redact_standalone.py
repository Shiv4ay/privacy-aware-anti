
import re
from typing import List, Optional, Dict, Any

# Mocking the Type Map and Patterns from app.py
TYPE_MAP = {
    "PERSON": "PERSON", "ORGANIZATION": "COMPANY", "PHONE_NUMBER": "PHONE",
    "EMAIL_ADDRESS": "EMAIL", "US_SSN": "SSN", "LOCATION": "LOCATION", "DATE_TIME": "DATE",
    "STUDENT_ID": "USER_ID", "SYSTEM_ID": "ID"
}
ID_PATTERN = re.compile(r'\b(?:PES|STU|RES|INT|COMP|FAC|PLC|CRS|DEPT|MCA|ALU|USR|CSE|ISE|ECE|EEE|BME|BMS)[A-Z0-9_]*[0-9]{2,}\b|\b[A-Z]{2,4}[0-9]{3}[A-Z0-9]{0,3}\b', re.IGNORECASE)

class MockRecognizerResult:
    def __init__(self, entity_type, start, end, score):
        self.entity_type = entity_type
        self.start = start
        self.end = end
        self.score = score

def mock_analyze(text):
    # Simulating Presidio: PES... might be ORGANIZATION/COMPANY
    # In context, it might be STUDENT_ID/USER_ID
    results = []
    # If text is query-like
    if "Can you" in text:
        # Match PES... as ORGANIZATION (this is our primary suspicion)
        m = re.search(r'PES1PG24CA135', text)
        if m:
            results.append(MockRecognizerResult("ORGANIZATION", m.start(), m.end(), 0.95))
    # If text is context-like
    elif "STUDENT_ID" in text:
        # Match PES... as STUDENT_ID
        m = re.search(r'PES1PG24CA135', text)
        if m:
            results.append(MockRecognizerResult("STUDENT_ID", m.start(), m.end(), 0.95))
    return results

def redact_text_local(text, pii_map=None, counters=None):
    if pii_map is None: pii_map = {}
    if counters is None: counters = {}
    
    segments = re.split(r'(<[^>]+>|\||\n)', text)
    final_output_parts = []
    
    for segment in segments:
        if not segment or re.match(r'(<[^>]+>|\||\n)', segment):
            final_output_parts.append(segment)
            continue
            
        chunk_results = mock_analyze(segment)
        if not chunk_results:
            final_output_parts.append(segment)
            continue
            
        chunk_out = segment
        sorted_chunks = sorted(chunk_results, key=lambda r: r.start, reverse=True)
        for res in sorted_chunks:
            val = segment[res.start:res.end].strip()
            dtype = TYPE_MAP.get(res.entity_type, "REDACTED")
            
            # THE FIX: Universal Token Lock
            existing_token = None
            for tk, tv in pii_map.items():
                if tv.lower() == val.lower():
                    existing_token = tk
                    print(f"DEBUG: Reusing {existing_token} for '{val}' (Found as {dtype})")
                    break
            
            if existing_token:
                token = existing_token
            else:
                idx = counters.get(dtype, 0)
                counters[dtype] = idx + 1
                token = f"[{dtype}:idx_{idx}]"
                pii_map[token] = val
                print(f"DEBUG: Created NEW {token} for '{val}' (Found as {dtype})")
                
            chunk_out = chunk_out[:res.start] + token + chunk_out[res.end:]
        final_output_parts.append(chunk_out)
    
    return "".join(final_output_parts)

# --- THE TEST ---
pii_map = {}
counters = {}

print("--- Turn 1: Query ---")
q = redact_text_local("Can you get me details for PES1PG24CA135?", pii_map, counters)
print(f"Redacted Query: {q}")

print("\n--- Turn 2: Context ---")
c = redact_text_local("STUDENT_ID: PES1PG24CA135 | Name: Vimala", pii_map, counters)
print(f"Redacted Context: {c}")

if "[COMPANY:idx_0]" in q and "[COMPANY:idx_0]" in c:
    print("\nSUCCESS: Both match!")
else:
    print("\nFAILURE: Mismatch!")
