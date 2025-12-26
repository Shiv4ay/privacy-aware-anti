
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
    console.log("=== VERIFYING WEB INGESTION ENDPOINT ===");
    try {
        // 1. Login
        console.log("Logging in...");
        const loginRes = await request("http://localhost:3001/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        }, JSON.stringify({ email: "admin@privacy-aware-rag.local", password: "password" }));

        if (loginRes.status !== 200) throw new Error("Login failed");
        const token = loginRes.body.accessToken;
        console.log("Login successful.");

        // 2. Trigger Ingestion (Wikiepdia: Privacy)
        console.log("Triggering ingestion for 'https://en.wikipedia.org/wiki/Privacy'...");
        const ingestRes = await request("http://localhost:3001/api/ingest/web", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "X-Organization": "1"
            }
        }, JSON.stringify({ url: "https://en.wikipedia.org/wiki/Privacy" }));

        console.log("Ingest Status:", ingestRes.status);
        console.log("Body:", JSON.stringify(ingestRes.body));

        if (ingestRes.status === 200) {
            console.log("SUCCESS: Web ingestion triggered.");
        } else {
            console.log("FAILURE: Endpoint rejection.");
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
