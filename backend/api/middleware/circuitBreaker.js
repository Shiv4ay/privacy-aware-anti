// backend/api/middleware/circuitBreaker.js
'use strict';

const CircuitBreaker = require('opossum');

const DEFAULT_OPTIONS = {
    timeout: 30000,                  // 30s — Ollama CPU can be slow
    errorThresholdPercentage: 50,    // open after 50% of calls fail
    resetTimeout: 60000,             // try half-open after 60s
    volumeThreshold: 5,              // need >= 5 calls before computing error %
};

/**
 * Factory: create a circuit breaker wrapping `fn`.
 * @param {Function} fn - async function to protect
 * @param {object} [opts] - opossum options (override defaults)
 * @returns {CircuitBreaker}
 */
function makeWorkerCircuit(fn, opts = {}) {
    const options = { ...DEFAULT_OPTIONS, ...opts };
    const circuit = new CircuitBreaker(fn, options);
    circuit.fallback(workerFallback);

    circuit.on('open',     () => console.error('[CircuitBreaker] OPEN — worker calls fast-failing'));
    circuit.on('halfOpen', () => console.warn('[CircuitBreaker] HALF-OPEN — testing worker'));
    circuit.on('close',    () => console.log('[CircuitBreaker] CLOSED — worker recovered'));

    return circuit;
}

/**
 * Fallback when circuit is open or the protected fn throws.
 */
function workerFallback(err) {
    return {
        status: 503,
        error: 'AI worker temporarily unavailable. Please retry in a moment.',
        detail: err?.message || 'circuit open',
    };
}

module.exports = { makeWorkerCircuit, workerFallback };
