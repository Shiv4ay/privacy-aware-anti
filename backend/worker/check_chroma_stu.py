import chromadb
from pprint import pprint

# Initialize ChromaDB client pointing to the chroma container
client = chromadb.HttpClient(host="chromadb", port=8000)

org_id = 4
collection_name = f"privacy_documents_{org_id}"

try:
    collection = client.get_collection(name=collection_name)
    print(f"Collection '{collection_name}' found. Total docs: {collection.count()}")

    # Find chunks belonging to doc_4_23958, doc_4_11723, or doc_4_30350
    # In ChromaDB, the chunk ID is usually f"doc_{org_id}_{doc_id}_chunk_{i}"
    # We can fetch them by prefix or just query the metadata where document_id = doc_id
    response = collection.get(
        where={"$or": [
            {"document_id": 11723},
            {"document_id": 30350},
            {"document_id": 23958}
        ]}
    )
    
    print(f"Found {len(response['ids'])} chunks for the student record docs.")
    for i in range(len(response['ids'])):
        print(f"\n--- Chunk ID: {response['ids'][i]} ---")
        print(f"Metadata: {response['metadatas'][i]}")
        print(f"Document: {response['documents'][i][:200]}...")

except Exception as e:
    print(f"Error accessing ChromaDB: {e}")
