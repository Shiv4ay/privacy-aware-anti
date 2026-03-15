import psycopg2
import os
import json
import base64
from app import CryptoManager, get_embedding, chunk_text, get_org_collection

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:secure_password@postgres:5432/privacy_rag_db")

try:
    conn = psycopg2.connect(DATABASE_URL)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, filename, metadata, encrypted_dek, encryption_iv, encryption_tag, is_encrypted
            FROM documents 
            WHERE id = 11723
        """)
        row = cur.fetchone()
        if row:
            doc_id, filename, metadata, encrypted_dek, encryption_iv, encryption_tag, is_encrypted = row
            
            metadata_dict = json.loads(metadata) if isinstance(metadata, str) else (metadata or {})
            
            if is_encrypted and CryptoManager:
                encrypted_b64 = metadata_dict.get("encrypted_content")
                if encrypted_b64:
                    encrypted_bytes = base64.b64decode(encrypted_b64)
                    decrypted_bytes = CryptoManager.decrypt_envelope(
                        encrypted_bytes, encrypted_dek, encryption_iv, encryption_tag
                    )
                    metadata_dict = json.loads(decrypted_bytes.decode('utf-8'))
            
            # Reconstruct text like app.py does
            text_parts = [f"{k}: {v}" for k, v in metadata_dict.items() 
                          if v and k not in ('record_type', 'source', 'row_index', 'encrypted_content')]
            text = " | ".join(text_parts) if text_parts else ""
            
            print(f"Extracted Text ({len(text)} chars): {text[:100]}...")
            
            chunks = chunk_text(text, chunk_size=512, overlap=50)
            if not chunks: chunks = [text]
            
            print(f"Number of chunks: {len(chunks)}")
            
            collection = get_org_collection(4)
            for i, chunk in enumerate(chunks):
                emb = get_embedding(chunk)
                print(f"Chunk {i} embedding len: {len(emb) if emb else 'None'}")
                chunk_id = f"doc_4_{doc_id}_chunk_{i}"
                
                try:
                    collection.add(
                        ids=[chunk_id],
                        documents=[chunk],
                        embeddings=[emb],
                        metadatas=[{"org_id": 4, "doc_id": doc_id, "filename": filename, "chunk_index": i}]
                    )
                    print(f"Successfully added Chunk {i} to ChromaDB")
                except Exception as e:
                    print(f"Failed to add Chunk {i}: {e}")
                    
except Exception as e:
    print(f"Error: {e}")
