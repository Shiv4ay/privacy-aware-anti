
import chromadb
import os
import sys

# Configuration
CHROMA_HOST = os.getenv("CHROMADB_HOST", "localhost")
CHROMA_PORT = os.getenv("CHROMADB_PORT", "8000")
COLLECTION_NAME = "privacy_documents_1"

def delete_specific_docs():
    print(f"Connecting to ChromaDB at {CHROMA_HOST}:{CHROMA_PORT}...")
    try:
        client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
        
        try:
            coll = client.get_collection(COLLECTION_NAME)
        except Exception:
            print(f"Collection {COLLECTION_NAME} not found.")
            return

        # Query to find IDs of dummy docs? Or just delete by metadata?
        # Chroma deletion by where clause is best.
        
        # Delete test_rag.txt and variations
        print("Deleting dummy documents...")
        coll.delete(
            where={"filename": {"$in": ["test_rag.txt", "test_doc_org1.txt", "Retrieval_Augmented_Generation.pdf"]}}
        )
        print("✅ Dummy documents deleted from ChromaDB.")
            
    except Exception as e:
        print(f"❌ Error deleting docs: {e}")
        sys.exit(1)

if __name__ == "__main__":
    delete_specific_docs()
