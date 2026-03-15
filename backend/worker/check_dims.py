import chromadb

def check_dims():
    try:
        client = chromadb.HttpClient(host='chromadb', port=8000)
        collections = client.list_collections()
        for col in collections:
            try:
                # Try a dummy query to see dimension requirement
                col.query(query_embeddings=[[0.0]*384], n_results=1)
                print(f"COLLECTION {col.name}: Supports 384-dim")
            except Exception as e:
                if "dimension" in str(e).lower():
                    print(f"COLLECTION {col.name}: FAILED 384-dim. Error: {e}")
                else:
                    print(f"COLLECTION {col.name}: Other Error: {e}")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    check_dims()
