import requests

ollama_url = "http://localhost:11434"

# Test nomic-embed-text
for model in ["nomic-embed-text", "nomic-embed-text:latest"]:
    try:
        resp = requests.post(
            f"{ollama_url}/api/embeddings",
            json={"model": model, "input": "test"},
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            print(f"{model}: Response keys: {data.keys()}")
            print(f"  Full response: {data}")
            embedding = data.get("embedding", data.get("embeddings", []))
            if isinstance(embedding, list) and len(embedding) > 0 and isinstance(embedding[0], list):
                # embeddings is a list of embeddings
                embedding = embedding[0]
            print(f"  Embedding length: {len(embedding) if embedding else 0}")
            if embedding:
                print(f"  First 5 values: {embedding[:5]}")
            break
        else:
            print(f"{model}: Failed with status {resp.status_code}")
    except Exception as e:
        print(f"{model}: Error - {e}")
