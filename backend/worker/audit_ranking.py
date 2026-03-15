from app import get_embedding, get_org_collection
import json

org_id = 4
student_id = "PES1PG24CA169"
query = f"{student_id} give details"

print(f"Auditing ranking for query: '{query}' in Org {org_id}")

# 1. Get embedding (using the real app logic)
emb = get_embedding(query)
if not emb:
    print("Error: Could not generate embedding")
    exit(1)

# 2. Query collection with high depth
collection = get_org_collection(org_id)
results = collection.query(
    query_embeddings=[emb],
    n_results=200,
    include=["documents", "metadatas", "distances"]
)

docs = results["documents"][0]
metas = results["metadatas"][0]
dists = results["distances"][0]

print(f"\nRetrieved {len(docs)} chunks. Rank of students.csv chunks:")

student_csv_count = 0
found_student_csv = False

for i in range(len(docs)):
    filename = metas[i].get("filename", "Unknown")
    if filename == "students.csv":
        student_csv_count += 1
        found_student_csv = True
        print(f"Rank {i+1}: Score={500/(500+dists[i]):.4f} | Filename={filename} | Doc ID={metas[i].get('doc_id')}")
        # print(f"Content: {docs[i][:200]}...")

if not found_student_csv:
    print("WARNING: No students.csv chunks found in top 50!")

# Check distribution
file_summary = {}
for m in metas:
    f = m.get("filename", "Unknown")
    file_summary[f] = file_summary.get(f, 0) + 1

print("\nTop 50 File Distribution:")
for f, count in file_summary.items():
    print(f" - {f}: {count}")
