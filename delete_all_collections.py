import chromadb

client = chromadb.HttpClient(host="localhost", port=8000)
collections = client.list_collections()

print(f"Deleting {len(collections)} collections...")
for col in collections:
    try:
        client.delete_collection(col.name)
        print(f"  ✅ Deleted: {col.name}")
    except Exception as e:
        print(f"  ❌ Failed to delete {col.name}: {e}")

print("\n✅ All collections deleted")
