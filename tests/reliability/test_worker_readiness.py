"""Worker readiness probe tests."""
import subprocess
import json

def _curl_worker(path):
    r = subprocess.run(
        ['docker', 'exec', 'privacy-aware-worker',
         'curl', '-s', '-w', '\\n%{http_code}', f'http://localhost:8001{path}'],
        capture_output=True, text=True, timeout=20
    )
    lines = r.stdout.strip().split('\n')
    status_code = int(lines[-1]) if lines and lines[-1].isdigit() else 0
    body = '\n'.join(lines[:-1])
    return status_code, body

def test_ready_endpoint_exists():
    """/ready must respond with 200 or 503 (not 404)."""
    status, body = _curl_worker('/ready')
    assert status in (200, 503), f"Expected 200 or 503, got {status}: {body}"

def test_ready_returns_json_with_checks():
    """/ready must return JSON with 'ready' boolean and 'checks' dict."""
    status, body = _curl_worker('/ready')
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        assert False, f"Response is not JSON: {body}"
    assert 'ready' in data, f"Missing 'ready' key: {data}"
    assert 'checks' in data, f"Missing 'checks' key: {data}"
    assert isinstance(data['checks'], dict), f"'checks' must be a dict: {data}"

def test_ready_checks_include_required_deps():
    """/ready checks must include chromadb, postgres, ollama."""
    status, body = _curl_worker('/ready')
    data = json.loads(body)
    checks = data.get('checks', {})
    for dep in ('chromadb', 'postgres', 'ollama'):
        assert dep in checks, f"Missing '{dep}' in checks: {checks}"

def test_ready_status_code_matches_checks():
    """/ready must return 200 when all checks pass, 503 when any fail."""
    status, body = _curl_worker('/ready')
    data = json.loads(body)
    all_up = all(v is True for v in data.get('checks', {}).values())
    if all_up:
        assert status == 200, f"Expected 200 when all checks pass, got {status}"
    else:
        assert status == 503, f"Expected 503 when a dep is down, got {status}"
