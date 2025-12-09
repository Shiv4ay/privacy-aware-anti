"""
Test Vector Search on University Collections
Verifies that data was ingested correctly and search works
"""
import chromadb
from chromadb.config import Settings

# Connect to ChromaDB
client = chromadb.HttpClient(host="localhost", port=8000)

# Collection names
COLLECTIONS = [
    "university_students",
    "university_results",
    "university_placements",
    "university_internships"
]

def print_collection_stats():
    """Print statistics for all collections"""
    print("\n" + "="*70)
    print("CHROMADB COLLECTION STATISTICS".center(70))
    print("="*70)
    
    for name in COLLECTIONS:
        try:
            collection = client.get_collection(name)
            count = collection.count()
            print(f"\n[INFO] Collection: {name}")
            print(f"  - Documents: {count}")
            
            # Get sample document
            if count > 0:
                sample = collection.peek(limit=1)
                if sample['documents']:
                    print(f"  - Sample: {sample['documents'][0][:100]}...")
        except Exception as e:
            print(f"[ERROR] {name}: {e}")
    
    print("\n" + "="*70 + "\n")

def test_student_search():
    """Test search on students collection"""
    print("\n" + "="*70)
    print("TEST: Student Search".center(70))
    print("="*70)
    
    try:
        collection = client.get_collection("university_students")
        
        # Search for CS students
        results = collection.query(
            query_texts=["Computer Science students with high GPA"],
            n_results=5,
            where={"department": "DEPT_CS"}
        )
        
        print(f"\n[OK] Found {len(results['documents'][0])} CS students")
        for i, doc in enumerate(results['documents'][0], 1):
            print(f"\n{i}. {doc[:150]}...")
            if results['metadatas'][0][i-1]:
                print(f"   Metadata: {results['metadatas'][0][i-1]}")
    except Exception as e:
        print(f"[ERROR] Student search failed: {e}")
    
    print("\n" + "="*70)

def test_results_search():
    """Test search on results collection"""
    print("\n" + "="*70)
    print("TEST: Results Search".center(70))
    print("="*70)
    
    try:
        collection = client.get_collection("university_results")
        
        # Search for good grades
        results = collection.query(
            query_texts=["excellent academic performance with A grade"],
            n_results=5
        )
        
        print(f"\n[OK] Found {len(results['documents'][0])} results")
        for i, doc in enumerate(results['documents'][0], 1):
            print(f"\n{i}. {doc[:120]}...")
    except Exception as e:
        print(f"[ERROR] Results search failed: {e}")
    
    print("\n" + "="*70)

def test_placement_search():
    """Test search on placements collection"""
    print("\n" + "="*70)
    print("TEST: Placement Search".center(70))
    print("="*70)
    
    try:
        collection = client.get_collection("university_placements")
        
        # Search for high salary placements
        results = collection.query(
            query_texts=["high salary software engineering placements"],
            n_results=5
        )
        
        print(f"\n[OK] Found {len(results['documents'][0])} placements")
        for i, doc in enumerate(results['documents'][0], 1):
            print(f"\n{i}. {doc[:120]}...")
            if results['metadatas'][0][i-1]:
                meta = results['metadatas'][0][i-1]
                print(f"   Salary: ₹{meta.get('salary', 'N/A')}")
    except Exception as e:
        print(f"[ERROR] Placement search failed: {e}")
    
    print("\n" + "="*70)

def test_metadata_filtering():
    """Test metadata filtering"""
    print("\n" + "="*70)
    print("TEST: Metadata Filtering".center(70))
    print("="*70)
    
    try:
        collection = client.get_collection("university_students")
        
        # Filter by department and status
        results = collection.query(
            query_texts=["students enrolled"],
            n_results=3,
            where={
                "$and": [
                    {"department": "DEPT_CS"},
                    {"status": "Active"}
                ]
            }
        )
        
        print(f"\n[OK] Found {len(results['documents'][0])} active CS students")
        for i, doc in enumerate(results['documents'][0], 1):
            print(f"\n{i}. {doc[:100]}...")
    except Exception as e:
        print(f"[ERROR] Metadata filtering failed: {e}")
    
    print("\n" + "="*70)

def main():
    """Run all tests"""
    print("\n" + "="*70)
    print("UNIVERSITY RAG SEARCH VERIFICATION".center(70))
    print("="*70)
    
    # Print stats
    print_collection_stats()
    
    # Run search tests
    test_student_search()
    test_results_search()
    test_placement_search()
    test_metadata_filtering()
    
    print("\n" + "="*70)
    print("VERIFICATION COMPLETE".center(70))
    print("="*70 + "\n")

if __name__ == "__main__":
    main()
