"""Response feedback endpoint tests."""
import subprocess
import json


def _run_in_api(js):
    r = subprocess.run(
        ['docker', 'exec', 'privacy-aware-api', 'node', '-e', js],
        capture_output=True, text=True, timeout=15
    )
    return r


def test_post_feedback_up_succeeds():
    """POST /api/feedback with rating='up' must return 201."""
    js = """
const http = require('http');
const body = JSON.stringify({query_hash: 'abc123def456', rating: 'up', comment: 'helpful'});
const req = http.request({
  hostname: 'localhost', port: 3001, path: '/api/feedback',
  method: 'POST',
  headers: {'Content-Type':'application/json','Content-Length':body.length,
            'x-dev-auth':'super-secret-dev-key','x-csrf-token':'bypass'}
}, res => {
  let d=''; res.on('data',c=>d+=c);
  res.on('end', () => {
    if (res.statusCode !== 201) { console.error('STATUS', res.statusCode, d); process.exit(1); }
    const j = JSON.parse(d);
    if (!j.id) { console.error('NO id', d); process.exit(1); }
    console.log('PASS');
  });
}); req.on('error',e=>{console.error(e.message);process.exit(1)}); req.write(body); req.end();
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and 'PASS' in r.stdout, f"FAIL: {r.stdout} {r.stderr}"


def test_post_feedback_down_succeeds():
    """POST /api/feedback with rating='down' must return 201."""
    js = """
const http = require('http');
const body = JSON.stringify({query_hash: 'xyz789', rating: 'down'});
const req = http.request({
  hostname: 'localhost', port: 3001, path: '/api/feedback',
  method: 'POST',
  headers: {'Content-Type':'application/json','Content-Length':body.length,
            'x-dev-auth':'super-secret-dev-key','x-csrf-token':'bypass'}
}, res => {
  let d=''; res.on('data',c=>d+=c);
  res.on('end', () => {
    if (res.statusCode !== 201) { console.error('STATUS', res.statusCode, d); process.exit(1); }
    console.log('PASS');
  });
}); req.on('error',e=>{console.error(e.message);process.exit(1)}); req.write(body); req.end();
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and 'PASS' in r.stdout, f"FAIL: {r.stdout} {r.stderr}"


def test_post_feedback_invalid_rating_rejected():
    """POST /api/feedback with invalid rating must return 400."""
    js = """
const http = require('http');
const body = JSON.stringify({query_hash: 'abc', rating: 'meh'});
const req = http.request({
  hostname: 'localhost', port: 3001, path: '/api/feedback',
  method: 'POST',
  headers: {'Content-Type':'application/json','Content-Length':body.length,
            'x-dev-auth':'super-secret-dev-key','x-csrf-token':'bypass'}
}, res => {
  let d=''; res.on('data',c=>d+=c);
  res.on('end', () => {
    if (res.statusCode !== 400) { console.error('EXPECTED 400 got', res.statusCode, d); process.exit(1); }
    console.log('PASS');
  });
}); req.on('error',e=>{console.error(e.message);process.exit(1)}); req.write(body); req.end();
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and 'PASS' in r.stdout, f"FAIL: {r.stdout} {r.stderr}"


def test_admin_feedback_stats_returns_shape():
    """GET /api/admin/feedback/stats must return counts and ratio."""
    js = """
const http = require('http');
http.get({
  hostname: 'localhost', port: 3001, path: '/api/admin/feedback/stats',
  headers: {'x-dev-auth': 'super-secret-dev-key'}
}, res => {
  let d=''; res.on('data',c=>d+=c);
  res.on('end', () => {
    if (res.statusCode !== 200) { console.error('STATUS', res.statusCode, d); process.exit(1); }
    const j = JSON.parse(d);
    for (const key of ['total', 'thumbs_up', 'thumbs_down', 'recent']) {
      if (!(key in j)) { console.error('MISSING', key, d); process.exit(1); }
    }
    console.log('PASS');
  });
}).on('error', e => { console.error(e.message); process.exit(1); });
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and 'PASS' in r.stdout, f"FAIL: {r.stdout} {r.stderr}"


def test_admin_stats_no_auth_rejected():
    """GET /api/admin/feedback/stats without auth must return 401 or 403."""
    js = """
const http = require('http');
http.get({
  hostname: 'localhost', port: 3001, path: '/api/admin/feedback/stats',
}, res => {
  let d=''; res.on('data',c=>d+=c);
  res.on('end', () => {
    if (![401, 403].includes(res.statusCode)) {
      console.error('EXPECTED 401 or 403 got', res.statusCode, d); process.exit(1);
    }
    console.log('PASS');
  });
}).on('error', e => { console.error(e.message); process.exit(1); });
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and 'PASS' in r.stdout, f"FAIL: {r.stdout} {r.stderr}"
