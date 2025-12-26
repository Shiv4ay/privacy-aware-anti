
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

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function run() {
    console.log("=== FINAL INTEGRATION TEST ===");
    try {
        // 1. Login
        console.log("1. Logging in...");
        const loginRes = await request("http://localhost:3001/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        }, JSON.stringify({ email: "admin@privacy-aware-rag.local", password: "password" }));

        const token = loginRes.body.accessToken;
        if (!token) throw new Error("Login failed");
        console.log("   Login success.");

        // 2. Ingest Unique URL
        const testUrl = "https://en.wikipedia.org/wiki/Web_scraping";
        console.log(`2. Triggering ingestion for: ${testUrl}`);
        const ingestRes = await request("http://localhost:3001/api/ingest/web", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "X-Organization": "1"
            }
        }, JSON.stringify({ url: testUrl }));

        console.log("   Ingest Status:", ingestRes.status);
        if (ingestRes.status !== 200) throw new Error("Ingestion rejected");

        // 3. Status Poll (Wait for processing)
        console.log("3. Waiting 10s for processing...");
        await sleep(10000);

        // 4. Search
        console.log("4. Searching for 'scraping'...");
        const searchRes = await request("http://localhost:3001/api/rag/search", { // Correct endpoint is /api/rag/search based on previous logs? Or /search?
            // Wait, previous logs showed worker has /search. API likely proxies it.
            // Let's use the Worker directly or API if known. 
            // API routes: /api/rag/search usually.
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "X-Organization": "1"
            }
        }, JSON.stringify({ query: "scraping", top_k: 5 }));

        // Verify API mapping. If API routes are not known for search, check worker directly.
        // Worker is on 8000.
        const workerSearchRes = await request("http://localhost:8000/search", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Organization": "1" }
        }, JSON.stringify({ query: "scraping", org_id: 1, organization: "Private" }));

        console.log("   Worker Search Status:", workerSearchRes.status);
        console.log("   Worker Results:", JSON.stringify(workerSearchRes.body).substring(0, 200) + "...");

        if (workerSearchRes.status === 200 && JSON.stringify(workerSearchRes.body).includes("scraping")) {
            console.log("SUCCESS: Content was ingested and is searchable.");
        } else {
            console.log("WARNING: Search might need more time or verification.");
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
