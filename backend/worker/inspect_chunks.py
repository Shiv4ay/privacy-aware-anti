import chromadb

client = chromadb.HttpClient(host='chromadb', port=8000)
search_query = "PES1PG24CA169"
org_id = 4
collection_name = f"privacy_documents_{org_id}"

try:
    collection = client.get_collection(name=collection_name)
    print(f"\n--- Checking Collection: {collection_name} ---")
    
    results = collection.get(
        where={"filename": "students.csv"},
        where_document={"$contains": search_query}
    )
    
    ids = results.get('ids', [])
    metadatas = results.get('metadatas', [])
    documents = results.get('documents', [])
    
    print(f"Found {len(ids)} chunks containing '{search_query}' in students.csv for Org {org_id}")
    
    for i in range(len(ids)):
        print(f"\n--- Chunk {i} ---")
        print(documents[i])
            
except Exception as e:
    print(f"Error: {e}")
