import chromadb

# Connect and test search
client = chromadb.HttpClient(host="localhost", port=8000)
collection = client.get_collection("privacy_documents_1")

print(f"Collection: {collection.name}")
print(f"Total documents: {collection.count()}")

# Test search for Margaret Johnson
print("\n=== Testing Search: 'Margaret Johnson GPA' ===")
try:
    results = collection.query(
        query_texts=["Margaret Johnson GPA"],
        n_results=3,
        include=["metadatas", "documents", "distances"]
    )
    
    print(f"✅ Found {len(results['ids'][0])} results")
    for i, (doc_id, distance, document) in enumerate(zip(
        results['ids'][0],
        results['distances'][0],
        results['documents'][0]
    )):
        print(f"\n[{i+1}] Distance: {distance:.3f}")
        print(f"    ID: {doc_id}")
        print(f"    Content (first 200 chars): {document[:200]}...")
except Exception as e:
    print(f"❌ Search failed: {e}")
