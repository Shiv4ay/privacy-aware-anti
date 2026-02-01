
import chromadb
import os

CHROMADB_HOST = "chromadb"
CHROMADB_PORT = 8000

client = chromadb.HttpClient(host=CHROMADB_HOST, port=CHROMADB_PORT)
collection = client.get_collection("privacy_documents_1")

results = collection.get(where_document={"$contains": "Margaret Johnson"})
print(f"Found {len(results['ids'])} items containing 'Margaret Johnson'")
for doc in results['documents']:
    print(f"- {doc[:200]}")
