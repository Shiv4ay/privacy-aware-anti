
import chromadb
import os

def peek_collection():
    try:
        client = chromadb.HttpClient(host='privacy-aware-chromadb', port=8000)
        
        # Target the ACTIVE collection found
        col_name = "privacy_documents_1" 
        collection = client.get_collection(col_name)
        
        print(f"--- Peeking '{col_name}' ({collection.count()} items) ---")
        
        # Query for 'attendance' to see if relevant content exists
        results = collection.query(
            query_texts=["attendance policy", "course list"],
            n_results=3
        )
        
        for i, doc in enumerate(results['documents'][0]):
            meta = results['metadatas'][0][i]
            print(f"\n[Match {i+1}]")
            print(f"Source: {meta.get('filename', 'Unknown')}")
            print(f"Content snippet: {doc[:200]}...")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    peek_collection()
