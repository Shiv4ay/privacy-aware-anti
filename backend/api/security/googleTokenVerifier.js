/**
 * Google ID Token Verifier — M3 Privacy Shield OAuth Re-Auth
 *
 * Verifies a Google ID token by calling Google's tokeninfo endpoint.
 * Returns the decoded token payload (sub, email, exp, aud, ...) on success,
 * throws on failure.
 *
 * The `_fetcher` parameter allows tests to inject a mock without real HTTP calls.
 */

const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

/**
 * Verify a Google ID token via the tokeninfo endpoint.
 *
 * @param {string} idToken - Raw Google ID token from the client
 * @param {Function} _fetcher - Fetch-compatible function (default: node-fetch). Injectable for tests.
 * @returns {Promise<{sub: string, email: string, exp: string, aud: string, ...}>}
 * @throws {Error} if token is invalid, expired, or the network call fails
 */
async function verifyGoogleIdToken(idToken, _fetcher) {
    if (!idToken || typeof idToken !== 'string' || idToken.trim() === '') {
        throw new Error('No ID token provided');
    }

    // Use injected fetcher in tests; fall back to node-fetch in production
    const fetchFn = _fetcher || (await import('node-fetch').then(m => m.default));

    const url = `${TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`;
    let resp;
    try {
        resp = await fetchFn(url);
    } catch (networkErr) {
        throw new Error(`Google tokeninfo network error: ${networkErr.message}`);
    }

    if (!resp.ok) {
        // Google returns 400 for invalid/expired tokens
        let body = '';
        try { body = await resp.text(); } catch (_) {}
        throw new Error(`Google tokeninfo rejected token (HTTP ${resp.status}): ${body}`);
    }

    const payload = await resp.json();

    // Sanity check: token must have a subject
    if (!payload.sub) {
        throw new Error('Google tokeninfo response missing sub field');
    }

    // Optional: check expiry (Google also checks this, but belt-and-suspenders)
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp && parseInt(payload.exp, 10) < nowSeconds) {
        throw new Error('Google ID token has expired');
    }

    return payload;
}

module.exports = { verifyGoogleIdToken, TOKENINFO_URL };
