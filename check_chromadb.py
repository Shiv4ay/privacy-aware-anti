import chromadb

# Connect to ChromaDB
client = chromadb.HttpClient(host="localhost", port=8000)

# List all collections
collections = client.list_collections()
print(f"Total collections: {len(collections)}")
for col in collections:
    print(f"\nCollection: {col.name}")
    count = col.count()
    print(f"  Document count: {count}")
    
    if count > 0:
        # Get a sample
        sample = col.get(limit=3)
        print(f"  Sample IDs: {sample['ids'][:3] if sample['ids'] else 'None'}")
