
import chromadb
import os

CHROMADB_HOST = os.getenv("CHROMADB_HOST", "chromadb")
CHROMADB_PORT = int(os.getenv("CHROMADB_PORT", 8000))

client = chromadb.HttpClient(host=CHROMADB_HOST, port=CHROMADB_PORT)
collections = client.list_collections()

print(f"Found {len(collections)} collections:")
for col in collections:
    print(f"- {col.name} ({col.count()} items)")
