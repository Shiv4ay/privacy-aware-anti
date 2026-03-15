from app import get_org_collection
import re

org_id = 4
keyword = "PES1PG24CA169"
org_collection = get_org_collection(org_id=org_id)

print(f"Debugging Hybrid Search for '{keyword}' in Org {org_id}...")

kw_results = org_collection.get(
    where_document={"$contains": keyword}, 
    limit=150, 
    include=["metadatas", "documents"]
)

if not kw_results or not kw_results.get("ids"):
    print("No chunks found with $contains")
    exit()

ids = kw_results["ids"]
docs = kw_results["documents"]
metas = kw_results["metadatas"]

print(f"Found {len(ids)} unique chunks with $contains.")

exact_pattern = re.compile(rf'\b{re.escape(keyword)}\b', re.IGNORECASE)

found_students_csv = False
for i in range(len(ids)):
    txt = docs[i]
    fname = metas[i].get("filename", "Unknown")
    
    match = exact_pattern.search(txt)
    if fname == "students.csv":
        found_students_csv = True
        print(f"\n[students.csv] ID: {ids[i]}")
        print(f"Exact Pattern Match: {bool(match)}")
        if not match:
            # Inspect why it didn't match
            # Find the keyword in the text
            pos = txt.find(keyword)
            if pos != -1:
                surround = txt[max(0, pos-10):pos+len(keyword)+10]
                print(f"Context: ...{surround}...")
        # print(f"Preview: {txt[:200]}...")

if not found_students_csv:
    print("\nWARNING: No students.csv chunks found in the 150 fetched records.")
