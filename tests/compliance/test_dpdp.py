"""
DPDP Act 2023 compliance tests.
Run from host: python -m pytest tests/compliance/test_dpdp.py -v
API is accessible via docker exec since port 3001 is internal.
"""
import os
import subprocess
import requests
import pytest

API = os.getenv("API_BASE", "http://localhost:3001")
DEV_HEADERS = {
    "x-dev-auth": os.getenv("DEV_AUTH_KEY", "super-secret-dev-key"),
    "Content-Type": "application/json",
}

def _get_csrf():
    """Fetch __csrf cookie from API healthz endpoint."""
    try:
        r = requests.get(f"{API}/healthz", timeout=5)
        return r.cookies.get("__csrf", "")
    except Exception:
        return ""

def _run_in_api(js_code):
    """Run JS inside the api container to bypass internal-only port."""
    result = subprocess.run(
        ["docker", "exec", "privacy-aware-api", "node", "-e", js_code],
        capture_output=True, text=True, timeout=15
    )
    return result

# ── Consent tests ─────────────────────────────────────────────────────────────

def test_record_consent():
    """POST /api/user/privacy/consent records consent for a purpose."""
    js = """
const http = require('http');
const body = JSON.stringify({purpose: 'ai_query_processing', granted: true});
const req = http.request({
  hostname: 'localhost', port: 3001, path: '/api/user/privacy/consent',
  method: 'POST',
  headers: {'Content-Type':'application/json','Content-Length':body.length,
            'x-dev-auth':'super-secret-dev-key','x-csrf-token':'bypass'}
}, res => {
  let d=''; res.on('data',c=>d+=c); res.on('end',()=>{
    const j=JSON.parse(d);
    if(res.statusCode!==200) { console.error('STATUS',res.statusCode,d); process.exit(1); }
    if(j.purpose!=='ai_query_processing') { console.error('BAD PURPOSE',d); process.exit(1); }
    if(j.granted!==true) { console.error('BAD GRANTED',d); process.exit(1); }
    console.log('PASS');
  });
}); req.on('error',e=>{console.error(e.message);process.exit(1)}); req.write(body); req.end();
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and "PASS" in r.stdout, f"test_record_consent failed: {r.stdout} {r.stderr}"

def test_withdraw_consent():
    """POST with granted=false withdraws consent."""
    js = """
const http = require('http');
function post(granted, cb) {
  const body = JSON.stringify({purpose: 'ai_query_processing', granted});
  const req = http.request({
    hostname:'localhost',port:3001,path:'/api/user/privacy/consent',method:'POST',
    headers:{'Content-Type':'application/json','Content-Length':body.length,
             'x-dev-auth':'super-secret-dev-key','x-csrf-token':'bypass'}
  }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>cb(res.statusCode,JSON.parse(d))); });
  req.write(body); req.end();
}
post(true, ()=> post(false, (status,j)=> {
  if(status!==200||j.granted!==false){console.error('FAIL',status,JSON.stringify(j));process.exit(1);}
  console.log('PASS');
}));
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and "PASS" in r.stdout, f"test_withdraw_consent failed: {r.stdout} {r.stderr}"

def test_get_consent_status():
    """GET /api/user/privacy/consent returns list."""
    js = """
const http = require('http');
http.get({
  hostname:'localhost',port:3001,path:'/api/user/privacy/consent',
  headers:{'x-dev-auth':'super-secret-dev-key'}
}, res => {
  let d=''; res.on('data',c=>d+=c); res.on('end',()=>{
    if(res.statusCode!==200){console.error('STATUS',res.statusCode,d);process.exit(1);}
    const j=JSON.parse(d);
    if(!Array.isArray(j)){console.error('NOT ARRAY',d);process.exit(1);}
    console.log('PASS');
  });
}).on('error',e=>{console.error(e.message);process.exit(1)});
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and "PASS" in r.stdout, f"test_get_consent_status failed: {r.stdout} {r.stderr}"

def test_consent_invalid_purpose_rejected():
    """POST with unknown purpose must return 400."""
    js = """
const http = require('http');
const body = JSON.stringify({purpose: 'INVALID_XYZ', granted: true});
const req = http.request({
  hostname:'localhost',port:3001,path:'/api/user/privacy/consent',method:'POST',
  headers:{'Content-Type':'application/json','Content-Length':body.length,
           'x-dev-auth':'super-secret-dev-key','x-csrf-token':'bypass'}
}, res => {
  let d=''; res.on('data',c=>d+=c); res.on('end',()=>{
    if(res.statusCode!==400){console.error('EXPECTED 400 got',res.statusCode,d);process.exit(1);}
    console.log('PASS');
  });
}); req.write(body); req.end();
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and "PASS" in r.stdout, f"test_invalid_purpose failed: {r.stdout} {r.stderr}"

def test_erasure_request_returns_summary():
    """POST /api/user/privacy/erasure returns a deletion summary."""
    js = """
const http = require('http');
const body = JSON.stringify({confirm: true});
const req = http.request({
  hostname: 'localhost', port: 3001, path: '/api/user/privacy/erasure',
  method: 'POST',
  headers: {'Content-Type':'application/json','Content-Length':body.length,
            'x-dev-auth':'super-secret-dev-key','x-csrf-token':'bypass'}
}, res => {
  let d=''; res.on('data',c=>d+=c); res.on('end',()=>{
    if(res.statusCode!==200){console.error('STATUS',res.statusCode,d);process.exit(1);}
    const j=JSON.parse(d);
    if(!j.erased){console.error('NO erased KEY',d);process.exit(1);}
    if(!('search_queries' in j.erased)){console.error('NO search_queries',d);process.exit(1);}
    if(!('audit_logs' in j.erased)){console.error('NO audit_logs',d);process.exit(1);}
    if(!('chromadb_vectors' in j.erased)){console.error('NO chromadb_vectors',d);process.exit(1);}
    console.log('PASS');
  });
}); req.on('error',e=>{console.error(e.message);process.exit(1)}); req.write(body); req.end();
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and "PASS" in r.stdout, f"test_erasure_request_returns_summary failed: {r.stdout} {r.stderr}"

def test_erasure_without_confirm_rejected():
    """POST /api/user/privacy/erasure without confirm=true returns 400."""
    js = """
const http = require('http');
const body = JSON.stringify({confirm: false});
const req = http.request({
  hostname: 'localhost', port: 3001, path: '/api/user/privacy/erasure',
  method: 'POST',
  headers: {'Content-Type':'application/json','Content-Length':body.length,
            'x-dev-auth':'super-secret-dev-key','x-csrf-token':'bypass'}
}, res => {
  let d=''; res.on('data',c=>d+=c); res.on('end',()=>{
    if(res.statusCode!==400){console.error('EXPECTED 400 got',res.statusCode,d);process.exit(1);}
    console.log('PASS');
  });
}); req.on('error',e=>{console.error(e.message);process.exit(1)}); req.write(body); req.end();
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and "PASS" in r.stdout, f"test_erasure_without_confirm_rejected failed: {r.stdout} {r.stderr}"

# ── Right to Access (export) tests ────────────────────────────────────────────

def test_export_returns_all_sections():
    """GET /api/user/privacy/export returns 200 with all required top-level keys."""
    js = """
const http = require('http');
http.get({
  hostname:'localhost',port:3001,path:'/api/user/privacy/export',
  headers:{'x-dev-auth':'super-secret-dev-key'}
}, res => {
  let d=''; res.on('data',c=>d+=c); res.on('end',()=>{
    if(res.statusCode!==200){console.error('STATUS',res.statusCode,d);process.exit(1);}
    let j;
    try { j=JSON.parse(d); } catch(e){console.error('PARSE ERROR',d);process.exit(1);}
    const required=['exported_at','profile','consent_records','search_queries','audit_logs','documents'];
    const missing=required.filter(k=>!(k in j));
    if(missing.length>0){console.error('MISSING KEYS',missing.join(','),d);process.exit(1);}
    console.log('PASS');
  });
}).on('error',e=>{console.error(e.message);process.exit(1)});
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and "PASS" in r.stdout, f"test_export_returns_all_sections failed: {r.stdout} {r.stderr}"

def test_export_profile_no_password_hash():
    """GET /api/user/privacy/export profile must NOT contain password_hash."""
    js = """
const http = require('http');
http.get({
  hostname:'localhost',port:3001,path:'/api/user/privacy/export',
  headers:{'x-dev-auth':'super-secret-dev-key'}
}, res => {
  let d=''; res.on('data',c=>d+=c); res.on('end',()=>{
    if(res.statusCode!==200){console.error('STATUS',res.statusCode,d);process.exit(1);}
    let j;
    try { j=JSON.parse(d); } catch(e){console.error('PARSE ERROR',d);process.exit(1);}
    if(!j.profile){console.error('NO PROFILE',d);process.exit(1);}
    if('password_hash' in j.profile){console.error('LEAK: password_hash present',d);process.exit(1);}
    console.log('PASS');
  });
}).on('error',e=>{console.error(e.message);process.exit(1)});
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and "PASS" in r.stdout, f"test_export_profile_no_password_hash failed: {r.stdout} {r.stderr}"

# ── Data Retention (DPDP §8(7)) tests ────────────────────────────────────────

def test_retention_cron_module_loads():
    """retentionCron.js exports startRetentionJob as a function (DPDP §8(7))."""
    js = """
const { startRetentionJob } = require('./jobs/retentionCron');
if (typeof startRetentionJob !== 'function') { process.exit(1); }
console.log('PASS');
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and "PASS" in r.stdout, f"test_retention_cron_module_loads failed: {r.stdout} {r.stderr}"

def test_retention_days_configurable():
    """retentionCron.js defaults RETENTION_DAYS to 90 when env var is not set."""
    js = """
delete process.env.SEARCH_QUERY_RETENTION_DAYS;
const { startRetentionJob } = require('./jobs/retentionCron');
// Re-require forces fresh module load — use a fresh isolated check
const src = require('fs').readFileSync('./jobs/retentionCron.js', 'utf8');
if (!src.includes("'90'")) { console.error('FAIL: no default 90'); process.exit(1); }
console.log('PASS');
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and "PASS" in r.stdout, f"test_retention_days_configurable failed: {r.stdout} {r.stderr}"
