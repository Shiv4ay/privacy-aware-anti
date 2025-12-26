
import chromadb
import os
import sys

# Configuration
CHROMA_HOST = os.getenv("CHROMADB_HOST", "localhost")
CHROMA_PORT = os.getenv("CHROMADB_PORT", "8000")
COLLECTION_NAME = "privacy_documents_1"

def flush_collection():
    print(f"Connecting to ChromaDB at {CHROMA_HOST}:{CHROMA_PORT}...")
    try:
        client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
        
        # Check if exists
        collections = client.list_collections()
        exists = any(c.name == COLLECTION_NAME for c in collections)
        
        if exists:
            print(f"Found collection '{COLLECTION_NAME}'. Deleting...")
            client.delete_collection(COLLECTION_NAME)
            print(f"✅ Collection '{COLLECTION_NAME}' deleted successfully.")
        else:
            print(f"⚠️ Collection '{COLLECTION_NAME}' not found. Nothing to delete.")
            
    except Exception as e:
        print(f"❌ Error deleting collection: {e}")
        sys.exit(1)

if __name__ == "__main__":
    flush_collection()
