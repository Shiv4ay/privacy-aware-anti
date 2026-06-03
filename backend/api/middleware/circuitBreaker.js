// backend/api/middleware/circuitBreaker.js
'use strict';

const CircuitBreaker = require('opossum');
const { logger } = require('./logger');

const DEFAULT_OPTIONS = {
    timeout: 240000,                 // 240s — bulk test: Ollama CPU can take 90-180s under load
    errorThresholdPercentage: 60,    // open after 60% of calls fail (less aggressive)
    resetTimeout: 30000,             // try half-open after 30s (faster recovery)
    volumeThreshold: 5,              // need >= 5 calls before computing error %
};

/**
 * Fallback when circuit is open or the protected fn throws.
 */
function workerFallback(err) {
    return {
        __circuitOpen: true,
        status: 503,
        error: 'AI worker temporarily unavailable. Please retry in a moment.',
        detail: err?.message || 'circuit open',
    };
}

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

    circuit.on('open',     () => logger.error('CircuitBreaker OPEN — worker calls fast-failing'));
    circuit.on('halfOpen', () => logger.warn('CircuitBreaker HALF-OPEN — testing worker'));
    circuit.on('close',    () => logger.info('CircuitBreaker CLOSED — worker recovered'));

    return circuit;
}

module.exports = { makeWorkerCircuit, workerFallback };
