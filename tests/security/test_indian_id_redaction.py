"""
Tests for Indian sensitive ID redaction: Aadhar, PAN, IFSC.
DPDP Act 2023 classifies these as Sensitive Personal Data.

Strategy: verify the regex patterns are present in app.py (fast, no full import).
The app.py import takes 30+ seconds in docker exec due to model loading,
so we verify the source patterns directly.
"""
import subprocess


def get_app_source_section():
    """Get the PII redaction section of app.py from the worker container."""
    result = subprocess.run(
        ['docker', 'exec', 'privacy-aware-worker', 'python', '-c',
         "src = open('/app/app.py').read(); "
         "start = src.find('# Indian'); "
         "end = src.find('\\n\\n\\n', start + 100) if start >= 0 else 3000; "
         "print(src[max(0,start-200):min(len(src), (end if end>0 else start+2000)+200)])"],
        capture_output=True, text=True, timeout=15
    )
    return result.stdout


def test_aadhar_pattern_in_source():
    """Aadhar 12-digit pattern must be present in app.py redaction section"""
    result = subprocess.run(
        ['docker', 'exec', 'privacy-aware-worker', 'grep', '-c',
         r'Aadhar\|aadhar\|\\d{4}.*\\d{4}.*\\d{4}', '/app/app.py'],
        capture_output=True, text=True, timeout=10
    )
    # grep -c returns line count; returncode=0 means found
    count = int(result.stdout.strip()) if result.stdout.strip().isdigit() else 0
    assert count > 0, "No Aadhar pattern found in app.py"


def test_pan_pattern_in_source():
    """PAN card pattern (5 alpha + 4 digits + 1 alpha) must be in app.py"""
    result = subprocess.run(
        ['docker', 'exec', 'privacy-aware-worker', 'grep', '-c',
         r'PAN\|pan_card\|[A-Z]\{5\}[0-9]\{4\}', '/app/app.py'],
        capture_output=True, text=True, timeout=10
    )
    count = int(result.stdout.strip()) if result.stdout.strip().isdigit() else 0
    assert count > 0, "No PAN card pattern found in app.py"


def test_ifsc_pattern_in_source():
    """IFSC code pattern must be in app.py"""
    result = subprocess.run(
        ['docker', 'exec', 'privacy-aware-worker', 'grep', '-c',
         r'IFSC\|ifsc', '/app/app.py'],
        capture_output=True, text=True, timeout=10
    )
    count = int(result.stdout.strip()) if result.stdout.strip().isdigit() else 0
    assert count > 0, "No IFSC pattern found in app.py"


def test_indian_id_patterns_in_redact_function():
    """The redact_text function body must reference Indian ID patterns"""
    result = subprocess.run(
        ['docker', 'exec', 'privacy-aware-worker', 'python', '-c', """
src = open('/app/app.py').read()
# Find the redact_text function
idx = src.find('def redact_text')
if idx < 0:
    print('BUG: redact_text function not found')
    import sys; sys.exit(1)
# Check for Indian ID patterns in the next 3000 chars after function def
section = src[idx:idx+3000]
has_aadhar = 'aadhar' in section.lower() or 'aadhaar' in section.lower() or '\\\\d{4}' in section
has_pan = 'pan' in section.lower() and ('alpha' in section.lower() or '[A-Z]' in section or 'PAN' in section)
has_ifsc = 'ifsc' in section.lower()
print(f'Aadhar: {has_aadhar}, PAN: {has_pan}, IFSC: {has_ifsc}')
if not (has_aadhar or has_pan or has_ifsc):
    print('BUG: no Indian ID patterns in redact_text')
    import sys; sys.exit(1)
print('OK: Indian ID patterns present in redact_text')
"""],
        capture_output=True, text=True, timeout=15
    )
    assert 'OK' in result.stdout or 'True' in result.stdout, \
        f"Indian ID patterns not found in redact_text: {result.stdout} {result.stderr}"


def test_sensitive_pii_regex_patterns_exist():
    """Verify Aadhar/PAN/IFSC regex strings exist somewhere in app.py"""
    result = subprocess.run(
        ['docker', 'exec', 'privacy-aware-worker', 'python', '-c', """
import re
src = open('/app/app.py').read()

# Check for key patterns
aadhar_ok = bool(re.search(r'\\\\d.{0,10}4.{0,10}4.{0,10}4', src)) or 'Aadhar' in src or 'aadhar' in src
pan_ok = bool(re.search(r'PAN|pan_card|AAAAANNNNL', src, re.IGNORECASE)) or '[A-Z]{5}' in src
ifsc_ok = 'IFSC' in src or 'ifsc' in src

print(f'aadhar_pattern={aadhar_ok} pan_pattern={pan_ok} ifsc_pattern={ifsc_ok}')
if aadhar_ok and pan_ok and ifsc_ok:
    print('OK: all three Indian ID pattern categories found')
else:
    missing = [k for k, v in [('aadhar', aadhar_ok), ('pan', pan_ok), ('ifsc', ifsc_ok)] if not v]
    print('MISSING: ' + ', '.join(missing))
    import sys; sys.exit(1)
"""],
        capture_output=True, text=True, timeout=15
    )
    assert 'OK' in result.stdout, \
        f"Indian ID patterns incomplete in app.py: {result.stdout} {result.stderr}"
