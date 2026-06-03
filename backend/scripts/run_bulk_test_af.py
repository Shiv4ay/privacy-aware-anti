"""
Admin + Faculty bulk test runner.

Reads queries_af.jsonl, runs each query with the correct JWT:
  - Categories G/H/I  -> admin JWT (ADMIN_UUID)
  - Categories J/K/L/M -> faculty JWT (FAC_MCA001..005 rotating)

Usage:
    python backend/scripts/run_bulk_test_af.py

Environment:
    MAX_WORKERS   — concurrent threads (default 3)
    API_BASE      — default http://localhost:3000/api
    JWT_SECRET    — auto-loaded from .env
"""

import json
import os
import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

import jwt
import requests

# ── Paths & config ─────────────────────────────────────────────────────────────
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT    = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
PROJECT_ROOT = REPO_ROOT

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

JWT_SECRET    = os.environ.get("JWT_SECRET", "")
API_BASE      = os.environ.get("API_BASE", "http://localhost:3000/api")
MAX_WORKERS   = int(os.environ.get("MAX_WORKERS", "3"))
QUERY_FILE    = os.environ.get("QUERY_FILE",   os.path.join(SCRIPT_DIR, "queries_af.jsonl"))
RESULTS_FILE  = os.environ.get("RESULTS_FILE", os.path.join(SCRIPT_DIR, "results_af.jsonl"))
ERROR_LOG     = os.path.join(SCRIPT_DIR, "runner_af_errors.log")
STATUS_FILE   = os.path.join(SCRIPT_DIR, "status_af.json")

ORG_ID = 4

if not JWT_SECRET:
    print("[ERROR] JWT_SECRET not found.", file=sys.stderr)
    sys.exit(1)

# ── Admin identity ─────────────────────────────────────────────────────────────
ADMIN_UUID  = "4841340b-be17-432b-accf-94f206dd5a76"
ADMIN_EMAIL = "sibasundar2102@gmail.com"

# ── Faculty identities (inserted into DB) ─────────────────────────────────────
FACULTY_USERS = {
    "FAC_MCA001": {"uuid": "a9b179c9-bfd3-4fa7-8ed8-d51298bac399", "email": "fac001@pes.edu.in"},
    "FAC_MCA002": {"uuid": "16a1de64-b3ff-4317-9fb2-9fe44c1e950b", "email": "fac002@pes.edu.in"},
    "FAC_MCA003": {"uuid": "a2389e85-4d60-4feb-b063-a5b6f9e1bccc", "email": "fac003@pes.edu.in"},
    "FAC_MCA004": {"uuid": "858d3bf4-3b33-4b53-b2be-da8a95f0f7f8", "email": "fac004@pes.edu.in"},
    "FAC_MCA005": {"uuid": "78359624-87e5-4c67-ba09-b982634cd27c", "email": "fac005@pes.edu.in"},
}

ADMIN_CATEGORIES = {"G", "H", "I"}
FACULTY_CATEGORIES = {"J", "K", "L", "M"}


# ── JWT generators ─────────────────────────────────────────────────────────────

def generate_admin_jwt() -> str:
    now = int(time.time())
    payload = {
        "userId": ADMIN_UUID,
        "email": ADMIN_EMAIL,
        "username": "sibasundar2102",
        "role": "admin",
        "department": "DEPT_MCA",
        "organizationId": ORG_ID,
        "entityId": None,
        "userCategory": "admin",
        "type": "access",
        "iat": now,
        "exp": now + 4 * 3600,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def generate_faculty_jwt(fac_id: str) -> str:
    info = FACULTY_USERS[fac_id]
    now = int(time.time())
    payload = {
        "userId": info["uuid"],
        "email": info["email"],
        "username": fac_id.lower().replace("_", ""),
        "role": "faculty",
        "department": "DEPT_MCA",
        "organizationId": ORG_ID,
        "entityId": fac_id,
        "userCategory": "faculty",
        "type": "access",
        "iat": now,
        "exp": now + 4 * 3600,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


# ── CSRF ──────────────────────────────────────────────────────────────────────
_csrf_cache: dict = {}
_csrf_lock = threading.Lock()


def get_csrf_token() -> str:
    with _csrf_lock:
        if _csrf_cache.get("token"):
            return _csrf_cache["token"]
        try:
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


# ── Single query executor ──────────────────────────────────────────────────────

def run_query(query_record: dict, jwt_token: str, csrf_token: str) -> dict:
    qid      = query_record["query_id"]
    category = query_record["category"]
    srn      = query_record["srn"]
    query    = query_record["query"]

    def _attempt() -> dict:
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
            "query_id":       qid,
            "category":       category,
            "srn":            srn,
            "query":          query,
            "status_code":    resp.status_code,
            "status":         body.get("status", "unknown"),
            "response":       body.get("response", body.get("message", "")),
            "confidence":     body.get("confidence"),
            "elapsed":        elapsed,
            "timestamp":      datetime.now(timezone.utc).isoformat(),
            "expected_field": query_record.get("expected_field"),
            "expected_value": query_record.get("expected_value"),
            "expected_blocked": query_record.get("expected_blocked", False),
            "attacker_srn":   query_record.get("attacker_srn"),
            "target_srn":     query_record.get("target_srn"),
        }

    try:
        result = _attempt()
        if result["status_code"] in (503, 504, 502, 0):
            time.sleep(15)
            result = _attempt()
        elif result["status_code"] >= 500:
            time.sleep(10)
            result = _attempt()
        return result
    except requests.Timeout:
        time.sleep(15)
        try:
            return _attempt()
        except Exception as e:
            return _error_result(query_record, f"timeout: {e}")
    except (requests.ConnectionError, ConnectionResetError):
        time.sleep(20)
        try:
            return _attempt()
        except Exception as e:
            return _error_result(query_record, f"connection_error: {e}")
    except Exception as e:
        return _error_result(query_record, str(e))


def _error_result(query_record: dict, error_msg: str) -> dict:
    return {
        "query_id":       query_record["query_id"],
        "category":       query_record["category"],
        "srn":            query_record["srn"],
        "query":          query_record["query"],
        "status_code":    0,
        "status":         "error",
        "response":       "",
        "confidence":     None,
        "elapsed":        0,
        "timestamp":      datetime.now(timezone.utc).isoformat(),
        "error_message":  error_msg,
        "expected_field": query_record.get("expected_field"),
        "expected_value": query_record.get("expected_value"),
        "expected_blocked": query_record.get("expected_blocked", False),
    }


# ── Results I/O ───────────────────────────────────────────────────────────────

_results_lock = threading.Lock()
_status_counter = {"done": 0, "errors": 0, "total": 313, "start_ts": time.time()}


def load_completed_ids(results_file: str) -> set:
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


def append_result(result: dict) -> None:
    with _results_lock:
        with open(RESULTS_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(result, ensure_ascii=False) + "\n")
        _status_counter["done"] += 1
        is_err = result.get("status_code", 0) not in (200,) or result.get("status") == "error"
        if is_err:
            _status_counter["errors"] += 1
        elapsed = time.time() - _status_counter["start_ts"]
        rate = _status_counter["done"] / elapsed if elapsed > 0 else 0
        remaining = (_status_counter["total"] - _status_counter["done"]) / rate if rate > 0 else 0
        status = {
            "done":        _status_counter["done"],
            "total":       _status_counter["total"],
            "errors":      _status_counter["errors"],
            "elapsed_s":   int(elapsed),
            "eta_s":       int(remaining),
            "pct":         100 * _status_counter["done"] // _status_counter["total"],
            "running":     True,
            "last_update": datetime.now(timezone.utc).isoformat(),
            "test_type":   "admin_faculty",
            "last_result": {
                "query_id":    result.get("query_id"),
                "category":    result.get("category"),
                "status_code": result.get("status_code"),
                "status":      result.get("status"),
                "elapsed":     result.get("elapsed"),
            }
        }
        with open(STATUS_FILE, "w", encoding="utf-8") as f:
            f.write(json.dumps(status, ensure_ascii=False) + "\n")


def log_error(query_id: str, srn: str, error: str) -> None:
    with _results_lock:
        with open(ERROR_LOG, "a", encoding="utf-8") as f:
            f.write(f"{datetime.now(timezone.utc).isoformat()} | {query_id} | {srn} | {error}\n")


# ── Progress bar ──────────────────────────────────────────────────────────────

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
            elapsed   = time.time() - self.start_ts
            rate      = self.done / elapsed if elapsed > 0 else 0
            remaining = (self.total - self.done) / rate if rate > 0 else 0
            pct       = 100 * self.done // self.total
            bar_len   = 30
            filled    = bar_len * self.done // self.total
            bar       = "#" * filled + "-" * (bar_len - filled)
            eta       = f"{int(remaining // 60)}m{int(remaining % 60)}s"
            print(
                f"\r[{bar}] {self.done}/{self.total} ({pct}%) "
                f"| errors={self.errors} | ETA={eta}  ",
                end="", flush=True
            )

    def finish(self):
        elapsed = time.time() - self.start_ts
        print(f"\n[DONE] {self.done}/{self.total} in {int(elapsed//60)}m{int(elapsed%60)}s "
              f"| {self.errors} errors")


# ── JWT cache (refresh each hour) ────────────────────────────────────────────

_jwt_cache: dict = {}
_jwt_lock = threading.Lock()


def get_jwt(category: str, srn: str) -> str:
    """Get a JWT for the query, cached and refreshed every 3h."""
    with _jwt_lock:
        now = int(time.time())
        if category in ADMIN_CATEGORIES:
            key = "admin"
            if key not in _jwt_cache or now > _jwt_cache[key]["exp"] - 300:
                _jwt_cache[key] = {"token": generate_admin_jwt(), "exp": now + 4 * 3600}
            return _jwt_cache[key]["token"]
        else:
            # srn is the FAC_MCA00x ID
            fac_id = srn if srn in FACULTY_USERS else "FAC_MCA001"
            key = fac_id
            if key not in _jwt_cache or now > _jwt_cache[key]["exp"] - 300:
                _jwt_cache[key] = {"token": generate_faculty_jwt(fac_id), "exp": now + 4 * 3600}
            return _jwt_cache[key]["token"]


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if not os.path.exists(QUERY_FILE):
        print(f"[ERROR] {QUERY_FILE} not found. Run build_af_queries.py first.", file=sys.stderr)
        sys.exit(1)

    # Load queries
    queries = []
    with open(QUERY_FILE, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                queries.append(json.loads(line))

    # Resume support
    completed = load_completed_ids(RESULTS_FILE)
    pending   = [q for q in queries if q["query_id"] not in completed]

    total = len(queries)
    _status_counter["total"] = total
    _status_counter["done"]  = len(completed)
    _status_counter["errors"] = 0

    print(f"[INFO] {total} queries total | {len(completed)} already done | {len(pending)} pending")
    print(f"[INFO] Results -> {RESULTS_FILE}")
    print(f"[INFO] Status  -> {STATUS_FILE}")
    print(f"[INFO] Workers = {MAX_WORKERS}")

    if not pending:
        print("[INFO] All queries already done.")
        return

    # Initial status
    with open(STATUS_FILE, "w", encoding="utf-8") as f:
        f.write(json.dumps({
            "done": len(completed), "total": total, "errors": 0,
            "elapsed_s": 0, "eta_s": 0, "pct": 100 * len(completed) // total,
            "running": True, "test_type": "admin_faculty",
            "last_update": datetime.now(timezone.utc).isoformat(),
        }) + "\n")

    csrf_token = get_csrf_token()
    progress   = SimpleProgress(total)
    progress.done  = len(completed)

    def worker_fn(query_record: dict) -> dict:
        jwt_token = get_jwt(query_record["category"], query_record["srn"])
        return run_query(query_record, jwt_token, csrf_token)

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(worker_fn, qr): qr for qr in pending}
        for future in as_completed(futures):
            qr = futures[future]
            try:
                result = future.result()
            except Exception as e:
                result = _error_result(qr, str(e))
                log_error(qr["query_id"], qr["srn"], str(e))

            append_result(result)
            has_error = result.get("status_code", 0) not in (200,) or result.get("status") == "error"
            if has_error:
                log_error(result["query_id"], result["srn"],
                          result.get("error_message", f"HTTP {result.get('status_code')}"))
            progress.update(has_error=has_error)

    progress.finish()

    # Mark done in status
    with open(STATUS_FILE, "w", encoding="utf-8") as f:
        f.write(json.dumps({
            "done": total, "total": total, "errors": progress.errors,
            "elapsed_s": int(time.time() - progress.start_ts),
            "eta_s": 0, "pct": 100, "running": False, "test_type": "admin_faculty",
            "last_update": datetime.now(timezone.utc).isoformat(),
        }) + "\n")

    print(f"\n[INFO] All done. Run validate_af.py to check results.")


if __name__ == "__main__":
    main()
