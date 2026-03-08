import chromadb
import time

def backfill_access_levels():
    print("Connecting to ChromaDB at host 'localhost'...")
    try:
        client = chromadb.HttpClient(host="localhost", port=8000)
        collections = client.list_collections()
    except Exception as e:
        print(f"Failed to connect: {e}")
        return

    for coll_name in collections:
        print(f"\nProcessing collection: {coll_name.name}")
        collection = client.get_collection(coll_name.name)
        
        # Get all items
        results = collection.get(include=["metadatas"])
        
        if not results or not results.get("ids"):
            print("  Empty collection, skipping.")
            continue
            
        ids = results["ids"]
        metadatas = results["metadatas"]
        
        updates_ids = []
        updates_metadatas = []
        
        for i, doc_id in enumerate(ids):
            meta = metadatas[i] or {}
            
            # Skip if already has access_level
            if "access_level" in meta:
                continue
                
            filename = str(meta.get("filename", "")).lower()
            
            if "faculty" in filename:
                access_level = "faculty"
            elif "student" in filename or "alumni" in filename or "intern" in filename:
                access_level = "student"
            else:
                access_level = "general"
                
            meta["access_level"] = access_level
            updates_ids.append(doc_id)
            updates_metadatas.append(meta)
            
        if updates_ids:
            print(f"  Updating {len(updates_ids)} documents...")
            batch_size = 500
            for i in range(0, len(updates_ids), batch_size):
                batch_ids = updates_ids[i:i+batch_size]
                batch_metas = updates_metadatas[i:i+batch_size]
                collection.update(
                    ids=batch_ids,
                    metadatas=batch_metas
                )
            print("  Done.")
        else:
            print("  No updates needed (already have access_level).")

if __name__ == "__main__":
    backfill_access_levels()
