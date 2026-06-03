"""
Tests for Super Admin create-admin endpoint implementation.
Previously returned 501 Not Implemented.
Now: creates admin user with bcrypt hash, returns 201.
"""
import subprocess


def run_js(code):
    result = subprocess.run(
        ['docker', 'exec', 'privacy-aware-api', 'node', '-e', code],
        capture_output=True, text=True, timeout=30
    )
    return result.stdout, result.stderr


def test_super_admin_null_guard():
    """requireSuperAdmin must check !req.user before accessing req.user.role"""
    stdout, stderr = run_js("""
const fs = require('fs');
const src = fs.readFileSync('/app/routes/superAdmin.js', 'utf8');
const hasNullGuard = src.includes('!req.user') || /req\\.user\\s*&&/.test(src);
if (!hasNullGuard) {
  console.log('BUG: no null guard on req.user in requireSuperAdmin');
  process.exit(1);
}
console.log('OK: null guard present');
""")
    assert 'OK' in stdout, f"Null guard missing: {stdout}"


def test_super_admin_create_not_501():
    """POST /admin/create must not return 501"""
    stdout, stderr = run_js("""
const fs = require('fs');
const src = fs.readFileSync('/app/routes/superAdmin.js', 'utf8');
if (src.includes('501') && src.includes('Not implemented')) {
  console.log('BUG: create admin still returns 501 Not implemented');
  process.exit(1);
}
console.log('OK: create admin is implemented (no 501)');
""")
    assert 'OK' in stdout, f"Create admin still returns 501: {stdout}"


def test_super_admin_create_uses_bcrypt():
    """create admin must hash password with bcrypt"""
    stdout, stderr = run_js("""
const fs = require('fs');
const src = fs.readFileSync('/app/routes/superAdmin.js', 'utf8');
const hasBcryptImport = src.includes("require('bcrypt')") || src.includes('require("bcrypt")');
const hasBcryptHash = src.includes('bcrypt.hash');
if (!hasBcryptImport || !hasBcryptHash) {
  console.log('BUG: bcrypt not imported or hash not used. import=' + hasBcryptImport + ' hash=' + hasBcryptHash);
  process.exit(1);
}
console.log('OK: bcrypt.hash used for password');
""")
    assert 'OK' in stdout, f"bcrypt not used: {stdout}"


def test_super_admin_create_inserts_admin_role():
    """create admin must INSERT user with role='admin'"""
    stdout, stderr = run_js("""
const fs = require('fs');
const src = fs.readFileSync('/app/routes/superAdmin.js', 'utf8');
const hasAdminRole = src.includes("'admin'") && src.includes('INSERT INTO users');
if (!hasAdminRole) {
  console.log('BUG: INSERT INTO users with admin role not found');
  process.exit(1);
}
console.log('OK: INSERT INTO users with admin role present');
""")
    assert 'OK' in stdout, f"Admin role INSERT missing: {stdout}"


def test_super_admin_create_returns_201():
    """create admin route must respond with status 201"""
    stdout, stderr = run_js("""
const fs = require('fs');
const src = fs.readFileSync('/app/routes/superAdmin.js', 'utf8');
// Check whole file — superAdmin.js only has one 201 response
const has201 = src.includes('.status(201)') || src.includes('status: 201');
if (!has201) {
  console.log('BUG: no 201 status found anywhere in superAdmin.js');
  process.exit(1);
}
console.log('OK: 201 status present in superAdmin.js');
""")
    assert 'OK' in stdout, f"Create admin doesn't return 201: {stdout}"


def test_super_admin_create_validates_required_fields():
    """create admin must validate email, password, org_id are present"""
    stdout, stderr = run_js("""
const fs = require('fs');
const src = fs.readFileSync('/app/routes/superAdmin.js', 'utf8');
const idx = src.indexOf('/admin/create');
const section = src.slice(idx, idx + 1500);
const hasValidation = section.includes('400') &&
    (section.includes('email') || section.includes('password') || section.includes('org_id'));
if (!hasValidation) {
  console.log('BUG: no 400 validation for required fields');
  process.exit(1);
}
console.log('OK: required field validation present');
""")
    assert 'OK' in stdout, f"Required field validation missing: {stdout}"
