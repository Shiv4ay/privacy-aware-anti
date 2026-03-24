"""
PES MCA Dataset Re-Ingestion Script for Org 4
----------------------------------------------
Wipes the old (incorrect) ChromaDB collection and Postgres documents for Org 4,
then uploads the correct pes_mca_dataset CSV files and triggers re-processing.

Usage:
    python reindex_pes_mca.py

Prerequisites:
    - Docker stack running (postgres, chromadb, worker, api)
    - JWT token from an admin user of Org 4
      (Login at http://localhost:3000 → DevTools → Local Storage → accessToken)
"""
import os
import sys
import time
import requests
import psycopg2
import chromadb
from pathlib import Path

# ------- Configuration -------------------------------------------------------
API_BASE      = os.getenv("API_BASE",      "http://localhost:3001/api")
WORKER_URL    = os.getenv("WORKER_URL",    "http://localhost:8001")
CHROMADB_HOST = os.getenv("CHROMADB_HOST", "localhost")
CHROMADB_PORT = int(os.getenv("CHROMADB_PORT", "8000"))
DATABASE_URL  = os.getenv("DATABASE_URL",  "postgresql://postgres:postgres123@localhost:5432/privacy_docs")
ORG_ID        = 4
DATASET_PATH  = Path("C:/project3/AntiGravity/Datasets/University/pes_mca_dataset")

# Upload order matters: companies/departments/courses before students/results
CSV_FILES = [
    ("companies",    "companies.csv"),
    ("departments",  "departments.csv"),
    ("courses",      "courses.csv"),
    ("students",     "students.csv"),
    ("faculty",      "faculty.csv"),
    ("results",      "results.csv"),
    ("placements",   "placements.csv"),
    ("internships",  "internships.csv"),
    ("alumni",       "alumni.csv"),
]

# ------- Helpers -------------------------------------------------------------
class C:
    GREEN  = '\033[92m'
    YELLOW = '\033[93m'
    RED    = '\033[91m'
    BLUE   = '\033[94m'
    END    = '\033[0m'

def ok(msg):  print(f"  {C.GREEN}✅{C.END} {msg}")
def err(msg): print(f"  {C.RED}❌{C.END} {msg}")
def info(msg):print(f"  {C.BLUE}ℹ{C.END}  {msg}")
def warn(msg):print(f"  {C.YELLOW}⚠{C.END}  {msg}")

# ------- Steps ---------------------------------------------------------------

def step1_delete_chromadb():
    print(f"\n[1/4] Deleting ChromaDB collection for Org {ORG_ID}...")
    try:
        client = chromadb.HttpClient(host=CHROMADB_HOST, port=CHROMADB_PORT)
        name = f"privacy_documents_{ORG_ID}"
        try:
            client.delete_collection(name=name)
            ok(f"Deleted ChromaDB collection '{name}'")
        except Exception as e:
            if "does not exist" in str(e).lower() or "not found" in str(e).lower():
                warn(f"Collection '{name}' did not exist — already clean")
            else:
                raise
    except Exception as e:
        err(f"ChromaDB error: {e}")
        sys.exit(1)


def step2_delete_postgres_documents():
    print(f"\n[2/4] Deleting existing Postgres documents for Org {ORG_ID}...")
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute("DELETE FROM documents WHERE org_id = %s", (ORG_ID,))
        count = cur.rowcount
        conn.commit()
        cur.close()
        conn.close()
        ok(f"Deleted {count} document records from Postgres")
    except Exception as e:
        err(f"Postgres error: {e}")
        sys.exit(1)


def step3_upload_csvs(token: str):
    print(f"\n[3/4] Uploading {len(CSV_FILES)} CSV files from '{DATASET_PATH}'...")
    headers = {"Authorization": f"Bearer {token}"}
    uploaded = 0

    for record_type, filename in CSV_FILES:
        file_path = DATASET_PATH / filename
        if not file_path.exists():
            warn(f"Skipping {filename} — file not found")
            continue

        size_mb = file_path.stat().st_size / (1024 * 1024)
        info(f"Uploading {filename} ({size_mb:.2f} MB)...")

        try:
            with open(file_path, "rb") as f:
                resp = requests.post(
                    f"{API_BASE}/documents/upload",
                    files={"file": (file_path.name, f, "text/csv")},
                    data={
                        "organization_id": ORG_ID,
                        "record_type": record_type,
                        "source_name": f"pes_mca_{record_type}",
                    },
                    headers=headers,
                    timeout=300,
                )

            if resp.status_code in (200, 201):
                result = resp.json()
                doc_count = len(result.get("documents", [result])) if isinstance(result, dict) else 1
                ok(f"{filename} → {doc_count} document(s) created")
                uploaded += 1
            else:
                err(f"{filename} → HTTP {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            err(f"{filename} → {e}")

        time.sleep(0.5)  # brief pause between uploads

    print(f"\n  Uploaded {uploaded}/{len(CSV_FILES)} files.")
    if uploaded == 0:
        err("No files uploaded — aborting re-index.")
        sys.exit(1)


def step4_reindex():
    print(f"\n[4/4] Triggering batch re-processing for Org {ORG_ID}...")
    try:
        resp = requests.post(
            f"{WORKER_URL}/process-batch?org_id={ORG_ID}&batch_size=500",
            timeout=600,
        )
        if resp.status_code == 200:
            data = resp.json()
            ok(f"Re-indexing complete!")
            info(f"Processed : {data.get('processed', 0)}")
            info(f"Failed    : {data.get('failed', 0)}")
            info(f"Remaining : {data.get('remaining', 0)}")
        else:
            err(f"Worker returned HTTP {resp.status_code}: {resp.text[:200]}")
            warn("Documents are uploaded. Run re-processing manually later.")
    except Exception as e:
        err(f"Worker error: {e}")
        warn("Documents are uploaded. Trigger /process-batch manually when worker is ready.")


# ------- Main ----------------------------------------------------------------

def main():
    print("\n" + "=" * 65)
    print("  PES MCA DATASET RE-INGESTION — Org 4".center(65))
    print("=" * 65)
    print(f"  Dataset : {DATASET_PATH}")
    print(f"  API     : {API_BASE}")
    print(f"  Worker  : {WORKER_URL}")
    print("=" * 65)

    # Verify dataset path
    if not DATASET_PATH.exists():
        err(f"Dataset path not found: {DATASET_PATH}")
        sys.exit(1)

    # Get JWT token
    print(f"\n{C.YELLOW}You need a JWT token from an admin account of Org 4.{C.END}")
    print("  1. Open http://localhost:3000/login")
    print("  2. Log in as sibasundar2102@gmail.com (or any Org 4 admin)")
    print("  3. Open DevTools → Application → Local Storage → accessToken")
    print()
    token = input(f"{C.BLUE}Paste your JWT token:{C.END} ").strip()
    if not token:
        err("Token is required")
        sys.exit(1)

    print()
    step1_delete_chromadb()
    step2_delete_postgres_documents()
    step3_upload_csvs(token)
    step4_reindex()

    print(f"\n{'=' * 65}")
    print(f"  RE-INGESTION COMPLETE".center(65))
    print(f"{'=' * 65}")
    print(f"\n{C.GREEN}Verification queries to run:{C.END}")
    print("  → 'pes1pg24ca169 give details'")
    print("     First Name: Siba Sundar | Last Name: Guntha | DOB: 2001-08-15")
    print("  → 'pes1pg24ca001 give details'")
    print("     First Name: Gayatri | Last Name: Reddy")
    print()


if __name__ == "__main__":
    main()