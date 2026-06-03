"""
Concurrent bulk test runner for the RAG 1100-query evaluation pipeline.

Reads queries.jsonl, runs each query against the live API as the corresponding
student (real JWT + CSRF), saves results incrementally to results.jsonl.
Resumes automatically if interrupted.

Usage (from repo root):
    python backend/scripts/run_bulk_test.py

Environment:
    MAX_WORKERS  — concurrent threads (default 5, hard cap for Ollama CPU)
    QUERY_FILE   — path to queries.jsonl  (default: backend/scripts/queries.jsonl)
    RESULTS_FILE — path to results.jsonl  (default: backend/scripts/results.jsonl)
    API_BASE     — API base URL          (default: http://localhost:3000/api)
    JWT_SECRET   — JWT signing secret    (auto-loaded from .env)
"""

import csv
import json
import os
import subprocess
import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

import jwt
import requests

# ── Paths & config ────────────────────────────────────────────────────────────
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT    = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))

# Load .env
_env_file = os.path.join(PROJECT_ROOT, "PRIVACY-AWARE-RAG-GUIDE-CUR", ".env")
if not os.path.exists(_env_file):
    _env_file = os.path.join(REPO_ROOT, ".env")
if os.path.exists(_env_file):
    with open(_env_file, encoding="utf-8-sig") as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _, _v = _line.partition("=")
                os.environ.setdefault(_k.strip(), _v.strip())

_csv_candidates = [
    os.path.join(REPO_ROOT, "Datasets", "University", "pes_mca_dataset"),
    os.path.join(REPO_ROOT, "..", "Datasets", "University", "pes_mca_dataset"),
]
CSV_BASE = next((p for p in _csv_candidates if os.path.isdir(p)), None)

JWT_SECRET   = os.environ.get("JWT_SECRET", "")
API_BASE     = os.environ.get("API_BASE", "http://localhost:3000/api")
MAX_WORKERS  = int(os.environ.get("MAX_WORKERS", "3"))
QUERY_FILE   = os.environ.get("QUERY_FILE",   os.path.join(SCRIPT_DIR, "queries.jsonl"))
RESULTS_FILE = os.environ.get("RESULTS_FILE", os.path.join(SCRIPT_DIR, "results.jsonl"))
ERROR_LOG    = os.path.join(SCRIPT_DIR, "runner_errors.log")
STATUS_FILE  = os.path.join(SCRIPT_DIR, "status.json")

ORG_ID = 4

if not JWT_SECRET:
    print("[ERROR] JWT_SECRET not found. Set it in .env or environment.", file=sys.stderr)
    sys.exit(1)

# ── Student lookup ────────────────────────────────────────────────────────────

DOCKER_POSTGRES = "privacy-aware-postgres"
DB_USER = "postgres"
DB_NAME = "privacy_docs"


def _psql(sql: str) -> str:
    result = subprocess.run(
        ["docker", "exec", DOCKER_POSTGRES, "psql", "-U", DB_USER, DB_NAME,
         "-t", "-A", "-c", sql],
        capture_output=True, text=True, timeout=30
    )
    if result.returncode != 0:
        raise RuntimeError(f"psql failed: {result.stderr.strip()}")
    return result.stdout.strip()


def load_student_uuids() -> dict[str, str]:
    """Return {srn (entity_id): user_id UUID} for all students in org 4."""
    raw = _psql(
        f"SELECT entity_id, user_id FROM users "
        f"WHERE org_id={ORG_ID} AND role='student' AND entity_id IS NOT NULL;"
    )
    out = {}
    for line in raw.splitlines():
        line = line.strip()
        if "|" in line:
            srn, uid = line.split("|", 1)
            out[srn.strip()] = uid.strip()
    return out


def _load_students() -> dict[str, dict]:
    if CSV_BASE is None:
        return {}
    path = os.path.join(CSV_BASE, "students.csv")
    out = {}
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f, skipinitialspace=True)
        for raw in reader:
            row = {k.strip(): (v.strip() if v else "") for k, v in raw.items() if k}
            srn = row.get("srn", "")
            if srn:
                out[srn] = row
    return out


# ── JWT generator ─────────────────────────────────────────────────────────────

def generate_jwt(srn: str, email: str, user_uuid: str, username: str = "") -> str:
    """Sign a JWT identical to what jwtManager.generateAccessToken produces.

    user_uuid must be the UUID from users.user_id so authMiddleware can look
    up the full user record (entity_id, org_id, role) from the database.
    """
    now = int(time.time())
    payload = {
        "userId": user_uuid,    # Must be the UUID stored in users.user_id
        "email": email,
        "username": username or srn.lower(),
        "role": "student",
        "department": "DEPT_MCA",
        "organizationId": ORG_ID,
        "entityId": srn,
        "userCategory": "student",
        "type": "access",
        "iat": now,
        "exp": now + 4 * 3600,  # 4 hours
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


# ── CSRF token ────────────────────────────────────────────────────────────────

_csrf_cache: dict = {}
_csrf_lock = threading.Lock()


def get_csrf_token() -> str:
    """Fetch CSRF token from the API. Cached for the session.

    The API sets a __csrf cookie and expects the same value in X-CSRF-Token.
    Both must be sent together. We cache the cookie value and inject it as
    both a Cookie header and X-CSRF-Token header on every request.
    """
    with _csrf_lock:
        if _csrf_cache.get("token"):
            return _csrf_cache["token"]
        try:
            # Use a temporary session just to get the CSRF cookie
            _sess = requests.Session()
            _sess.get(f"{API_BASE}/health", timeout=10)
            csrf = (_sess.cookies.get("__csrf")
                    or _sess.cookies.get("csrf_token")
                    or "bypass")
            _csrf_cache["token"] = csrf
            return csrf
        except Exception:
            _csrf_cache["token"] = "bypass"
            return "bypass"
            
            


# ── Single query executor ─────────────────────────────────────────────────────

def run_query(query_record: dict, jwt_token: str, csrf_token: str) -> dict:
    """
    POST /api/chat as the student, return a result dict.
    Retries once on 5xx / timeout.
    """
    qid      = query_record["query_id"]
    category = query_record["category"]
    srn      = query_record["srn"]
    query    = query_record["query"]

    def _attempt() -> dict:
        # The CSRF middleware checks: cookie.__csrf == header.X-CSRF-Token
        # Both must be sent together. We send the cookie value via the Cookie
        # header directly (avoids session domain matching issues) and also
        # set X-CSRF-Token. Each attempt creates its own fresh connection.
        t0 = time.time()
        cookie_header = (f"__csrf={csrf_token}" if csrf_token != "bypass" else "")
        headers = {
            "Authorization": f"Bearer {jwt_token}",
            "X-CSRF-Token": csrf_token,
            "Content-Type": "application/json",
        }
        if cookie_header:
            headers["Cookie"] = cookie_header
        resp = requests.post(
            f"{API_BASE}/chat",
            json={"query": query, "org_id": ORG_ID},
            headers=headers,
            timeout=260,
        )
        elapsed = round(time.time() - t0, 2)
        body = {}
        try:
            body = resp.json()
        except Exception:
            body = {"raw": resp.text[:500]}

        return {
            "query_id":    qid,
            "category":    category,
            "srn":         srn,
            "query":       query,
            "status_code": resp.status_code,
            "status":      body.get("status", "unknown"),
            "response":    body.get("response", body.get("message", "")),
            "confidence":  body.get("confidence"),
            "elapsed":     elapsed,
            "timestamp":   datetime.now(timezone.utc).isoformat(),
            # pass through expected fields for validator
            "expected_field":   query_record.get("expected_field"),
            "expected_value":   query_record.get("expected_value"),
            "expected_blocked": query_record.get("expected_blocked", False),
            "attacker_srn":     query_record.get("attacker_srn"),
            "target_srn":       query_record.get("target_srn"),
        }

    try:
        result = _attempt()
        if result["status_code"] in (503, 504, 502, 0):
            time.sleep(15)   # wait for circuit breaker reset / nginx recovery
            result = _attempt()
        elif result["status_code"] >= 500:
            time.sleep(10)
            result = _attempt()  # single retry
        return result
    except requests.Timeout:
        time.sleep(15)
        try:
            return _attempt()
        except Exception as e:
            return _error_result(query_record, f"timeout: {e}")
    except (requests.ConnectionError, ConnectionResetError):
        time.sleep(20)   # connection reset: wait longer before retry
        try:
            return _attempt()
        except Exception as e:
            return _error_result(query_record, f"connection_error: {e}")
    except Exception as e:
        return _error_result(query_record, str(e))


def _error_result(query_record: dict, error_msg: str) -> dict:
    return {
        "query_id":    query_record["query_id"],
        "category":    query_record["category"],
        "srn":         query_record["srn"],
        "query":       query_record["query"],
        "status_code": 0,
        "status":      "error",
        "response":    "",
        "confidence":  None,
        "elapsed":     0,
        "timestamp":   datetime.now(timezone.utc).isoformat(),
        "error_message": error_msg,
        "expected_field":   query_record.get("expected_field"),
        "expected_value":   query_record.get("expected_value"),
        "expected_blocked": query_record.get("expected_blocked", False),
    }


# ── Results I/O ───────────────────────────────────────────────────────────────

_results_lock = threading.Lock()


def load_completed_ids(results_file: str) -> set[str]:
    """Return set of query_ids already in results.jsonl."""
    completed = set()
    if not os.path.exists(results_file):
        return completed
    with open(results_file, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    completed.add(json.loads(line)["query_id"])
                except (json.JSONDecodeError, KeyError):
                    pass
    return completed


_status_counter = {"done": 0, "errors": 0, "total": 1105, "start_ts": time.time()}

def append_result(result: dict, results_file: str) -> None:
    """Append one result to results.jsonl and update status.json (thread-safe)."""
    with _results_lock:
        with open(results_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(result, ensure_ascii=False) + "\n")
        # Update status.json for live dashboard
        _status_counter["done"] += 1
        is_err = result.get("status_code", 0) not in (200,) or result.get("status") == "error"
        if is_err:
            _status_counter["errors"] += 1
        elapsed = time.time() - _status_counter["start_ts"]
        rate = _status_counter["done"] / elapsed if elapsed > 0 else 0
        remaining = (_status_counter["total"] - _status_counter["done"]) / rate if rate > 0 else 0
        status = {
            "done": _status_counter["done"],
            "total": _status_counter["total"],
            "errors": _status_counter["errors"],
            "elapsed_s": int(elapsed),
            "eta_s": int(remaining),
            "pct": 100 * _status_counter["done"] // _status_counter["total"],
            "running": True,
            "last_update": datetime.now(timezone.utc).isoformat(),
            "last_result": {
                "query_id": result.get("query_id"),
                "category": result.get("category"),
                "status_code": result.get("status_code"),
                "status": result.get("status"),
                "elapsed": result.get("elapsed"),
            }
        }
        with open(STATUS_FILE, "w", encoding="utf-8") as f:
            f.write(json.dumps(status, ensure_ascii=False) + "\n")


def log_error(query_id: str, srn: str, error: str) -> None:
    with _results_lock:
        with open(ERROR_LOG, "a", encoding="utf-8") as f:
            f.write(f"{datetime.now(timezone.utc).isoformat()} | {query_id} | {srn} | {error}\n")


# ── Progress bar (no external deps) ──────────────────────────────────────────

class SimpleProgress:
    def __init__(self, total: int):
        self.total    = total
        self.done     = 0
        self.errors   = 0
        self.lock     = threading.Lock()
        self.start_ts = time.time()

    def update(self, has_error: bool = False):
        with self.lock:
            self.done += 1
            if has_error:
                self.errors += 1
            elapsed = time.time() - self.start_ts
            rate = self.done / elapsed if elapsed > 0 else 0
            remaining = (self.total - self.done) / rate if rate > 0 else 0
            pct = 100 * self.done // self.total
            bar_len = 30
            filled = bar_len * self.done // self.total
            bar = "#" * filled + "-" * (bar_len - filled)
            eta = f"{int(remaining // 60)}m{int(remaining % 60)}s"
            print(
                f"\r[{bar}] {self.done}/{self.total} ({pct}%) "
                f"| errors={self.errors} | ETA={eta}  ",
                end="", flush=True
            )

    def finish(self):
        elapsed = time.time() - self.start_ts
        print(f"\n[DONE] {self.done}/{self.total} in {int(elapsed//60)}m{int(elapsed%60)}s "
              f"| {self.errors} errors")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    # Load query bank
    if not os.path.exists(QUERY_FILE):
        print(f"[ERROR] queries.jsonl not found at {QUERY_FILE}", file=sys.stderr)
        print("  Run query_bank.py first.", file=sys.stderr)
        sys.exit(1)

    with open(QUERY_FILE, encoding="utf-8") as f:
        all_queries = [json.loads(line) for line in f if line.strip()]
    print(f"[INFO] Query bank: {len(all_queries)} queries")

    # Load student data for JWT generation
    students = _load_students()
    if not students:
        print("[WARN] Could not load students.csv — JWTs will use SRN-only payloads")

    # Resume: skip already completed queries
    completed_ids = load_completed_ids(RESULTS_FILE)
    pending = [q for q in all_queries if q["query_id"] not in completed_ids]
    print(f"[INFO] Completed: {len(completed_ids)}  |  Pending: {len(pending)}")

    if not pending:
        print("[DONE] All queries already completed. Nothing to do.")
        return

    # Load UUID mapping from DB (authMiddleware requires UUID in userId claim)
    print("[INFO] Loading student UUIDs from DB...")
    uuid_map = load_student_uuids()
    missing_uuids = [q["srn"] for q in pending if q["srn"] not in uuid_map]
    if missing_uuids:
        print(f"[WARN] {len(missing_uuids)} SRNs have no DB account — they will be skipped")
        pending = [q for q in pending if q["srn"] in uuid_map]
    print(f"[INFO] UUIDs loaded for {len(uuid_map)} students")

    # Pre-build JWT cache: one JWT per SRN
    print("[INFO] Generating JWTs...")
    jwt_cache: dict[str, str] = {}
    for q in pending:
        srn = q["srn"]
        if srn not in jwt_cache:
            s = students.get(srn, {})
            email = s.get("email", f"{srn.lower()}@pesu.edu.in")
            user_uuid = uuid_map[srn]
            jwt_cache[srn] = generate_jwt(srn, email, user_uuid)
    print(f"[INFO] JWTs generated for {len(jwt_cache)} unique students")

    csrf_token = get_csrf_token()
    print(f"[INFO] CSRF token: {csrf_token[:20]}...")
    print(f"[INFO] Starting {MAX_WORKERS} workers...")
    print()

    # Initialise status counter
    _status_counter["total"] = len(all_queries)  # original total (for pct)
    _status_counter["done"] = len(completed_ids)  # already done
    _status_counter["errors"] = 0
    _status_counter["start_ts"] = time.time()

    progress = SimpleProgress(len(pending))

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {
            pool.submit(run_query, q, jwt_cache[q["srn"]], csrf_token): q
            for q in pending
        }

        for future in as_completed(futures):
            query_record = futures[future]
            try:
                result = future.result()
            except Exception as exc:
                result = _error_result(query_record, str(exc))

            append_result(result, RESULTS_FILE)

            is_error = result.get("status") == "error" or result.get("status_code", 0) == 0
            if is_error:
                log_error(result["query_id"], result["srn"],
                          result.get("error_message", "unknown error"))

            progress.update(has_error=is_error)

    progress.finish()

    # Summary
    with open(RESULTS_FILE, encoding="utf-8") as f:
        all_results = [json.loads(l) for l in f if l.strip()]

    from collections import Counter
    cat_counts    = Counter(r["category"]    for r in all_results)
    status_counts = Counter(r.get("status", "?") for r in all_results)

    print(f"\n{'Results Summary':=^50}")
    print(f"  Total results saved: {len(all_results)}")
    for cat in ["A", "B", "C", "D", "E", "F"]:
        print(f"  Category {cat}: {cat_counts.get(cat, 0)}")
    print(f"  Status breakdown: {dict(status_counts)}")
    print(f"[SAVED] {RESULTS_FILE}")

    # Mark status as complete
    with open(STATUS_FILE, "w", encoding="utf-8") as f:
        f.write(json.dumps({
            "done": len(all_results), "total": len(all_results),
            "errors": sum(1 for r in all_results if r.get("status_code", 0) not in (200,)),
            "pct": 100, "running": False,
            "last_update": datetime.now(timezone.utc).isoformat(),
        }) + "\n")


if __name__ == "__main__":
    main()
