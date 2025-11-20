import chromadb
import requests

c = chromadb.HttpClient(host='chromadb', port=8000)
coll = c.get_collection('privacy_documents_university')

print('Testing query...')
r = requests.post('http://ollama:11434/api/embeddings', json={'model': 'nomic-embed-text', 'prompt': 'University'})
emb = r.json()['embedding']
print(f'Query embedding dimension: {len(emb)}')

results = coll.query(query_embeddings=[emb], n_results=5)
print(f'Results found: {len(results["ids"][0]) if results["ids"] else 0}')

if results["ids"] and len(results["ids"][0]) > 0:
    for doc_id, doc_text, distance in zip(results["ids"][0], results["documents"][0], results["distances"][0]):
        print(f'  - ID: {doc_id}, Distance: {distance:.4f}')
        print(f'    Text: {doc_text[:100]}')
else:
    print('No results returned!')
    print('Checking collection details...')
    print(f'Collection has {coll.count()} documents')
