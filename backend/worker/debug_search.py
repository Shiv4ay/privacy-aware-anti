import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app import search_documents
from pydantic import BaseModel

class MockSearchRequest(BaseModel):
    query: str
    top_k: int = 10
    org_id: str = "default"
    organization: str = "default"
    user_role: str = "admin"
    user_id: str = "test_user"

# Original query that worked
sr_orig = MockSearchRequest(query="STU20240507 give me his name and company details")
res_orig = search_documents(sr_orig)

# Follow-up query combined
sr_combined = MockSearchRequest(query="STU20240507 give me his name and company details what his email id ?")
res_combined = search_documents(sr_combined)

def get_docs(res):
    if hasattr(res, 'get') and 'results' in res:
        return [r.text for r in res['results']]
    return []

docs_orig = get_docs(res_orig)
docs_comb = get_docs(res_combined)

print(f"ORIGINAL QUERY DOCS RETURNED: {len(docs_orig)}")
print(f"COMBINED QUERY DOCS RETURNED: {len(docs_comb)}")

if len(docs_comb) > 0:
    print("\nFIRST DOCUMENT IN COMBINED:")
    print(docs_comb[0][:200])

if len(docs_comb) == 0:
    print("\nWait, did the search fail entirely?")
else:
    # Check if STU20240507 is actually in the returned docs for combined
    found = any("STU20240507" in doc for doc in docs_comb)
    print(f"\nDoes combined still retrieve STU20240507? {found}")

