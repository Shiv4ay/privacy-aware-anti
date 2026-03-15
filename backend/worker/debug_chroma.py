import chromadb
import os

def debug_chroma():
    try:
        client = chromadb.HttpClient(host='chromadb', port=8000)
        collection = client.get_collection('privacy_documents_1')
        
        print("--- SEARCH TEST: COMP_MCA015 ---")
        # Try finding by 'student_id'
        res1 = collection.get(where={"student_id": "COMP_MCA015"})
        print(f"By student_id: {len(res1['ids'])} found. Metas: {res1['metadatas'][:1]}")
        
        # Try finding by 'id'
        res2 = collection.get(where={"id": "COMP_MCA015"})
        print(f"By id: {len(res2['ids'])} found. Metas: {res2['metadatas'][:1]}")
        
        # Keyword search
        kw = collection.query(query_texts=["COMP_MCA015"], n_results=1)
        print(f"Keyword search IDs: {kw['ids']}")
        if kw['metadatas'] and len(kw['metadatas']) > 0:
            print(f"Best Match Metas: {kw['metadatas'][0]}")
            
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    debug_chroma()
