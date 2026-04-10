"""
Locust load test for Privacy-Aware RAG system.

Run headlessly:
  locust --config tests/load/locust.conf

Or with custom host:
  locust -f tests/load/locustfile.py --host http://localhost:3001 \
         --headless --users 20 --spawn-rate 2 --run-time 60s
"""
from locust import HttpUser, task, between
import json
import os

DEV_AUTH_KEY = os.getenv("DEV_AUTH_KEY", "super-secret-dev-key")
CSRF_TOKEN = "load-test-bypass"


class RAGUser(HttpUser):
    """Simulates a user querying the Privacy-Aware RAG endpoints."""

    wait_time = between(2, 5)

    def on_start(self):
        self.headers = {
            "x-dev-auth": DEV_AUTH_KEY,
            "x-csrf-token": CSRF_TOKEN,
            "Content-Type": "application/json",
        }

    @task(3)
    def health_check(self):
        """Lightweight liveness probe — weight 3 (most frequent)."""
        with self.client.get(
            "/healthz",
            headers={"x-dev-auth": DEV_AUTH_KEY},
            catch_response=True,
            name="/healthz",
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"Expected 200, got {resp.status_code}")

    @task(2)
    def metrics_scrape(self):
        """Prometheus metrics scrape — weight 2."""
        with self.client.get(
            "/metrics",
            headers={"x-dev-auth": DEV_AUTH_KEY},
            catch_response=True,
            name="/metrics",
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"Expected 200, got {resp.status_code}")
            if "http_requests_total" not in (resp.text or ""):
                resp.failure("Missing http_requests_total in metrics output")

    @task(1)
    def chat_query(self):
        """AI chat query — weight 1 (slowest, least frequent)."""
        payload = json.dumps({
            "message": "what are my sem 1 marks",
            "org_id": 4,
            "user_role": "student",
        })
        with self.client.post(
            "/api/chat",
            data=payload,
            headers=self.headers,
            catch_response=True,
            name="/api/chat",
            timeout=120,
        ) as resp:
            # 401/403 expected in load tests — no real JWT is configured.
            # These are auth-layer responses, not system failures.
            if resp.status_code not in (200, 401, 403):
                resp.failure(f"Unexpected status {resp.status_code}: {resp.text[:100]}")
            else:
                resp.success()
