"""
Tests for admin.js and index.js bug fixes.
Covers: filePath crash, audit_log table name, UUID session invalidation,
UUID cast error in audit filter, pagination cap, SQL interpolation, DEBUG logs.
All tests run inside the Docker container via docker exec.
"""
import subprocess


def run_js(code):
    result = subprocess.run(
        ['docker', 'exec', 'privacy-aware-api', 'node', '-e', code],
        capture_output=True, text=True, timeout=30
    )
    return result.stdout, result.stderr


def test_file_upload_no_bare_filepath():
    """index.js must use req.file.path, not bare undefined filePath in unlinkSync calls"""
    stdout, stderr = run_js("""
const fs = require('fs');
const src = fs.readFileSync('/app/index.js', 'utf8');
const lines = src.split('\\n');
let bugFound = false;
lines.forEach((line, i) => {
  if (/fs\\.unlinkSync\\s*\\(\\s*filePath\\s*\\)/.test(line)) {
    bugFound = true;
    console.log('BUG at line ' + (i+1) + ': ' + line.trim());
  }
});
if (bugFound) {
  process.exit(1);
} else {
  console.log('OK: no bare filePath in unlinkSync calls');
}
""")
    assert 'OK' in stdout, f"filePath bug still present: {stdout} {stderr}"


def test_no_debug_console_logs():
    """index.js must not contain [DEBUG] console.log middleware"""
    stdout, stderr = run_js("""
const fs = require('fs');
const src = fs.readFileSync('/app/index.js', 'utf8');
const debugLines = src.split('\\n').filter(l => l.includes('[DEBUG]'));
if (debugLines.length > 0) {
  console.log('BUG: ' + debugLines.length + ' [DEBUG] lines found');
  debugLines.forEach(l => console.log('  ' + l.trim()));
  process.exit(1);
}
console.log('OK: no [DEBUG] lines in index.js');
""")
    assert 'OK' in stdout, f"DEBUG logs still present: {stdout}"


def test_audit_log_table_name_correct():
    """admin.js must use audit_logs (plural) in all INSERT statements"""
    stdout, stderr = run_js("""
const fs = require('fs');
const src = fs.readFileSync('/app/routes/admin.js', 'utf8');
const matches = src.match(/INSERT INTO audit_log[^s]/g);
if (matches && matches.length > 0) {
  console.log('BAD: found ' + matches.length + ' wrong table refs: ' + JSON.stringify(matches));
  process.exit(1);
} else {
  console.log('OK: all audit log inserts use audit_logs');
}
""")
    assert 'OK' in stdout, f"Wrong table name found: {stdout}"


def test_session_invalidation_uses_uuid_lookup():
    """admin.js must SELECT user_id FROM users to get UUID before updating auth_sessions"""
    stdout, stderr = run_js("""
const fs = require('fs');
const src = fs.readFileSync('/app/routes/admin.js', 'utf8');
// Count occurrences of UUID lookup pattern
const matches = src.match(/SELECT user_id FROM users WHERE id/g);
const count = matches ? matches.length : 0;
// Suspend (1) + role change (1) + status toggle (1) = at least 3
if (count < 3) {
  console.log('BUG: only ' + count + ' UUID lookups found, need at least 3');
  process.exit(1);
}
console.log('OK: ' + count + ' UUID lookups before session invalidation');
""")
    assert 'OK' in stdout, f"UUID lookup missing: {stdout}"


def test_audit_filter_no_parseint_uuid():
    """audit-logs filter must NOT call parseInt on userId (UUID)"""
    stdout, stderr = run_js("""
const fs = require('fs');
const src = fs.readFileSync('/app/routes/admin.js', 'utf8');
const lines = src.split('\\n');
let bugFound = false;
lines.forEach((line, i) => {
  if (line.includes('parseInt(userId)') && line.includes('params.push')) {
    bugFound = true;
    console.log('BUG at line ' + (i+1) + ': ' + line.trim());
  }
});
if (bugFound) { process.exit(1); }
console.log('OK: no parseInt on userId in params.push');
""")
    assert 'OK' in stdout, f"UUID parseInt bug still present: {stdout}"


def test_documents_list_pagination_cap():
    """Documents list must cap limit at 200 using Math.min"""
    stdout, stderr = run_js("""
const fs = require('fs');
const src = fs.readFileSync('/app/routes/admin.js', 'utf8');
const hasCap = src.includes('Math.min(200') && src.includes('req.query.limit');
if (!hasCap) {
  console.log('BUG: no Math.min(200, ...) cap on documents limit');
  process.exit(1);
}
console.log('OK: pagination cap present');
""")
    assert 'OK' in stdout, f"Pagination cap missing: {stdout}"


def test_system_stats_no_string_interpolation():
    """system-stats must use parameterized queries, not template literal orgId interpolation"""
    stdout, stderr = run_js("""
const fs = require('fs');
const src = fs.readFileSync('/app/routes/admin.js', 'utf8');
const systemStatsIdx = src.indexOf('/system-stats');
if (systemStatsIdx === -1) {
  console.log('SKIP: system-stats route not found by path string');
  process.exit(0);
}
const section = src.slice(systemStatsIdx, systemStatsIdx + 2500);
const badInterpolation = /\\$\\{parseInt\\(orgId\\)\\}/.test(section);
if (badInterpolation) {
  console.log('BUG: string interpolation with orgId in system-stats');
  process.exit(1);
}
console.log('OK: no string interpolation in system-stats');
""")
    assert 'OK' in stdout, f"SQL interpolation bug: {stdout}"


def test_status_toggle_has_audit_log():
    """PATCH /users/:id/status handler must INSERT into audit_logs"""
    stdout, stderr = run_js("""
const fs = require('fs');
const src = fs.readFileSync('/app/routes/admin.js', 'utf8');
// Find status route and check nearby code for audit_logs insert
const idx = src.indexOf("users/:id/status");
if (idx === -1) {
  console.log('BUG: status route not found');
  process.exit(1);
}
const section = src.slice(idx, idx + 2000);
const hasAuditLog = section.includes('audit_logs') && section.includes('INSERT');
if (!hasAuditLog) {
  console.log('BUG: no audit_logs INSERT in status toggle handler section');
  process.exit(1);
}
console.log('OK: status toggle has audit log');
""")
    assert 'OK' in stdout, f"Status toggle audit log missing: {stdout}"
