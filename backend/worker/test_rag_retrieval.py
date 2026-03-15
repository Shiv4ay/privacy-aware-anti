import chromadb
import os

client = chromadb.HttpClient(host='chromadb', port=8000)
org_id = 4
collection_name = f"privacy_documents_{org_id}"
student_id = "PES1PG24CA169"

print(f"Testing RAG retrieval for {student_id} in Org {org_id}...")

try:
    collection = client.get_collection(name=collection_name)
    
    # Simulate a vector search query
    # In a real RAG, the query string is embedded. 
    # Here we just check if searching for the ID yields the demographic chunks.
    results = collection.query(
        query_texts=[f"Details for student {student_id}"],
        n_results=10,
        where={"filename": "students.csv"}
    )
    
    print(f"\nFound {len(results['ids'][0])} results from students.csv")
    for i in range(len(results['ids'][0])):
        print(f"\n--- Result {i} ---")
        print(f"ID: {results['ids'][0][i]}")
        print(f"Metadata: {results['metadatas'][0][i]}")
        print(f"Document snippet: {results['documents'][0][i][:300]}...")

    # Also check if searching for "Gender" or "Home State" works
    results_facts = collection.query(
        query_texts=[f"What is the gender and home state of {student_id}?"],
        n_results=5
    )
    
    print(f"\nGlobal search results for facts about {student_id}:")
    for i in range(len(results_facts['ids'][0])):
        fname = results_facts['metadatas'][0][i].get('filename')
        print(f" - [{fname}] {results_facts['documents'][0][i][:100]}...")

except Exception as e:
    print(f"Error: {e}")
