import chromadb
client = chromadb.HttpClient(host='chromadb', port=8000)
try:
    client.delete_collection('privacy_documents_4')
    print('Collection privacy_documents_4 dropped successfully')
except Exception as e:
    print(f'Error: {e}')
