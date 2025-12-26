
import chromadb
import os
import sys

# Configuration
CHROMA_HOST = os.getenv("CHROMADB_HOST", "localhost")
CHROMA_PORT = os.getenv("CHROMADB_PORT", "8000")

GHOST_ID = "01eed19e-9b86-43b4-b086-716cb01dae36"

def find_ghosts():
    print(f"Connecting to ChromaDB at {CHROMA_HOST}:{CHROMA_PORT}...")
    try:
        client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
        collections = client.list_collections()
        
        print(f"Found {len(collections)} total collections.")
        
        found_any = False
        for c_meta in collections:
            c_name = c_meta.name
            print(f"Checking collection: {c_name}...")
            try:
                coll = client.get_collection(c_name)
                # Check directly by ID
                result = coll.get(ids=[GHOST_ID])
                if result and result['ids']:
                    print(f"❌ FOUND GHOST in '{c_name}': {result['ids']}")
                    found_any = True
                    # AUTO DELETE
                    print(f"   Deleting from '{c_name}'...")
                    coll.delete(ids=[GHOST_ID])
                    # Also delete others if found here
                    others = [
                        "9742ee98-e1d2-484e-8ed4-8365e1e4208f",
                        "71644915-21fb-4ad5-91e4-fb6fd18171ed",
                        "dfd001ad-3bdb-4e3d-851b-a023f99a462c",
                        "43266ec9-3a7b-4127-9760-fa57498c6f78",
                        "a57fec0a-bfa7-44e9-afcb-d0d78f3fc9a0"
                    ]
                    coll.delete(ids=others)
                    print(f"   Deleted cluster of ghosts from '{c_name}'.")
                else:
                    print(f"   Clean.")
            except Exception as e:
                print(f"   Error checking {c_name}: {e}")
                
        if not found_any:
            print("✅ No ghosts found in ANY collection.")
            
    except Exception as e:
        print(f"❌ Error during scan: {e}")
        sys.exit(1)

if __name__ == "__main__":
    find_ghosts()
