"""
Create PostgreSQL user accounts for all 350 MCA students.

Email   : institutional email from students.csv (e.g. gayatri.pes1pg24ca001@pesu.edu.in)
Password: student SRN (e.g. PES1PG24CA001) — bcrypt hashed
Role    : student, org_id=4, entity_id=SRN

Idempotent — skips existing accounts.

Usage (from repo root):
    python backend/scripts/create_student_accounts.py

Requires: bcrypt, and Docker running (uses docker exec for DB access).
"""

import csv
import os
import subprocess
import sys

import bcrypt

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT   = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))

_csv_candidates = [
    os.path.join(REPO_ROOT, "Datasets", "University", "pes_mca_dataset"),
    os.path.join(REPO_ROOT, "..", "Datasets", "University", "pes_mca_dataset"),
]
CSV_BASE = next((p for p in _csv_candidates if os.path.isdir(p)), None)

if CSV_BASE is None:
    print("[ERROR] Could not find pes_mca_dataset directory.", file=sys.stderr)
    print("  Looked in:", file=sys.stderr)
    for p in _csv_candidates:
        print(f"    {p}", file=sys.stderr)
    sys.exit(1)

STUDENTS_CSV = os.path.join(CSV_BASE, "students.csv")

ORG_ID = 4
DOCKER_POSTGRES = "privacy-aware-postgres"
DB_USER = "postgres"
DB_NAME = "privacy_docs"


# ── Helpers ───────────────────────────────────────────────────────────────────

def psql(sql: str) -> str:
    """Run a SQL statement inside the PostgreSQL container and return stdout."""
    result = subprocess.run(
        ["docker", "exec", DOCKER_POSTGRES, "psql", "-U", DB_USER, DB_NAME,
         "-t", "-A", "-c", sql],
        capture_output=True, text=True, timeout=30
    )
    if result.returncode != 0:
        raise RuntimeError(f"psql failed: {result.stderr.strip()}")
    return result.stdout.strip()


def psql_many(statements: list[str]) -> None:
    """Run multiple SQL statements as a single psql call (semicolon-separated)."""
    joined = "\n".join(s if s.endswith(";") else s + ";" for s in statements)
    result = subprocess.run(
        ["docker", "exec", "-i", DOCKER_POSTGRES, "psql", "-U", DB_USER, DB_NAME],
        input=joined, capture_output=True, text=True, timeout=120
    )
    if result.returncode != 0:
        raise RuntimeError(f"psql batch failed: {result.stderr.strip()}")


def hash_password(plain: str) -> str:
    """Bcrypt hash a password with cost factor 10."""
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=10)).decode()


def load_students() -> list[dict]:
    """Read students.csv and return list of dicts with stripped column names.

    The CSV uses spaces after each delimiter (e.g. ', first_name ,') and some
    address values start with a space before a quote (e.g. ' "57, City,...').
    skipinitialspace=True makes Python's csv module treat the space-then-quote
    as a proper quoted field so the address isn't split on its internal commas.
    """
    students = []
    with open(STUDENTS_CSV, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f, skipinitialspace=True)
        for row in reader:
            # Strip whitespace from keys and values; skip the overflow None key
            students.append(
                {k.strip(): v.strip() for k, v in row.items() if k is not None}
            )
    return students


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    students = load_students()
    print(f"[INFO] Loaded {len(students)} students from {STUDENTS_CSV}")

    # Fetch existing emails in one query
    existing_raw = psql(
        f"SELECT email FROM users WHERE org_id={ORG_ID} AND role='student';"
    )
    existing_emails = set(
        line.strip().lower()
        for line in existing_raw.splitlines()
        if line.strip()
    )
    print(f"[INFO] {len(existing_emails)} student accounts already exist in DB")

    to_create = [
        s for s in students
        if s["email"].lower() not in existing_emails
    ]
    skipped = len(students) - len(to_create)

    if to_create:
        print(f"[INFO] Creating {len(to_create)} new accounts...")

    # Build INSERT statements in batches of 50
    BATCH = 50
    created = 0

    for batch_start in range(0, len(to_create), BATCH):
        batch = to_create[batch_start: batch_start + BATCH]
        stmts = []
        for s in batch:
            srn      = s["srn"]
            email    = s["email"].replace("'", "''")
            username = srn.lower()  # e.g. pes1pg24ca001
            dept     = s.get("department_id", "DEPT_MCA").replace("'", "''")

            pw_hash = hash_password(srn)  # password = SRN

            stmts.append(
                f"INSERT INTO users "
                f"(username, email, password_hash, org_id, role, department, "
                f" entity_id, is_active) "
                f"VALUES ("
                f"  '{username}', '{email}', '{pw_hash}', {ORG_ID}, 'student', "
                f"  '{dept}', '{srn}', true"
                f") "
                f"ON CONFLICT (email) DO NOTHING"
            )

        psql_many(stmts)
        created += len(batch)
        print(f"  ... {created}/{len(to_create)} inserted", end="\r", flush=True)

    print()  # newline after progress

    # Backfill user_org_mapping for all students who lack an entry
    # One SQL statement: INSERT INTO user_org_mapping SELECT from users where missing
    psql_many([
        f"""
        INSERT INTO user_org_mapping (user_id, org_id, role, department)
        SELECT u.user_id, {ORG_ID}, 'student', u.department
        FROM users u
        LEFT JOIN user_org_mapping m ON m.user_id = u.user_id AND m.org_id = {ORG_ID}
        WHERE u.org_id = {ORG_ID}
          AND u.role = 'student'
          AND m.user_id IS NULL
        ON CONFLICT (user_id, org_id) DO NOTHING
        """
    ])
    print("[INFO] user_org_mapping backfill complete.")

    # Final verification
    final_count_raw = psql(
        f"SELECT COUNT(*) FROM users WHERE org_id={ORG_ID} AND role='student';"
    )
    final_count = int(final_count_raw.strip() or 0)

    mapping_count_raw = psql(
        f"SELECT COUNT(*) FROM user_org_mapping m "
        f"JOIN users u ON u.user_id = m.user_id "
        f"WHERE m.org_id={ORG_ID} AND u.role='student';"
    )
    mapping_count = int(mapping_count_raw.strip() or 0)

    print(f"\n[DONE] Created: {len(to_create)}  |  Skipped: {skipped}")
    print(f"[VERIFY] Student accounts     : {final_count}")
    print(f"[VERIFY] Org mapping entries  : {mapping_count}")

    if final_count < len(students):
        print(f"[WARN] Expected {len(students)}, got {final_count}. "
              f"Some accounts may have had email conflicts.")
    elif mapping_count < final_count:
        print(f"[WARN] {final_count - mapping_count} students still lack org mapping.")
    else:
        print(f"[OK] All {final_count} student accounts present and org-mapped.")


if __name__ == "__main__":
    main()
