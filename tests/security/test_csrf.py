"""
CSRF protection test.
POST to /chat without X-CSRF-Token header must return 403.
Run against the running stack. Uses port 3001 directly (api gateway).
"""
import requests
import pytest

urllib3 = pytest.importorskip("urllib3")
import urllib3 as _urllib3
_urllib3.disable_warnings(_urllib3.exceptions.InsecureRequestWarning)

# Use port 3001 directly (api gateway), not nginx, to avoid XAMPP port conflict.
# When running inside Docker (e.g. via docker exec on the worker), use the service
# hostname. When running on the host, use localhost if port 3001 is published.
import os
API = os.environ.get("API_BASE_URL", "http://localhost:3001")

def test_chat_post_without_csrf_rejected():
    """POST /chat without X-CSRF-Token must return 403."""
    r = requests.post(
        f"{API}/api/chat",
        json={"query": "test", "org_id": 4},
        headers={"x-dev-auth": "super-secret-dev-key", "Content-Type": "application/json"},
        timeout=5,
    )
    assert r.status_code == 403, (
        f"Expected 403 CSRF rejection, got {r.status_code}. "
        "CSRF middleware not applied to /chat."
    )

def test_csrf_cookie_set_on_get():
    """GET request must set __csrf cookie in response."""
    r = requests.get(f"{API}/healthz", timeout=5)
    assert "__csrf" in r.cookies, (
        f"Expected __csrf cookie in response, got cookies: {dict(r.cookies)}"
    )

def test_post_with_csrf_token_accepted():
    """POST with matching X-CSRF-Token must NOT return 403."""
    # First: get the csrf token from a GET
    session = requests.Session()
    session.get(f"{API}/healthz", timeout=5)
    csrf_token = session.cookies.get("__csrf")
    assert csrf_token, "No __csrf cookie received from GET /healthz"

    # Then: POST with the token (may return 401 for invalid JWT — that's fine, not 403)
    r = session.post(
        f"{API}/api/chat",
        json={"query": "test", "org_id": 4},
        headers={
            "x-dev-auth": "super-secret-dev-key",
            "Content-Type": "application/json",
            "X-CSRF-Token": csrf_token,
        },
        timeout=10,
    )
    assert r.status_code != 403, (
        f"Valid CSRF token should not be rejected with 403, got {r.status_code}"
    )

def test_get_not_blocked_by_csrf():
    """GET requests must NOT require CSRF token."""
    r = requests.get(f"{API}/healthz", timeout=5)
    assert r.status_code != 403, "GET should not require CSRF token"
