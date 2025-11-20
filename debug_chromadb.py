#!/usr/bin/env python3
import chromadb
import requests
import json

# Connect to ChromaDB
client = chromadb.HttpClient(host='localhost', port=8000)

# Get the University collection
coll = client.get_collection('privacy_documents_university')

print(f"Collection: privacy_documents_university")
print(f"Document count: {coll.count()}")

# Get all documents to inspect
results = coll.get(limit=10, include=['documents', 'metadatas', 'embeddings'])

print(f"\nDocuments in collection:")
for i, (doc_id, doc_text, metadata, embedding) in enumerate(zip(
    results['ids'],
    results['documents'],
    results['metadatas'],
    results['embeddings']
)):
    print(f"\n--- Document {i+1} ---")
    print(f"ID: {doc_id}")
    print(f"Text: {doc_text[:200]}...")
    print(f"Metadata: {metadata}")
    print(f"Embedding dimension: {len(embedding) if embedding else 'None'}")
    if embedding:
        print(f"First 5 values: {embedding[:5]}")

# Test embedding generation via Ollama
print("\n\n=== Testing Ollama Embedding Generation ===")
try:
    test_text = "University"
    response = requests.post(
        'http://localhost:11434/api/embeddings',
        json={'model': 'nomic-embed-text', 'prompt': test_text},
        timeout=10
    )
    if response.status_code == 200:
        data = response.json()
        if 'embedding' in data:
            test_embedding = data['embedding']
            print(f"✓ Ollama embedding generated successfully")
            print(f"  Dimension: {len(test_embedding)}")
            print(f"  First 5 values: {test_embedding[:5]}")
            
            # Try querying with this embedding
            print(f"\n=== Testing ChromaDB Query ===")
            query_results = coll.query(
                query_embeddings=[test_embedding],
                n_results=3
            )
            print(f"Query returned {len(query_results['ids'][0]) if query_results['ids'] else 0} results")
            if query_results['ids'] and len(query_results['ids'][0]) > 0:
                for doc_id, doc_text, distance in zip(
                    query_results['ids'][0],
                    query_results['documents'][0],
                    query_results['distances'][0]
                ):
                    print(f"  - ID: {doc_id}, Distance: {distance:.4f}")
                    print(f"    Text: {doc_text[:100]}...")
        else:
            print(f"✗ No embedding in response: {data}")
    else:
        print(f"✗ Ollama request failed: {response.status_code}")
except Exception as e:
    print(f"✗ Error: {e}")
