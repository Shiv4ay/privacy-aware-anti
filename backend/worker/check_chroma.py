
import chromadb
import os

def check_count():
    try:
        # Connect to ChromaDB (using container hostname)
        client = chromadb.HttpClient(host='privacy-aware-chromadb', port=8000)
        
        # Get collection
        # Get collection names to check
        env_col = os.getenv("CHROMADB_COLLECTION", "privacy_documents")
        candidates = [env_col, "privacy_documents", "privacy_documents_1"]
        
        print(f"Checking candidates: {candidates}")
        
        # List all collections
        collections = client.list_collections()
        print(f"\nFound {len(collections)} collections:")
        for col in collections:
            try:
                count = col.count()
                print(f"- {col.name}: {count} embeddings")
            except Exception:
                print(f"- {col.name}: [Error counting]")
                
    except Exception as e:
        print(f"Error connecting to ChromaDB: {e}")

if __name__ == "__main__":
    check_count()
