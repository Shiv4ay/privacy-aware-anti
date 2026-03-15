import chromadb

client = chromadb.HttpClient(host='chromadb', port=8000)

for org_id in [1, 4]:
    collection_name = f"privacy_documents_{org_id}"
    try:
        collection = client.get_collection(name=collection_name)
        print(f"Collection '{collection_name}' count: {collection.count()}")
    except Exception as e:
        print(f"Collection '{collection_name}' not found or error: {e}")
