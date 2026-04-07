"""
Verify the production Docker image does not contain debug/diagnostic scripts.
Requires Docker daemon. Run: python -m pytest tests/security/test_docker_image.py -v
The worker image must be built first: cd backend/worker && docker build -t privacy-aware-rag-worker .
"""
import os
import subprocess
import pytest

IMAGE = "privacy-aware-rag-worker"

BANNED_PATTERNS = [
    "debug_",
    "check_",
    "verify_",
    "script_",
    "audit_",
    "inspect_",
    "peek_",
    "recover",
    "requeue",
    "fresh_start",
    "clone_recovery",
    "exhaustive_scan",
    "diag_",
    ".backup",
    "container_logs",
    "worker_logs",
    "apply_chat_fix",
    "extract_code",
    "fix_chat_query",
    "global_ale_search",
    "demo_ale_upload",
]

REQUIRED_FILES = [
    "/app/app.py",
    "/app/requirements.txt",
]

REQUIRED_DIRS = [
    "/app/security",
    "/app/nl2sql",
    "/app/ingestion",
]

# On Windows/Git-bash, Docker translates /app paths to Windows paths.
# Setting MSYS_NO_PATHCONV=1 disables that translation.
_ENV = {**os.environ, "MSYS_NO_PATHCONV": "1"}


def _docker_run(cmd: list[str], timeout: int = 60) -> str:
    result = subprocess.run(
        ["docker", "run", "--rm", "--entrypoint", "", IMAGE] + cmd,
        capture_output=True, text=True, timeout=timeout, env=_ENV
    )
    if result.returncode != 0:
        raise RuntimeError(f"docker run failed: {result.stderr}")
    return result.stdout.strip()


def test_no_debug_scripts_in_image():
    """Production image must not contain debug or diagnostic scripts."""
    files = _docker_run(["find", "/app", "-name", "*.py", "-type", "f"]).split("\n")
    violations = [
        f for f in files if f
        and any(pattern in f.lower() for pattern in BANNED_PATTERNS)
    ]
    assert not violations, (
        "Debug/diagnostic scripts found in production image:\n"
        + "\n".join(violations)
        + "\n\nAdd these to backend/worker/.dockerignore"
    )


def test_required_files_present():
    """Core application files must still be in the image after .dockerignore."""
    for path in REQUIRED_FILES:
        result = subprocess.run(
            ["docker", "run", "--rm", "--entrypoint", "", IMAGE, "test", "-f", path],
            capture_output=True, timeout=30, env=_ENV
        )
        assert result.returncode == 0, f"Required file missing from image: {path}"


def test_required_dirs_present():
    """Core application directories must still be in the image."""
    for path in REQUIRED_DIRS:
        result = subprocess.run(
            ["docker", "run", "--rm", "--entrypoint", "", IMAGE, "test", "-d", path],
            capture_output=True, timeout=30, env=_ENV
        )
        assert result.returncode == 0, f"Required directory missing from image: {path}"
