"""
Seed analytics tables (placements, internships, companies) from dataset CSVs.

Run this ONCE after a fresh docker compose up (e.g., after volume wipe).
Safe to re-run — uses UPSERT, so no duplicate rows.

Usage:
  python backend/scripts/seed_analytics.py

The script auto-detects DATABASE_URL from the .env file or environment.
"""
import os
import sys

# ── Resolve paths ─────────────────────────────────────────────────────────────
REPO_ROOT  = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
WORKER_DIR = os.path.join(REPO_ROOT, "backend", "worker")
ENV_FILE   = os.path.join(REPO_ROOT, ".env")

# Datasets may live inside the project or one level up (sibling of PRIVACY-AWARE-RAG-GUIDE-CUR)
_csv_candidates = [
    os.path.join(REPO_ROOT, "Datasets", "University", "pes_mca_dataset"),
    os.path.join(REPO_ROOT, "..", "Datasets", "University", "pes_mca_dataset"),
]
CSV_BASE = next((p for p in _csv_candidates if os.path.isdir(p)), _csv_candidates[0])
PLACEMENTS_CSV  = os.path.join(CSV_BASE, "placements.csv")
INTERNSHIPS_CSV = os.path.join(CSV_BASE, "internships.csv")
COMPANIES_CSV   = os.path.join(CSV_BASE, "companies.csv")

sys.path.insert(0, WORKER_DIR)

# ── Load .env ─────────────────────────────────────────────────────────────────
if os.path.exists(ENV_FILE):
    with open(ENV_FILE, encoding="utf-8-sig") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())

# ── Resolve DB URL ────────────────────────────────────────────────────────────
DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    # Compose from individual vars if DATABASE_URL not set
    user = os.getenv("POSTGRES_USER", "postgres")
    pwd  = os.getenv("POSTGRES_PASSWORD", "postgres123")
    db   = os.getenv("POSTGRES_DB", "privacy_docs")
    DB_URL = f"postgresql://{user}:{pwd}@localhost:5432/{db}"

# Replace docker-internal hostname with localhost for host-side execution
DB_URL = DB_URL.replace("@postgres:", "@localhost:")

ORG_ID = int(os.getenv("SEED_ORG_ID", "4"))


def main():
    import psycopg2
    from ingestion.sql_ingestor import ingest_to_sql

    print(f"Seeding analytics tables → {DB_URL[:50]}... (org_id={ORG_ID})")

    # ── Verify CSVs exist ─────────────────────────────────────────────────────
    for path, label in [
        (PLACEMENTS_CSV,  "placements.csv"),
        (INTERNSHIPS_CSV, "internships.csv"),
        (COMPANIES_CSV,   "companies.csv"),
    ]:
        if not os.path.exists(path):
            print(f"  [SKIP] {label} not found at {path}")
            return

    conn = psycopg2.connect(DB_URL)
    cur  = conn.cursor()

    # ── Check if already seeded ───────────────────────────────────────────────
    cur.execute("SELECT COUNT(*) FROM placements WHERE org_id = %s", (ORG_ID,))
    existing_plc = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM internships WHERE org_id = %s", (ORG_ID,))
    existing_int = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM companies WHERE org_id = %s", (ORG_ID,))
    existing_cmp = cur.fetchone()[0]

    if existing_plc > 0 and existing_int > 0 and existing_cmp > 0:
        print(f"  [OK] Already seeded: {existing_plc} placements, {existing_int} internships, {existing_cmp} companies for org_id={ORG_ID}")
        print("  Run with FORCE=1 to re-seed anyway.")
        if os.getenv("FORCE") != "1":
            conn.close()
            return

    # ── Ingest ────────────────────────────────────────────────────────────────
    n1 = ingest_to_sql(PLACEMENTS_CSV,  "placements.csv",  ORG_ID, cur)
    n2 = ingest_to_sql(INTERNSHIPS_CSV, "internships.csv", ORG_ID, cur)
    n3 = ingest_to_sql(COMPANIES_CSV,   "companies.csv",   ORG_ID, cur)
    conn.commit()

    # ── Verify ────────────────────────────────────────────────────────────────
    cur.execute("SELECT COUNT(*), MAX(salary), AVG(salary) FROM placements WHERE org_id=%s", (ORG_ID,))
    r1 = cur.fetchone()
    cur.execute("SELECT COUNT(*), MAX(stipend), AVG(stipend) FROM internships WHERE org_id=%s", (ORG_ID,))
    r2 = cur.fetchone()
    cur.execute("SELECT COUNT(*) FROM companies WHERE org_id=%s", (ORG_ID,))
    r3 = cur.fetchone()
    cur.close()
    conn.close()

    print(f"  [DONE] Placements : {n1} upserted → {r1[0]} in DB  (max salary: {r1[1]}, avg: {round(float(r1[2]),0) if r1[2] else 0})")
    print(f"  [DONE] Internships: {n2} upserted → {r2[0]} in DB  (max stipend: {r2[1]}, avg: {round(float(r2[2]),0) if r2[2] else 0})")
    print(f"  [DONE] Companies  : {n3} upserted → {r3[0]} in DB")
    print("\nAnalytics tables ready. NL2SQL pipeline is live.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"  [ERROR] {e}")
        sys.exit(1)
