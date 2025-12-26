import chromadb

# Connect to ChromaDB
client = chromadb.HttpClient(host="localhost", port=8000)

try:
    print("Deleting collection: privacy_documents_1")
    client.delete_collection("privacy_documents_1")
    print("✅ Collection deleted successfully")
    
    # Verify
    collections = client.list_collections()
    print(f"\nRemaining collections: {[c.name for c in collections]}")
    
except Exception as e:
    print(f"❌ Error deleting collection: {e}")
