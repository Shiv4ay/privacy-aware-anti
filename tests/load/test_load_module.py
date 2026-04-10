"""Verify the locustfile is importable and defines the expected User class."""
import importlib.util
import os
import subprocess
import sys

LOCUSTFILE = os.path.join(os.path.dirname(__file__), "locustfile.py")


def _run_check(script: str) -> subprocess.CompletedProcess:
    """Run a Python snippet in a clean subprocess (avoids pytest/gevent ssl clash)."""
    return subprocess.run(
        [sys.executable, "-c", script],
        capture_output=True,
        text=True,
        timeout=30,
    )


def test_locustfile_importable():
    """tests/load/locustfile.py must import without error."""
    script = f"""
import importlib.util, sys
spec = importlib.util.spec_from_file_location("locustfile", r"{LOCUSTFILE}")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
print("OK")
"""
    result = _run_check(script)
    assert result.returncode == 0, f"locustfile import failed: {result.stderr}"


def test_locustfile_defines_raguser():
    """locustfile.py must define RAGUser inheriting from HttpUser."""
    script = f"""
import importlib.util
from locust import HttpUser
spec = importlib.util.spec_from_file_location("locustfile", r"{LOCUSTFILE}")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
assert hasattr(mod, 'RAGUser'), "RAGUser not defined"
assert issubclass(mod.RAGUser, HttpUser), "RAGUser must inherit from HttpUser"
print("OK")
"""
    result = _run_check(script)
    assert result.returncode == 0, f"RAGUser check failed: {result.stderr}"


def test_locustfile_has_tasks():
    """RAGUser must have at least 2 @task methods."""
    script = f"""
import importlib.util
spec = importlib.util.spec_from_file_location("locustfile", r"{LOCUSTFILE}")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
tasks = [name for name in dir(mod.RAGUser)
         if not name.startswith('_')
         and callable(getattr(mod.RAGUser, name))
         and hasattr(getattr(mod.RAGUser, name), 'locust_task_weight')]
assert len(tasks) >= 2, f"RAGUser must have >= 2 @task methods, found: {{tasks}}"
print(f"Found {{len(tasks)}} tasks: {{tasks}}")
"""
    result = _run_check(script)
    assert result.returncode == 0, f"Task count check failed: {result.stderr}"
