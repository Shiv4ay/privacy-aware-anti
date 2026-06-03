"""Re-run all empty G-category queries and update results_af.jsonl."""
import json
import os
import time
import requests
import jwt as pyjwt
import datetime
import sys
import threading

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Pre-load env from the project .env (same logic as run_bulk_test_af.py)
_repo_root = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
for _env_candidate in [
    os.path.join(_repo_root, ".env"),
    os.path.join(_repo_root, "..", "PRIVACY-AWARE-RAG-GUIDE-CUR", ".env"),
]:
    if os.path.exists(_env_candidate):
        with open(_env_candidate, encoding="utf-8-sig") as _ef:
            for _line in _ef:
                _line = _line.strip()
                if _line and not _line.startswith("#") and "=" in _line:
                    _k, _, _v = _line.partition("=")
                    os.environ.setdefault(_k.strip(), _v.strip())
        break
API_BASE = "http://localhost:3000/api"

ADMIN_UUID = "4841340b-be17-432b-accf-94f206dd5a76"
JWT_SECRET = None  # Will try to load

NOT_FOUND_PHRASES = [
    "could not find", "no information", "not found", "no records",
    "unable to find", "no relevant", "no data", "not available",
]


def load_jwt_secret():
    return os.environ.get("JWT_SECRET", "your-super-secret-jwt-key")


def generate_admin_jwt():
    secret = load_jwt_secret()
    now = int(time.time())
    payload = {
        "userId": ADMIN_UUID,
        "email": "sibasundar2102@gmail.com",
        "username": "sibasundar2102",
        "role": "admin",
        "department": "DEPT_MCA",
        "organizationId": 4,
        "entityId": None,
        "userCategory": "admin",
        "type": "access",
        "iat": now,
        "exp": now + 4 * 3600,
    }
    return pyjwt.encode(payload, secret, algorithm="HS256")


def get_csrf_token():
    try:
        sess = requests.Session()
        sess.get(f"{API_BASE}/health", timeout=10)
        return (sess.cookies.get("__csrf") or sess.cookies.get("csrf_token") or "bypass")
    except Exception:
        return "bypass"


def send_query(query, jwt_token, csrf_token="bypass"):
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "X-CSRF-Token": csrf_token,
        "Content-Type": "application/json",
    }
    if csrf_token != "bypass":
        headers["Cookie"] = f"__csrf={csrf_token}"
    try:
        r = requests.post(
            f"{API_BASE}/chat",
            json={"query": query, "org_id": 4},
            headers=headers,
            timeout=150,
        )
        return r.status_code, r.json() if r.ok else {"raw": r.text[:200]}
    except Exception as e:
        return 0, {"error": str(e)}


def is_empty(response):
    if not response or len(response.strip()) < 20:
        return True
    rl = response.lower()
    return any(p in rl for p in NOT_FOUND_PHRASES)


def main():
    # Load current results
    results_path = os.path.join(SCRIPT_DIR, "results_af.jsonl")
    results = {}
    with open(results_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    r = json.loads(line)
                    results[r["query_id"]] = r
                except Exception:
                    pass

    # Find empty G queries
    empty_g = []
    for qid, r in results.items():
        if r.get("category") != "G":
            continue
        resp = r.get("response", "") or ""
        if is_empty(resp):
            empty_g.append(r)

    print(f"Found {len(empty_g)} empty G queries to re-run.")

    jwt_token = generate_admin_jwt()
    csrf_token = get_csrf_token()
    print(f"CSRF: {csrf_token[:20]}...")
    updated = 0
    fixed = 0

    for i, r in enumerate(empty_g, 1):
        qid = r["query_id"]
        query = r["query"]
        print(f"[{i:3d}/{len(empty_g)}] {qid}: {query[:60]}...", end="", flush=True)

        t0 = time.time()
        status_code, resp_data = send_query(query, jwt_token, csrf_token)
        elapsed = round(time.time() - t0, 1)

        response_text = resp_data.get("response", "") or ""
        was_fixed = not is_empty(response_text)

        preview = (response_text[:50] if response_text else "empty").encode("ascii", "replace").decode("ascii")
        print(f" {'OK' if was_fixed else 'XX'} ({elapsed}s) {preview}")

        # Update result
        results[qid] = {
            **r,
            "response": response_text,
            "status_code": status_code,
            "elapsed": elapsed,
            "rerun": True,
        }
        if was_fixed:
            fixed += 1
        updated += 1

        time.sleep(0.2)

    # Write updated results
    with open(results_path, "w", encoding="utf-8") as f:
        for r in results.values():
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"\nDone. Re-ran {updated} queries. {fixed} now return real data ({updated - fixed} still empty).")


if __name__ == "__main__":
    main()
