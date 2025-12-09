"""
University Data Ingestion Service
Polls Dummy University API and creates vector embeddings in ChromaDB
"""
import os
import requests
import chromadb
from chromadb.config import Settings
from typing import List, Dict, Any
import time
from datetime import datetime

# Configuration
UNIVERSITY_API_URL = os.getenv("UNIVERSITY_API_URL", "http://localhost:8002/api/university")
CHROMA_HOST = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", "8000"))

# ChromaDB Client
chroma_client = chromadb.HttpClient(
    host=CHROMA_HOST,
    port=CHROMA_PORT
)

# Collection names
COLLECTIONS = {
    "students": "university_students",
    "results": "university_results",
    "placements": "university_placements",
    "internships": "university_internships"
}

def create_collections():
    """Create ChromaDB collections for university data"""
    print("\n" + "="*70)
    print("CREATING CHROMADB COLLECTIONS".center(70))
    print("="*70)
    
    for key, name in COLLECTIONS.items():
        try:
            # Try to get existing collection
            collection = chroma_client.get_collection(name)
            print(f"[OK] Collection '{name}' already exists ({collection.count()} docs)")
        except Exception:
            # Create new collection
            collection = chroma_client.create_collection(
                name=name,
                metadata={
                    "description": f"{key.title()} records from university ERP",
                    "source": "dummy-university-api",
                    "created_at": datetime.now().isoformat()
                }
            )
            print(f"[OK] Created collection '{name}'")
    
    print("="*70 + "\n")

def fetch_data(endpoint: str, max_records: int = 10000) -> List[Dict]:
    """Fetch data from Dummy University API with pagination"""
    all_data = []
    offset = 0
    batch_size = 1000  # API limit per request
    
    while len(all_data) < max_records:
        try:
            url = f"{UNIVERSITY_API_URL}/{endpoint}?limit={batch_size}&offset={offset}"
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            data = response.json()
            
            # Extract the actual data array
            batch_data = []
            if isinstance(data, dict):
                # Look for the data key
                for key in [endpoint, f"{endpoint[:-1]}", 'data', 'items']:
                    if key in data:
                        batch_data = data[key]
                        break
                # If not found, look for any list in the response
                if not batch_data and 'total' in data:
                    for k, v in data.items():
                        if isinstance(v, list):
                            batch_data = v
                            break
            elif isinstance(data, list):
                batch_data = data
            
            if not batch_data:
                break  # No more data
            
            all_data.extend(batch_data)
            
            # If we got less than batch_size, we've reached the end
            if len(batch_data) < batch_size:
                break
            
            offset += batch_size
            print(f"[INFO] Fetched {len(all_data)} {endpoint}...")
            
        except Exception as e:
            print(f"[ERROR] Failed to fetch {endpoint} at offset {offset}: {e}")
            break
    
    return all_data[:max_records]

def transform_student(student: Dict) -> str:
    """Transform student record to searchable text"""
    return (
        f"Student {student.get('student_id', 'N/A')}: "
        f"{student.get('first_name', '')} {student.get('last_name', '')}, "
        f"Department: {student.get('department_id', 'N/A')}, "
        f"Year: {student.get('current_year', 'N/A')}, "
        f"GPA: {student.get('gpa', 'N/A')}, "
        f"Status: {student.get('status', 'N/A')}, "
        f"Email: {student.get('email', 'N/A')}"
    )

def transform_result(result: Dict) -> str:
    """Transform result record to searchable text"""
    return (
        f"Academic Result {result.get('result_id', 'N/A')} for "
        f"Student {result.get('student_id', 'N/A')} in "
        f"Course {result.get('course_id', 'N/A')}: "
        f"Grade {result.get('grade', 'N/A')}, "
        f"Score {result.get('score', 'N/A')}, "
        f"Semester {result.get('semester', 'N/A')}, "
        f"{result.get('remarks', '')}"
    )

def transform_placement(placement: Dict) -> str:
    """Transform placement record to searchable text"""
    return (
        f"Placement {placement.get('placement_id', 'N/A')}: "
        f"Student {placement.get('student_id', 'N/A')} placed at "
        f"Company {placement.get('company_id', 'N/A')} as "
        f"{placement.get('position', 'N/A')}, "
        f"Salary: {placement.get('salary', 'N/A')}, "
        f"Location: {placement.get('location', 'N/A')}, "
        f"Status: {placement.get('status', 'N/A')}"
    )

def transform_internship(internship: Dict) -> str:
    """Transform internship record to searchable text"""
    return (
        f"Internship {internship.get('internship_id', 'N/A')}: "
        f"Student {internship.get('student_id', 'N/A')} at "
        f"Company {internship.get('company_id', 'N/A')} as "
        f"{internship.get('position', 'N/A')}, "
        f"Duration: {internship.get('start_date', 'N/A')} to {internship.get('end_date', 'N/A')}, "
        f"Stipend: {internship.get('stipend', 'N/A')}, "
        f"Status: {internship.get('status', 'N/A')}"
    )

def ingest_students():
    """Ingest student records"""
    print("\n[INFO] Ingesting students...")
    students = fetch_data("students")
    
    if not students:
        print("[WARNING] No students fetched")
        return
    
    collection = chroma_client.get_collection(COLLECTIONS["students"])
    
    # Prepare documents
    documents = []
    metadatas = []
    ids = []
    
    for student in students:
        doc = transform_student(student)
        documents.append(doc)
        
        metadata = {
            "record_type": "student",
            "department": student.get("department_id", "UNKNOWN"),
            "year": int(student.get("current_year", 0)),
            "semester": int(student.get("current_semester", 0)),
            "source_id": student.get("student_id", ""),
            "status": student.get("status", ""),
            "ingestion_date": datetime.now().isoformat()
        }
        metadatas.append(metadata)
        ids.append(f"student_{student.get('student_id', len(ids))}")
    
    # Batch insert
    batch_size = 100
    for i in range(0, len(documents), batch_size):
        batch_docs = documents[i:i+batch_size]
        batch_metas = metadatas[i:i+batch_size]
        batch_ids = ids[i:i+batch_size]
        
        collection.add(
            documents=batch_docs,
            metadatas=batch_metas,
            ids=batch_ids
        )
    
    print(f"[OK] Ingested {len(documents)} students")

def ingest_results():
    """Ingest result records"""
    print("\n[INFO] Ingesting results...")
    results = fetch_data("results", max_records=10000)  # Fetch all results with pagination
    
    if not results:
        print("[WARNING] No results fetched")
        return
    
    collection = chroma_client.get_collection(COLLECTIONS["results"])
    
    documents = []
    metadatas = []
    ids = []
    
    for result in results:
        doc = transform_result(result)
        documents.append(doc)
        
        metadata = {
            "record_type": "result",
            "student_id": result.get("student_id", ""),
            "course_id": result.get("course_id", ""),
            "semester": int(result.get("semester", 0)),
            "grade": result.get("grade", ""),
            "source_id": result.get("result_id", ""),
            "ingestion_date": datetime.now().isoformat()
        }
        metadatas.append(metadata)
        ids.append(f"result_{result.get('result_id', len(ids))}")
    
    # Batch insert
    batch_size = 100
    for i in range(0, len(documents), batch_size):
        batch_docs = documents[i:i+batch_size]
        batch_metas = metadatas[i:i+batch_size]
        batch_ids = ids[i:i+batch_size]
        
        collection.add(
            documents=batch_docs,
            metadatas=batch_metas,
            ids=batch_ids
        )
        
        if (i // batch_size + 1) % 10 == 0:
            print(f"[INFO] Processed {i + batch_size} results...")
    
    print(f"[OK] Ingested {len(documents)} results")

def ingest_placements():
    """Ingest placement records"""
    print("\n[INFO] Ingesting placements...")
    placements = fetch_data("placements")
    
    if not placements:
        print("[WARNING] No placements fetched")
        return
    
    collection = chroma_client.get_collection(COLLECTIONS["placements"])
    
    documents = []
    metadatas = []
    ids = []
    
    for placement in placements:
        doc = transform_placement(placement)
        documents.append(doc)
        
        metadata = {
            "record_type": "placement",
            "student_id": placement.get("student_id", ""),
            "company_id": placement.get("company_id", ""),
            "status": placement.get("status", ""),
            "salary": float(placement.get("salary", 0)),
            "source_id": placement.get("placement_id", ""),
            "ingestion_date": datetime.now().isoformat()
        }
        metadatas.append(metadata)
        ids.append(f"placement_{placement.get('placement_id', len(ids))}")
    
    # Batch insert
    collection.add(
        documents=documents,
        metadatas=metadatas,
        ids=ids
    )
    
    print(f"[OK] Ingested {len(documents)} placements")

def ingest_internships():
    """Ingest internship records"""
    print("\n[INFO] Ingesting internships...")
    internships = fetch_data("internships")
    
    if not internships:
        print("[WARNING] No internships fetched")
        return
    
    collection = chroma_client.get_collection(COLLECTIONS["internships"])
    
    documents = []
    metadatas = []
    ids = []
    
    for internship in internships:
        doc = transform_internship(internship)
        documents.append(doc)
        
        metadata = {
            "record_type": "internship",
            "student_id": internship.get("student_id", ""),
            "company_id": internship.get("company_id", ""),
            "status": internship.get("status", ""),
            "stipend": float(internship.get("stipend", 0)),
            "source_id": internship.get("internship_id", ""),
            "ingestion_date": datetime.now().isoformat()
        }
        metadatas.append(metadata)
        ids.append(f"internship_{internship.get('internship_id', len(ids))}")
    
    # Batch insert
    collection.add(
        documents=documents,
        metadatas=metadatas,
        ids=ids
    )
    
    print(f"[OK] Ingested {len(documents)} internships")

def print_statistics():
    """Print collection statistics"""
    print("\n" + "="*70)
    print("INGESTION STATISTICS".center(70))
    print("="*70)
    
    for key, name in COLLECTIONS.items():
        try:
            collection = chroma_client.get_collection(name)
            count = collection.count()
            print(f"[INFO] {name}: {count} documents")
        except Exception as e:
            print(f"[ERROR] {name}: {e}")
    
    print("="*70 + "\n")

def main():
    """Main ingestion process"""
    print("\n" + "="*70)
    print("UNIVERSITY DATA INGESTION SERVICE".center(70))
    print("="*70)
    print(f"API: {UNIVERSITY_API_URL}")
    print(f"ChromaDB: {CHROMA_HOST}:{CHROMA_PORT}")
    print("="*70)
    
    # Create collections
    create_collections()
    
    # Ingest data
    try:
        ingest_students()
        ingest_results()
        ingest_placements()
        ingest_internships()
    except Exception as e:
        print(f"\n[ERROR] Ingestion failed: {e}")
        import traceback
        traceback.print_exc()
    
    # Print statistics
    print_statistics()
    
    print("="*70)
    print("INGESTION COMPLETE".center(70))
    print("="*70)

if __name__ == "__main__":
    main()
