"""Circuit breaker tests."""
import subprocess

def _run_in_api(js):
    r = subprocess.run(
        ['docker', 'exec', 'privacy-aware-api', 'node', '-e', js],
        capture_output=True, text=True, timeout=15
    )
    return r

def test_circuit_breaker_module_loads():
    """circuitBreaker.js must export makeWorkerCircuit and workerFallback."""
    js = """
const { makeWorkerCircuit, workerFallback } = require('./middleware/circuitBreaker');
if (typeof makeWorkerCircuit !== 'function') { console.error('BAD makeWorkerCircuit'); process.exit(1); }
if (typeof workerFallback !== 'function') { console.error('BAD workerFallback'); process.exit(1); }
console.log('PASS');
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and 'PASS' in r.stdout, f"FAIL: {r.stdout} {r.stderr}"

def test_circuit_breaker_opens_on_failures():
    """Circuit must open after volumeThreshold failures."""
    js = """
const { makeWorkerCircuit } = require('./middleware/circuitBreaker');
const circuit = makeWorkerCircuit(async () => { throw new Error('worker down'); }, {
  timeout: 200, errorThresholdPercentage: 50, resetTimeout: 500, volumeThreshold: 3
});
let opened = false;
circuit.on('open', () => { opened = true; });
(async () => {
  for (let i = 0; i < 5; i++) {
    try { await circuit.fire(); } catch (_) {}
  }
  setTimeout(() => {
    if (!opened) { console.error('circuit did not open'); process.exit(1); }
    console.log('PASS');
  }, 200);
})();
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and 'PASS' in r.stdout, f"FAIL: {r.stdout} {r.stderr}"

def test_circuit_breaker_fallback_returns_503_shape():
    """workerFallback must return { status: 503, error: string }."""
    js = """
const { workerFallback } = require('./middleware/circuitBreaker');
const result = workerFallback(new Error('test error'));
if (result.status !== 503) { console.error('BAD status', result.status); process.exit(1); }
if (typeof result.error !== 'string') { console.error('BAD error type'); process.exit(1); }
console.log('PASS');
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and 'PASS' in r.stdout, f"FAIL: {r.stdout} {r.stderr}"
