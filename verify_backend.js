
const fs = require('fs');
const http = require('http');

// Helper for HTTP requests
function request(urlStr, options, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlStr);
        const reqOpts = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = http.request(reqOpts, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ status: res.statusCode, body: json });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function run() {
    try {
        console.log("=== VERIFYING BACKEND SEARCH ===");
        // 1. Login
        const loginRes = await request("http://localhost:3001/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        }, JSON.stringify({ email: "admin@privacy-aware-rag.local", password: "password" }));

        if (loginRes.status !== 200) throw new Error("Login failed");
        const token = loginRes.body.accessToken;

        // 2. Search
        console.log("Searching for 'verifying'...");
        const searchRes = await request("http://localhost:3001/api/search", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "X-Organization": "1"
            }
        }, JSON.stringify({ query: "verifying", top_k: 3, org_id: 1, organization: "default" }));

        console.log("Status:", searchRes.status);
        console.log("Hits:", searchRes.body.results ? searchRes.body.results.length : 0);

        if (searchRes.body.results && searchRes.body.results.length > 0) {
            console.log("Result 1:", searchRes.body.results[0].text.substring(0, 100));
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
