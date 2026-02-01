
import chromadb
import os
import requests

CHROMADB_HOST = "chromadb"
CHROMADB_PORT = 8000

# Get embedding for search
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")
OLLAMA_EMBED_MODEL = "nomic-embed-text"

def get_embedding(text):
    response = requests.post(
        f"{OLLAMA_URL}/api/embeddings",
        json={"model": OLLAMA_EMBED_MODEL, "prompt": text}
    )
    return response.json()["embedding"]

client = chromadb.HttpClient(host=CHROMADB_HOST, port=CHROMADB_PORT)
collection = client.get_collection("privacy_documents_1")

embedding = get_embedding("Margaret Johnson")
results = collection.query(query_embeddings=[embedding], n_results=5)

print(f"Query results for 'Margaret Johnson':")
for i in range(len(results['ids'][0])):
    print(f"ID: {results['ids'][0][i]}")
    print(f"Doc: {results['documents'][0][i]}")
    print(f"Distance: {results['distances'][0][i]}")
    print("-" * 20)
