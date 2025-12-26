import chromadb

# Test search after processing
client = chromadb.HttpClient(host="localhost", port=8000)

# List collections
collections = client.list_collections()
print(f"Collections: {[c.name for c in collections]}\n")

# Check privacy_documents_1
try:
    collection = client.get_collection("privacy_documents_1")
    count = collection.count()
    print(f"✅ Collection 'privacy_documents_1' exists!")
    print(f"   Total embeddings: {count}\n")
    
    # Test search for Margaret Johnson
    print("=== Testing Search: 'Margaret Johnson GPA' ===")
    results = collection.query(
        query_texts=["Margaret Johnson GPA"],
        n_results=3,
        include=["metadatas", "documents", "distances"]
    )
    
    if results['ids'][0]:
        print(f"✅ Found {len(results['ids'][0])} results!\n")
        for i, (doc_id, distance, document) in enumerate(zip(
            results['ids'][0],
            results['distances'][0],
            results['documents'][0]
        )):
            print(f"[{i+1}] Distance: {distance:.3f}")
            print(f"    Content preview: {document[:150]}...\n")
    else:
        print("❌ No results found")
        
except Exception as e:
    print(f"❌ Error: {e}")
