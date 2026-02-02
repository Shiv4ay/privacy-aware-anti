import psycopg2
import json
import base64
import requests
import chromadb
import os
from minio import Minio

# Config from .env or defaults
DATABASE_URL = "postgresql://postgres:postgres123@localhost:5432/privacy_docs"
OLLAMA_URL = "http://localhost:11434"
CHROMADB_HOST = "localhost"
CHROMADB_PORT = 8000

def get_embedding(text):
    formats = [("input", lambda t: {"model": "nomic-embed-text:latest", "input": t}),
               ("prompt", lambda t: {"model": "nomic-embed-text:latest", "prompt": t})]
    for name, fmt in formats:
        try:
            payload = fmt(text)
            r = requests.post(f"{OLLAMA_URL}/api/embeddings", json=payload, timeout=10)
            if r.status_code == 200:
                data = r.json()
                emb = data.get("embedding") or data.get("embeddings")
                if emb:
                    if isinstance(emb, list) and len(emb) > 0 and isinstance(emb[0], list):
                        emb = emb[0] # Handle nested list
                    return emb
            print(f"Ollama format '{name}' failed: {r.status_code} - {r.text}")
        except Exception as e:
            print(f"Request Error for '{name}': {e}")
    return None

def test_process():
    try:
        # 1. Connect to DB
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # 2. Get one pending doc
        cur.execute("SELECT id, filename, metadata, file_key, is_encrypted, encrypted_dek, encryption_iv, encryption_tag FROM documents WHERE status = 'pending' LIMIT 1")
        doc = cur.fetchone()
        
        if not doc:
            print("No pending docs found")
            return
        
        doc_id, filename, metadata, file_key, is_encrypted, encrypted_dek, encryption_iv, encryption_tag = doc
        print(f"Processing Doc ID: {doc_id}, Filename: {filename}")
        
        # 3. Handle metadata
        if isinstance(metadata, str):
            metadata_dict = json.loads(metadata)
        else:
            metadata_dict = metadata or {}
        
        # Skip decryption for this simple test if it's too complex, or just use raw content if available
        # But wait, our upload script encrypted everything.
        
        # 4. Generate text for embedding
        text_parts = [f"{k}: {v}" for k, v in metadata_dict.items() if v]
        text = " | ".join(text_parts) if text_parts else f"Document from {filename}"
        print(f"Text length: {len(text)}")
        
        # 5. Get Embedding
        print("Requesting embedding...")
        emb = get_embedding(text)
        if emb:
            print(f"Success! Embedding len: {len(emb)}")
        else:
            print("Failed to get embedding")
            return

        # 6. Add to Chroma
        print("Adding to ChromaDB...")
        client = chromadb.HttpClient(host=CHROMADB_HOST, port=CHROMADB_PORT)
        collection = client.get_or_create_collection(name="privacy_documents_1")
        collection.add(
            ids=[f"test_doc_{doc_id}"],
            documents=[text],
            embeddings=[emb],
            metadatas=[{"filename": filename}]
        )
        print("Added to ChromaDB successfully")
        
        # 7. Update DB
        cur.execute("UPDATE documents SET status = 'processed' WHERE id = %s", (doc_id,))
        conn.commit()
        print("Updated Postgres successfully")
        
        conn.close()
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_process()
