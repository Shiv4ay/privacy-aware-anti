import chromadb
client = chromadb.HttpClient(host='chromadb', port=8000)
c = client.get_collection('privacy_documents_4')
r = c.get(where={'doc_id': 11723})
print(f"Found {len(r['ids'])} chunks for doc_id 11723")
if r['ids']:
    print(r['metadatas'][0])
