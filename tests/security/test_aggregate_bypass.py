"""
Tests that the magic-string aggregate bypass has been removed from app.py.
Previously: _is_aggregate_ctx could be set by any context starting with
"ADMIN STATISTICS RECORD:" — allowing PII redaction bypass via crafted input.
Fix: rely only on the is_aggregate_context boolean parameter.
"""
import subprocess


def test_magic_string_not_in_worker():
    """The ADMIN STATISTICS RECORD magic string bypass must not exist as a check in app.py"""
    result = subprocess.run(
        ['docker', 'exec', 'privacy-aware-worker', 'grep', '-n',
         'normalized_context.lstrip().startswith', '/app/app.py'],
        capture_output=True, text=True, timeout=15
    )
    assert result.returncode != 0, (
        f"Magic string startswith check still in app.py at: {result.stdout}"
    )


def test_is_aggregate_ctx_no_or_chain():
    """_is_aggregate_ctx must be assigned directly from boolean, not OR-chained with string check"""
    result = subprocess.run(
        ['docker', 'exec', 'privacy-aware-worker', 'python', '-c',
         "src = open('/app/app.py').read()\n"
         "bad = any(('startswith' in l or 'ADMIN STATISTICS' in l)\n"
         "          for l in src.splitlines()\n"
         "          if '_is_aggregate_ctx' in l and '=' in l and 'def ' not in l)\n"
         "print('BUG: magic string in aggregate check' if bad else 'OK: no magic string in aggregate context check')\n"
         "import sys; sys.exit(1 if bad else 0)\n"],
        capture_output=True, text=True, timeout=15
    )
    assert 'OK' in result.stdout, f"Aggregate bypass bug: {result.stdout} {result.stderr}"


def test_aggregate_bypass_pattern_removed():
    """Verify the exact bypass pattern `or normalized_context.lstrip().startswith` is gone"""
    result = subprocess.run(
        ['docker', 'exec', 'privacy-aware-worker', 'grep', '-c',
         'or normalized_context', '/app/app.py'],
        capture_output=True, text=True, timeout=15
    )
    count = int(result.stdout.strip()) if result.stdout.strip().isdigit() else 0
    assert count == 0, f"Found {count} occurrences of 'or normalized_context' in app.py"
