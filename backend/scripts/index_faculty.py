"""
Index faculty.csv into ChromaDB so that admin queries like
"Who are the faculty members?" return real data.

Each faculty member becomes one chunk with source_id = faculty_id,
mirroring how companies.csv is stored (access_level='general').

Usage:
  python backend/scripts/index_faculty.py
"""
import csv
import os
import sys
import uuid

# ── Paths ──────────────────────────────────────────────────────────────────────
REPO_ROOT   = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ENV_FILE    = os.path.join(REPO_ROOT, ".env")
FACULTY_CSV = os.path.join(REPO_ROOT, "..", "Datasets", "University",
                           "pes_mca_dataset", "faculty.csv")
if not os.path.exists(FACULTY_CSV):
    FACULTY_CSV = os.path.join(REPO_ROOT, "Datasets", "University",
                               "pes_mca_dataset", "faculty.csv")

# ── Load .env ──────────────────────────────────────────────────────────────────
if os.path.exists(ENV_FILE):
    with open(ENV_FILE, encoding="utf-8-sig") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())

DB_URL      = (os.getenv("DATABASE_URL") or "postgresql://postgres:postgres123@postgres:5432/privacy_docs")
DB_URL      = DB_URL.replace("@postgres:", "@localhost:")
OLLAMA_URL  = (os.getenv("OLLAMA_BASE_URL") or "http://localhost:11434").replace("//ollama:", "//localhost:")
CHROMA_HOST = "localhost"
CHROMA_PORT = 8000
ORG_ID      = int(os.getenv("SEED_ORG_ID", "4"))
COLLECTION  = f"privacy_documents_{ORG_ID}"


def embed(text: str) -> list:
    import requests
    r = requests.post(
        f"{OLLAMA_URL}/api/embeddings",
        json={"model": "nomic-embed-text", "prompt": text},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["embedding"]


def format_chunk(row: dict) -> str:
    """Format one faculty row as a readable text chunk."""
    head = "Y" if str(row.get("is_department_head", "")).strip().lower() in ("true", "1", "yes") else "N"
    return (
        f"FACULTY RECORD:\n"
        f"  Faculty Id: {row.get('faculty_id','').strip()}\n"
        f"  First Name: {row.get('first_name','').strip()}\n"
        f"  Last Name: {row.get('last_name','').strip()}\n"
        f"  Email: {row.get('email','').strip()}\n"
        f"  Department: {row.get('department_id','').strip()}\n"
        f"  Designation: {row.get('designation','').strip()}\n"
        f"  Specialization: {row.get('specialization','').strip()}\n"
        f"  Phone: {row.get('phone','').strip()}\n"
        f"  Office: {row.get('office_location','').strip()}\n"
        f"  Join Date: {row.get('join_date','').strip()}\n"
        f"  Department Head: {head}\n"
        f"  Qualification: {row.get('qualification','').strip()}\n"
        f"  Experience Years: {row.get('experience_years','').strip()}\n"
    )


def main():
    import psycopg2
    import chromadb

    if not os.path.exists(FACULTY_CSV):
        print(f"[ERROR] faculty.csv not found at {FACULTY_CSV}")
        sys.exit(1)

    print(f"Indexing faculty.csv → ChromaDB collection '{COLLECTION}' (org_id={ORG_ID})")

    # ── Read CSV ───────────────────────────────────────────────────────────────
    rows = []
    with open(FACULTY_CSV, encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        reader.fieldnames = [h.strip() for h in (reader.fieldnames or [])]
        for row in reader:
            rows.append({k.strip(): (v.strip() if v else "") for k, v in row.items() if k is not None})
    print(f"  Read {len(rows)} faculty records")

    # ── Check already indexed ─────────────────────────────────────────────────
    client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
    col    = client.get_or_create_collection(COLLECTION)
    existing = col.get(where={"filename": "faculty.csv"}, include=[])
    if existing["ids"] and os.getenv("FORCE") != "1":
        print(f"  [OK] Already indexed: {len(existing['ids'])} faculty chunks. Run with FORCE=1 to re-index.")
        return

    # ── Get or create Postgres doc record ─────────────────────────────────────
    conn = psycopg2.connect(DB_URL)
    cur  = conn.cursor()
    cur.execute(
        "SELECT id FROM documents WHERE filename='faculty.csv' AND org_id=%s LIMIT 1",
        (ORG_ID,)
    )
    row_doc = cur.fetchone()
    if row_doc:
        doc_id = row_doc[0]
        print(f"  Using existing postgres doc_id={doc_id}")
    else:
        cur.execute(
            """INSERT INTO documents
               (file_key, filename, status, org_id, content_type, mime_type,
                file_size, uploaded_by, sensitivity)
               VALUES (%s, %s, 'processed', %s, 'csv', 'text/csv', %s, 1, 'internal')
               RETURNING id""",
            (f"faculty_{ORG_ID}_{uuid.uuid4().hex[:8]}.csv", "faculty.csv", ORG_ID, 0)
        )
        doc_id = cur.fetchone()[0]
        conn.commit()
        print(f"  Created postgres doc_id={doc_id}")
    cur.close()
    conn.close()

    # ── Embed and upsert into ChromaDB ────────────────────────────────────────
    ids, embeddings, documents, metadatas = [], [], [], []

    for i, row in enumerate(rows):
        fac_id = row.get("faculty_id", f"FAC_{i}")
        text   = format_chunk(row)
        vec    = embed(text)

        chunk_id = f"faculty_{ORG_ID}_{fac_id}_0"
        ids.append(chunk_id)
        embeddings.append(vec)
        documents.append(text)
        metadatas.append({
            "org_id":       ORG_ID,
            "source_id":    fac_id,
            "doc_id":       doc_id,
            "filename":     "faculty.csv",
            "access_level": "general",
            "chunk_index":  0,
        })
        print(f"  Embedded {fac_id} ({row.get('first_name','')} {row.get('last_name','')})")

    # Upsert in one batch
    try:
        col.upsert(ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas)
    except Exception as chroma_err:
        print(f"[ERROR] ChromaDB upsert failed: {chroma_err}")
        print("  Postgres doc record was committed. Re-run with FORCE=1 after fixing ChromaDB.")
        raise
    print(f"\n  [DONE] {len(ids)} faculty chunks indexed into '{COLLECTION}'")
    print("  Admin can now query: 'Who are the faculty members?'")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback; traceback.print_exc()
        sys.exit(1)
