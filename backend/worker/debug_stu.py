"""Quick debug: show raw document text for STU20240507 from ChromaDB."""
import chromadb

client = chromadb.HttpClient(host='chromadb', port=8000)
coll = client.get_or_create_collection('privacy_documents_1')
results = coll.get(
    where_document={"$contains": "STU20240507"},
    limit=5,
    include=["documents", "metadatas"]
)
for i, (doc, meta) in enumerate(zip(results["documents"], results["metadatas"])):
    fname = (meta or {}).get("filename", "unknown")
    print(f"--- Record {i+1} ({fname}) ---")
    print(doc[:600])
    print()
