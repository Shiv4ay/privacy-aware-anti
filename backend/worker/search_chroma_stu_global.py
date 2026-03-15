import chromadb

client = chromadb.HttpClient(host='chromadb', port=8000)
search_query = "PES1PG24CA169"
org_id = 4
collection_name = f"privacy_documents_{org_id}"

try:
    collection = client.get_collection(name=collection_name)
    print(f"\n--- Checking Collection: {collection_name} ---")
    
    results = collection.get(
        where_document={"$contains": search_query}
    )
    
    ids = results.get('ids', [])
    metadatas = results.get('metadatas', [])
    
    print(f"Found {len(ids)} chunks containing '{search_query}'")
    
    filenames = {}
    for meta in metadatas:
        fname = meta.get('filename', 'Unknown')
        filenames[fname] = filenames.get(fname, 0) + 1
    
    print("\nFile distribution for these chunks:")
    for fname, count in filenames.items():
        print(f" - {fname}: {count} chunks")
            
except Exception as e:
    print(f"Error accessing {collection_name}: {e}")
