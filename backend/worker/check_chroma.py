
import chromadb
import os

def check_count():
    try:
        # Connect to ChromaDB (using container hostname)
        client = chromadb.HttpClient(host='privacy-aware-chromadb', port=8000)
        
        # Get collection
        col_name = "privacy_documents"
        try:
            collection = client.get_collection(col_name)
            count = collection.count()
            print(f"Collection '{col_name}' count: {count}")
        except Exception as e:
            print(f"Could not get collection '{col_name}': {e}")
            
        # List all collections just in case
        print("\nAll Collections:")
        for col in client.list_collections():
            print(f"- {col.name}: {col.count()} embeddings")
            
    except Exception as e:
        print(f"Error connecting to ChromaDB: {e}")

if __name__ == "__main__":
    check_count()
