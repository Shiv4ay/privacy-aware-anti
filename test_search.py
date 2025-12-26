import chromadb

# Connect to ChromaDB
client = chromadb.HttpClient(host="localhost", port=8000)

# Get the org 1 collection
collection = client.get_collection("privacy_documents_1")

print(f"Collection: {collection.name}")
print(f"Total documents: {collection.count()}")

# Get a sample to see what's in there
sample = collection.get(limit=5, include=["metadatas", "documents"])

print("\n=== SAMPLE DOCUMENTS ===")
for i, (doc_id, metadata, document) in enumerate(zip(sample['ids'], sample['metadatas'], sample['documents'])):
    print(f"\n[{i+1}] ID: {doc_id}")
    print(f"    Metadata: {metadata}")
    print(f"    Content (first 200 chars): {document[:200] if document else 'None'}...")

# Try a search for "Margaret Johnson"
print("\n\n=== TEST SEARCH: 'Margaret Johnson' ===")
results = collection.query(
    query_texts=["Margaret Johnson GPA"],
    n_results=3,
    include=["metadatas", "documents", "distances"]
)

print(f"Found {len(results['ids'][0])} results")
for i, (doc_id, distance, metadata, document) in enumerate(zip(
    results['ids'][0], 
    results['distances'][0],
    results['metadatas'][0],
    results['documents'][0]
)):
    print(f"\n[{i+1}] Distance: {distance}")
    print(f"    ID: {doc_id}")
    print(f"    Metadata: {metadata}")
    print(f"    Content (first 300 chars): {document[:300]}...")
