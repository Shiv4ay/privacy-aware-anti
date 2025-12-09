"""
Interactive Query Example - Test ChromaDB Vector Search
Run this to try different vector search queries
"""
import chromadb

# Connect to ChromaDB
client = chromadb.HttpClient(host="localhost", port=8000)

# Get the students collection
collection = client.get_collection("university_students")

print("="*70)
print("INTERACTIVE CHROMADB QUERY EXAMPLE".center(70))
print("="*70)

# Example 1: Search for CS students
print("\n📌 Example 1: Search for CS students with high GPA")
print("-" * 70)
results = collection.query(
    query_texts=["Computer Science students with high GPA"],
    n_results=5,
    where={"department": "DEPT_CS"}
)

print(f"Found {len(results['documents'][0])} results:\n")
for i, (doc, metadata) in enumerate(zip(results['documents'][0], results['metadatas'][0]), 1):
    print(f"{i}. {doc[:100]}...")
    print(f"   📊 Metadata: {metadata}\n")

# Example 2: Get placements collection
print("\n" + "="*70)
print("📌 Example 2: Search for high salary placements")
print("-" * 70)
placements = client.get_collection("university_placements")
results = collection.query(
    query_texts=["high salary software engineering placements"],
    n_results=5
)

print(f"Found {len(results['documents'][0])} results:\n")
for i, (doc, metadata) in enumerate(zip(results['documents'][0], results['metadatas'][0]), 1):
    print(f"{i}. {doc[:100]}...")
    if 'salary' in metadata:
        print(f"   💰 Salary: ₹{metadata['salary']}")
    print(f"   📊 Metadata: {metadata}\n")

# Example 3: Metadata filtering
print("\n" + "="*70)
print("📌 Example 3: Filter by metadata (Active CS students)")
print("-" * 70)
results = collection.query(
    query_texts=["students"],
    n_results=3,
    where={
        "$and": [
            {"department": "DEPT_CS"},
            {"status": "Active"}
        ]
    }
)

print(f"Found {len(results['documents'][0])} active CS students:\n")
for i, (doc, metadata) in enumerate(zip(results['documents'][0], results['metadatas'][0]), 1):
    print(f"{i}. {doc[:100]}...")
    print(f"   📊 Department: {metadata.get('department')}")
    print(f"   📊 Status: {metadata.get('status')}")
    print(f"   📊 Year: {metadata.get('year')}\n")

# Example 4: Check collection stats
print("\n" + "="*70)
print("📊 COLLECTION STATISTICS".center(70))
print("="*70)

collections = ["university_students", "university_results", "university_placements", "university_internships"]
for name in collections:
    coll = client.get_collection(name)
    print(f"\n{name}:")
    print(f"  • Total documents: {coll.count()}")
    
    # Get a sample to show metadata schema
    if coll.count() > 0:
        sample = coll.peek(limit=1)
        if sample['metadatas']:
            print(f"  • Metadata keys: {list(sample['metadatas'][0].keys())}")

print("\n" + "="*70)
print("✅ ALL EXAMPLES COMPLETE".center(70))
print("="*70)
