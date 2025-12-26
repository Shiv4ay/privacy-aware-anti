import chromadb

client = chromadb.HttpClient(host="localhost", port=8000)
collection = client.get_collection("privacy_documents_1")

print(f"Collection: {collection.name}")
print(f"Metadata: {collection.metadata}")
print(f"Count: {collection.count()}")

# Check a sample document's embedding dimension
sample = collection.get(limit=1, include=["embeddings"])
if sample and sample['embeddings'] and len(sample['embeddings']) > 0:
    print(f"\nSample embedding dimension: {len(sample['embeddings'][0])}")
else:
    print("\nNo embeddings found in sample")
