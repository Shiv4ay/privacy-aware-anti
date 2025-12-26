
import chromadb
import os
import sys

# Configuration
CHROMA_HOST = os.getenv("CHROMADB_HOST", "localhost")
CHROMA_PORT = os.getenv("CHROMADB_PORT", "8000")
COLLECTION_NAME = "privacy_documents_1"

def delete_ghosts():
    print(f"Connecting to ChromaDB at {CHROMA_HOST}:{CHROMA_PORT}...")
    try:
        client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
        collections = client.list_collections()
        for c_meta in collections:
            coll = client.get_collection(c_meta.name)
            print(f"Scanning '{c_meta.name}' for ghosts...")
            
            all_docs = coll.get() 
            ids_to_delete = []
            if all_docs and 'documents' in all_docs:
                for i, text in enumerate(all_docs['documents']):
                    if text and ("dummy PDF" in text or "Retrieval Augmented Generation" in text):
                        print(f"  Found ghost in {c_meta.name}: {all_docs['ids'][i]}")
                        ids_to_delete.append(all_docs['ids'][i])
            
            if ids_to_delete:
                print(f"  Deleting {len(ids_to_delete)} ghosts from {c_meta.name}...")
                coll.delete(ids=ids_to_delete)
                print(f"  ✅ Cleared {c_meta.name}")
            else:
                print(f"  ✅ {c_meta.name} is clean.")

    except Exception as e:
        print(f"❌ Error deleting ghosts: {e}")
        sys.exit(1)

if __name__ == "__main__":
    delete_ghosts()
