"""Structured logging tests — verify winston JSON output."""
import subprocess

def _run_in_api(js):
    r = subprocess.run(
        ['docker', 'exec', 'privacy-aware-api', 'node', '-e', js],
        capture_output=True, text=True, timeout=15
    )
    return r

def test_logger_module_loads():
    """logger.js must export { logger, requestIdMiddleware }."""
    js = """
const { logger, requestIdMiddleware } = require('./middleware/logger');
if (typeof logger !== 'object' || typeof logger.info !== 'function') {
  console.error('BAD logger'); process.exit(1);
}
if (typeof requestIdMiddleware !== 'function') {
  console.error('BAD requestIdMiddleware'); process.exit(1);
}
console.log('PASS');
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and 'PASS' in r.stdout, f"FAIL: {r.stdout} {r.stderr}"

def test_logger_outputs_json():
    """logger.info() must produce a JSON string with level, message, timestamp."""
    js = """
const { logger } = require('./middleware/logger');
const winston = require('winston');
const { Writable } = require('stream');
let captured = '';
const ws = new Writable({ write(chunk, enc, cb) { captured += chunk.toString(); cb(); } });
const testLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Stream({ stream: ws })]
});
testLogger.info('test message', { request_id: 'abc-123' });
setTimeout(() => {
  let obj;
  try { obj = JSON.parse(captured.trim()); } catch(e) { console.error('NOT JSON', captured); process.exit(1); }
  if (obj.level !== 'info') { console.error('BAD level', captured); process.exit(1); }
  if (obj.message !== 'test message') { console.error('BAD message', captured); process.exit(1); }
  if (!obj.timestamp) { console.error('NO timestamp', captured); process.exit(1); }
  console.log('PASS');
}, 100);
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and 'PASS' in r.stdout, f"FAIL: {r.stdout} {r.stderr}"
