# University RAG Ingestion Service

Ingestion pipeline that converts Dummy University API data into vector embeddings in ChromaDB.

## 🚀 Quick Start

```bash
cd C:\project3\AntiGravity\PRIVACY-AWARE-RAG-GUIDE-CUR\university-ingestion

# Install dependencies
pip install -r requirements.txt

# Run ingestion
python ingest.py

# Test vector search
python test_search.py
```

## 📊 Collections Created

| Collection | Documents | Source API |
|------------|-----------|-----------|
| `university_students` | ~1,000 | `/api/university/students` |
| `university_results` | ~9,000 | `/api/university/results` |
| `university_placements` | ~148 | `/api/university/placements` |
| `university_internships` | ~300 | `/api/university/internships` |

**Total**: ~10,500 vectorized documents

## 🔍 Vector Search Examples

```python
# Search for CS students
results = collection.query(
    query_texts=["Computer Science students with high GPA"],
    n_results=5,
    where={"department": "DEPT_CS"}
)

# Search for placements
results = collection.query(
    query_texts=["high salary software engineering placements"],
    n_results=5
)
```

## 📝 Metadata Schema

Each document includes:
```python
{
    "record_type": "student|result|placement|internship",
    "department": "DEPT_CS|DEPT_IT|...",
    "semester": 1-8,
    "year": 2020-2024,
    "source_id": "<original_record_id>",
    "ingestion_date": "2024-12-09"
}
```

## 🔧 Configuration

Current configuration in `ingest.py`:
```python
UNIVERSITY_API_URL = "http://localhost:8002/api/university"  # ✅ Correct
CHROMA_HOST = "localhost"                                    # ✅ Correct
CHROMA_PORT = 8000                                          # ✅ Correct
```

## ✅ Verification

### Run Full Test Suite
```bash
python test_search.py
```

Expected output:
- ✅ Collection statistics (1000 students, 9000 results, 148 placements, 300 internships)
- ✅ Vector search results with semantic matching
- ✅ Metadata filtering tests (by department, status, etc.)

### Run Interactive Examples
```bash
python query_examples.py
```

Shows:
- Semantic search examples
- Metadata filtering
- Collection statistics
- Sample metadata schemas

---

**Status**: ✅ **Operational & Verified**
- **ChromaDB**: `localhost:8000` (confirmed working)
- **Dummy University API**: `http://localhost:8002` (serving 415K+ records)
- **Total Vectors**: 10,448 documents indexed
- **Last Verified**: 2025-12-09 01:09 IST

