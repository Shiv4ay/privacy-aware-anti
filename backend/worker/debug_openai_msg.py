import sys
import os
import json

sys.path.append('/app')
from app import generate_chat_response

query = "what his email id ?"
history = [
    {"role": "user", "content": "STU20240507 give me his name and company details"},
    {"role": "assistant", "content": "- Name: John Fritz\n- Company: Microsoft\n\nThis information is based on the alumni records."}
]

# We must mock request contexts or just test the search building logic directly
from app import build_search_query, search_documents, SearchRequest

sq = build_search_query(query, history)
print("SMART QUERY:", sq)

sr = SearchRequest(
    query=sq,
    top_k=20,
    org_id=1,
    organization="default",
    user_role="admin",
    user_id="1"
)
results = search_documents(sr)

context_parts = []
if isinstance(results, dict) and "results" in results:
    for idx, r in enumerate(results["results"]):
        chunk_text = ""
        if hasattr(r, "text"):
            chunk_text = r.text
        elif isinstance(r, dict):
            chunk_text = r.get("text", "")
        if chunk_text:
            context_parts.append(f"DOCUMENT RECORD {idx+1}:\n{chunk_text}\n---")

print(f"\nFOUND {len(context_parts)} RECORDS")
for p in context_parts[:5]:
    print(p)
    print("\n")
