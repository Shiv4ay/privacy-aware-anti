
const http = require('http');

function request(urlStr, options, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlStr);
        const reqOpts = { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method: options.method || 'GET', headers: options.headers || {} };
        const req = http.request(reqOpts, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch (e) { resolve({ status: res.statusCode, body: data }); }
            });
        });
        req.end(body);
    });
}

async function run() {
    console.log("=== DEEP DEBUG: UNIVERSITY CONTENT ===");
    try {
        // 1. Login
        const loginRes = await request("http://localhost:3001/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" } }, JSON.stringify({ email: "admin@privacy-aware-rag.local", password: "password" }));
        const token = loginRes.body.accessToken;

        // 2. Search Vector DB for "University"
        console.log("\n[VECTOR SEARCH] Query: 'university'");
        const searchRes = await request("http://localhost:3001/api/search", {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "X-Organization": "1" }
        }, JSON.stringify({ query: "university", top_k: 5, org_id: 1, organization: "default" }));

        const hits = searchRes.body.results ? searchRes.body.results.length : 0;
        console.log(`Hits: ${hits}`);
        if (hits > 0) {
            searchRes.body.results.forEach((r, i) => console.log(` - Hit ${i + 1}: ${r.text.substring(0, 60)}...`));
        } else {
            console.log(" -> NO HITS. This confirms Vector DB has no 'university' content indexed yet.");
        }

        // 3. Check DB for Processed Filenames
        // We can't query DB filter by filename easily via API, so we rely on what we can list.
        // But wait, I can use the list endpoint and maybe filter in JS if the list is small enough? 
        // No, list is paginated or limited.
        // Instead, I'll print the first 5 processed documents to see what they are.
        // Actually, I'll rely on my postgres tools for deep DB inspection in the next step.

    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
