
import chromadb
import os

CHROMADB_HOST = "chromadb"
CHROMADB_PORT = 8000

client = chromadb.HttpClient(host=CHROMADB_HOST, port=CHROMADB_PORT)
collection = client.get_collection("privacy_documents_1")

print(f"Collection count: {collection.count()}")

# Get first 5 items to see structure
results = collection.peek(limit=5)
for i in range(len(results['ids'])):
    print(f"ID: {results['ids'][i]}")
    print(f"Doc: {results['documents'][i][:100]}...")
    print(f"Metadatas: {results['metadatas'][i]}")
    print("-" * 20)
