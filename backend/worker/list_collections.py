
import chromadb
import os

CHROMADB_HOST = "chromadb"
CHROMADB_PORT = 8000

client = chromadb.HttpClient(host=CHROMADB_HOST, port=CHROMADB_PORT)
collections = client.list_collections()

print(f"Listing ALL collections and counts:")
for col in collections:
    print(f"- {col.name}: {col.count()} items")
