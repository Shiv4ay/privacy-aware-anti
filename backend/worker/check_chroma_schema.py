import chromadb
from pprint import pprint

client = chromadb.HttpClient(host='chromadb', port=8000)
org_id = 4
collection_name = f"privacy_documents_{org_id}"

try:
    collection = client.get_collection(name=collection_name)
    print(f"Collection '{collection_name}' found. Total docs: {collection.count()}")

    # Try querying by filename = 'students.csv'
    res2 = collection.get(
        where={"filename": "students.csv"}
    )
    print(f"\nTotal chunks found for filename='students.csv': {len(res2['ids'])}")

    if len(res2['ids']) > 0:
        # Check for the specific student in the retrieved chunks
        found = False
        for i in range(len(res2['ids'])):
            if "PES1PG24CA169" in res2['documents'][i]:
                print(f"\n--- MATCH FOUND ---")
                print(f"Chunk ID: {res2['ids'][i]}")
                print(f"Metadata: {res2['metadatas'][i]}")
                print(f"Document: {res2['documents'][i]}")
                found = True
        if not found:
            print("\nPES1PG24CA169 not found in any students.csv chunks in ChromaDB.")

except Exception as e:
    print(f"Error accessing ChromaDB: {e}")
