import chromadb
import os

def debug_record():
    try:
        client = chromadb.HttpClient(host='chromadb', port=8000)
        collection = client.get_collection('privacy_documents_1')
        
        print("--- FETCHING RECORD 4 ---")
        # Try finding the text "Document Record 4" or similar
        kw = collection.query(query_texts=["Document Record 4"], n_results=5)
        for i in range(len(kw['ids'][0])):
            print(f"ID: {kw['ids'][0][i]}")
            print(f"TEXT: {kw['documents'][0][i][:500]}")
            print(f"METAS: {kw['metadatas'][0][i]}")
            print("-" * 20)
            
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    debug_record()
