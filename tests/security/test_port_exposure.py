"""
Verify that internal services are NOT reachable from the host network.
Run AFTER applying docker-compose changes: docker compose up -d
"""
import os
import socket
import pytest

INTERNAL_PORTS = [
    ("localhost", 5432, "postgres"),
    ("localhost", 6379, "redis"),
    ("localhost", 8000, "chromadb"),
    ("localhost", 8001, "worker"),
    ("localhost", 9000, "minio-api"),
    ("localhost", 9001, "minio-console"),
    ("localhost", 11434, "ollama"),
]

PUBLIC_PORTS = [
    ("localhost", 3001, "api-gateway"),
    ("localhost", 3000, "frontend"),
]

def _is_port_open(host: str, port: int, timeout: float = 1.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (ConnectionRefusedError, OSError):
        return False

@pytest.mark.parametrize("host,port,name", INTERNAL_PORTS)
def test_internal_port_not_exposed(host, port, name):
    """Internal services MUST NOT be reachable from the host."""
    assert not _is_port_open(host, port), (
        f"SECURITY VIOLATION: {name} port {port} is accessible from host. "
        f"Remove 'ports: - \"{port}:{port}\"' from docker-compose.yml."
    )

@pytest.mark.parametrize("host,port,name", PUBLIC_PORTS)
def test_public_port_reachable(host, port, name):
    """Public Nginx ports MUST be reachable."""
    assert _is_port_open(host, port), (
        f"Nginx {name} port {port} is not reachable. Is nginx container running?"
    )

REQUIRED_SECRETS = [
    "POSTGRES_PASSWORD",
    "JWT_SECRET",
    "OPENAI_API_KEY",
    "MINIO_SECRET_KEY",
    "WORKER_INTERNAL_KEY",
    "ALE_MASTER_KEY",
]

def test_no_default_placeholder_secrets():
    """All required secrets must be set and not contain placeholder text."""
    # Load .env from project root (same pattern as demo_test.py)
    import pathlib
    env_file = pathlib.Path(__file__).parent.parent.parent / ".env"
    if env_file.exists():
        with open(env_file, encoding="utf-8-sig") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    os.environ.setdefault(k.strip(), v.strip())

    for var in REQUIRED_SECRETS:
        val = os.environ.get(var, "")
        assert val, f"Secret {var} is not set in .env or environment"
        assert "CHANGE_ME" not in val, f"Secret {var} still has placeholder value"
        assert len(val) >= 16, f"Secret {var} is too short (min 16 chars)"
