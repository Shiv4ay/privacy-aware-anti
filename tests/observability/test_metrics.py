"""Prometheus metrics endpoint tests."""
import subprocess

def _run_in_api(js):
    r = subprocess.run(
        ['docker', 'exec', 'privacy-aware-api', 'node', '-e', js],
        capture_output=True, text=True, timeout=15
    )
    return r

def test_metrics_module_loads():
    """metrics.js must export { register, httpRequestDuration, httpRequestsTotal, metricsMiddleware }."""
    js = """
const { register, httpRequestDuration, httpRequestsTotal, metricsMiddleware } = require('./middleware/metrics');
if (!register || typeof register.metrics !== 'function') { console.error('BAD register'); process.exit(1); }
if (!httpRequestDuration) { console.error('BAD httpRequestDuration'); process.exit(1); }
if (!httpRequestsTotal) { console.error('BAD httpRequestsTotal'); process.exit(1); }
if (typeof metricsMiddleware !== 'function') { console.error('BAD metricsMiddleware'); process.exit(1); }
console.log('PASS');
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and 'PASS' in r.stdout, f"FAIL: {r.stdout} {r.stderr}"

def test_metrics_endpoint_returns_prometheus_format():
    """GET /metrics must return 200 with Content-Type text/plain and Prometheus format."""
    js = """
const http = require('http');
http.get({
  hostname: 'localhost', port: 3001, path: '/metrics',
  headers: { 'x-dev-auth': 'super-secret-dev-key' }
}, res => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => {
    if (res.statusCode !== 200) { console.error('STATUS', res.statusCode, d.slice(0, 200)); process.exit(1); }
    const ct = res.headers['content-type'] || '';
    if (!ct.includes('text/plain')) { console.error('BAD content-type', ct); process.exit(1); }
    if (!d.includes('# HELP') || !d.includes('# TYPE')) { console.error('NOT PROMETHEUS FORMAT', d.slice(0, 300)); process.exit(1); }
    console.log('PASS');
  });
}).on('error', e => { console.error(e.message); process.exit(1); });
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and 'PASS' in r.stdout, f"FAIL: {r.stdout} {r.stderr}"

def test_metrics_contains_http_request_counter():
    """Prometheus output must contain http_requests_total metric."""
    js = """
const http = require('http');
http.get({
  hostname: 'localhost', port: 3001, path: '/metrics',
  headers: { 'x-dev-auth': 'super-secret-dev-key' }
}, res => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => {
    if (!d.includes('http_requests_total')) { console.error('MISSING http_requests_total'); process.exit(1); }
    console.log('PASS');
  });
}).on('error', e => { console.error(e.message); process.exit(1); });
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and 'PASS' in r.stdout, f"FAIL: {r.stdout} {r.stderr}"
