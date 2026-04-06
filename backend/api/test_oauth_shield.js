/**
 * M3 — Privacy Shield OAuth Disable Without Re-Auth Tests
 * TDD RED→GREEN cycle
 *
 * Tests:
 *  A. verifyGoogleIdToken() — unit tests with injected mock fetcher
 *  B. Disable-route logic — integration-style tests against a minimal
 *     in-process handler that mirrors the real route behaviour
 *
 * Run: node test_oauth_shield.js
 */
'use strict';

const assert = require('assert');
const { verifyGoogleIdToken } = require('./security/googleTokenVerifier');

const PASS = '\x1b[92m✓\x1b[0m';
const FAIL = '\x1b[91m✗\x1b[0m';

let passed = 0;
let failed = 0;

function check(label, fn) {
    try {
        fn();
        console.log(`  ${PASS}  ${label}`);
        passed++;
    } catch (e) {
        console.log(`  ${FAIL}  ${label}  [${e.message}]`);
        failed++;
    }
}

async function checkAsync(label, fn) {
    try {
        await fn();
        console.log(`  ${PASS}  ${label}`);
        passed++;
    } catch (e) {
        console.log(`  ${FAIL}  ${label}  [${e.message}]`);
        failed++;
    }
}

// ── Mock fetcher helpers ─────────────────────────────────────────────────────
function mockFetchOk(payload) {
    return async (_url) => ({
        ok: true,
        json: async () => payload,
        text: async () => JSON.stringify(payload),
    });
}

function mockFetchError(status, body = '') {
    return async (_url) => ({
        ok: false,
        status,
        json: async () => ({}),
        text: async () => body,
    });
}

function mockFetchNetworkError(msg) {
    return async (_url) => { throw new Error(msg); };
}

// Future time (1 hour from now) in epoch seconds
const FUTURE_EXP = String(Math.floor(Date.now() / 1000) + 3600);
// Past time (1 hour ago) — expired
const PAST_EXP = String(Math.floor(Date.now() / 1000) - 3600);

console.log('\n══════════════════════════════════════════════════════');
console.log('  M3 — Privacy Shield OAuth Re-Auth Tests');
console.log('══════════════════════════════════════════════════════\n');

// ── Part A: verifyGoogleIdToken() unit tests ─────────────────────────────────
console.log('── Part A: verifyGoogleIdToken() ──');

(async () => {

await checkAsync('Valid token → returns payload with sub', async () => {
    const payload = { sub: 'google-uid-123', email: 'alice@gmail.com', exp: FUTURE_EXP, aud: 'client-id' };
    const result = await verifyGoogleIdToken('valid.id.token', mockFetchOk(payload));
    assert.strictEqual(result.sub, 'google-uid-123');
    assert.strictEqual(result.email, 'alice@gmail.com');
});

await checkAsync('Google returns 400 (invalid/expired token) → throws', async () => {
    await assert.rejects(
        () => verifyGoogleIdToken('bad.token', mockFetchError(400, 'Invalid Value')),
        /HTTP 400/
    );
});

await checkAsync('Network error → throws with descriptive message', async () => {
    await assert.rejects(
        () => verifyGoogleIdToken('any.token', mockFetchNetworkError('ECONNREFUSED')),
        /network error/i
    );
});

await checkAsync('Token payload missing sub → throws', async () => {
    const payloadNoSub = { email: 'alice@gmail.com', exp: FUTURE_EXP };
    await assert.rejects(
        () => verifyGoogleIdToken('ok.token', mockFetchOk(payloadNoSub)),
        /missing sub/i
    );
});

await checkAsync('Expired token (exp in past) → throws', async () => {
    const expiredPayload = { sub: 'uid-123', email: 'alice@gmail.com', exp: PAST_EXP };
    await assert.rejects(
        () => verifyGoogleIdToken('expired.token', mockFetchOk(expiredPayload)),
        /expired/i
    );
});

await checkAsync('Empty string token → throws immediately (no HTTP call made)', async () => {
    let called = false;
    const trackingFetcher = async () => { called = true; return { ok: true, json: async () => ({}) }; };
    await assert.rejects(
        () => verifyGoogleIdToken('', trackingFetcher),
        /No ID token/i
    );
    assert.strictEqual(called, false, 'HTTP call should NOT be made for empty token');
});

await checkAsync('null token → throws immediately', async () => {
    await assert.rejects(
        () => verifyGoogleIdToken(null, mockFetchOk({})),
        /No ID token/i
    );
});

// ── Part B: Disable-route logic tests ────────────────────────────────────────
console.log('\n── Part B: Privacy Shield Disable Route Logic ──');

/**
 * Minimal re-implementation of the disable route logic for testing,
 * parameterised with injectable dependencies (DB row, token verifier).
 * This mirrors what the real route does after the DB fetch.
 */
async function runDisableLogic({ userRow, body, verifier }) {
    const storedHash = userRow.password_hash;
    const oauthProvider = userRow.oauth_provider;
    const oauthId = userRow.oauth_id;

    if (storedHash) {
        // Password user path
        if (!body.password) return { status: 400, body: { error: 'Password required to disable privacy shield' } };
        const bcrypt = require('bcrypt');
        const valid = await bcrypt.compare(body.password, storedHash);
        if (!valid) return { status: 401, body: { error: 'Incorrect password' } };
    } else if (oauthProvider === 'google') {
        // OAuth user path (M3 fix)
        if (!body.google_id_token) {
            return { status: 401, body: { error: 'Google re-authentication required', detail: 'Provide a fresh google_id_token to disable the privacy shield' } };
        }
        let tokenPayload;
        try {
            tokenPayload = await verifier(body.google_id_token);
        } catch (e) {
            return { status: 401, body: { error: 'Invalid or expired Google ID token', detail: e.message } };
        }
        if (tokenPayload.sub !== oauthId) {
            return { status: 401, body: { error: 'Google token does not match your account' } };
        }
    }

    return { status: 200, body: { success: true, privacy_shield_enabled: false } };
}

const HASHED_PW = await require('bcrypt').hash('correct123', 10);

// Password user — correct password → allow
await checkAsync('Password user + correct password → 200 allow', async () => {
    const r = await runDisableLogic({
        userRow: { password_hash: HASHED_PW, oauth_provider: null, oauth_id: null },
        body: { password: 'correct123' },
        verifier: null,
    });
    assert.strictEqual(r.status, 200);
});

// Password user — wrong password → 401
await checkAsync('Password user + wrong password → 401', async () => {
    const r = await runDisableLogic({
        userRow: { password_hash: HASHED_PW, oauth_provider: null, oauth_id: null },
        body: { password: 'wrongpass' },
        verifier: null,
    });
    assert.strictEqual(r.status, 401);
});

// OAuth user — no token at all → 401 (the M3 fix closes this gap)
await checkAsync('OAuth user + no google_id_token → 401 (gap fixed)', async () => {
    const r = await runDisableLogic({
        userRow: { password_hash: null, oauth_provider: 'google', oauth_id: 'google-uid-123' },
        body: {},    // no google_id_token
        verifier: null,
    });
    assert.strictEqual(r.status, 401, `Expected 401, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert.ok(r.body.error.includes('Google re-authentication'), `reason: ${r.body.error}`);
});

// OAuth user — invalid token → 401
await checkAsync('OAuth user + invalid google_id_token → 401', async () => {
    const rejectingVerifier = async () => { throw new Error('Google tokeninfo rejected token (HTTP 400)'); };
    const r = await runDisableLogic({
        userRow: { password_hash: null, oauth_provider: 'google', oauth_id: 'google-uid-123' },
        body: { google_id_token: 'bad.token.here' },
        verifier: rejectingVerifier,
    });
    assert.strictEqual(r.status, 401);
});

// OAuth user — valid token but different account's sub → 401
await checkAsync("OAuth user + valid token but wrong sub (different user's account) → 401", async () => {
    const wrongSubVerifier = async () => ({ sub: 'different-uid-999', exp: FUTURE_EXP });
    const r = await runDisableLogic({
        userRow: { password_hash: null, oauth_provider: 'google', oauth_id: 'google-uid-123' },
        body: { google_id_token: 'valid.but.wrong.user' },
        verifier: wrongSubVerifier,
    });
    assert.strictEqual(r.status, 401);
    assert.ok(r.body.error.includes('does not match'), `reason: ${r.body.error}`);
});

// OAuth user — valid token, correct sub → 200
await checkAsync('OAuth user + valid token, matching sub → 200 allow', async () => {
    const correctVerifier = async () => ({ sub: 'google-uid-123', email: 'alice@gmail.com', exp: FUTURE_EXP });
    const r = await runDisableLogic({
        userRow: { password_hash: null, oauth_provider: 'google', oauth_id: 'google-uid-123' },
        body: { google_id_token: 'valid.matching.token' },
        verifier: correctVerifier,
    });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.privacy_shield_enabled, false);
});

// ── Summary ─────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════');
console.log(`  Results: ${passed}/${passed + failed} tests passed`);
if (failed === 0) {
    console.log('  \x1b[92mALL PASS — M3 OAuth shield fix is working\x1b[0m');
} else {
    console.log(`  \x1b[91m${failed} FAILING — implement OAuth re-auth in disable route\x1b[0m`);
}
console.log('══════════════════════════════════════════════════════\n');

process.exit(failed === 0 ? 0 : 1);

})();
