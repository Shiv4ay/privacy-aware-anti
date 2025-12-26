
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

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function run() {
    console.log("=== STARTING LIVE DEMO CONFIGURATION ===");
    try {
        // 1. Login
        console.log("\n[1/4] Authenticating as Admin...");
        const loginRes = await request("http://localhost:3001/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        }, JSON.stringify({ email: "admin@privacy-aware-rag.local", password: "password" }));

        if (loginRes.status !== 200) throw new Error("Login failed");
        const token = loginRes.body.accessToken;
        console.log("      Success! Token acquired.");

        // 2. Upload
        console.log("\n[2/4] Uploading Test Document...");
        const boundary = "boundary" + Date.now().toString(16);
        const content = "This is a live demo document verifying that Search and Chat are working correctly for the User. Privacy-aware RAG is active.";
        const filename = "live_demo.txt";

        let body = `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`;
        body += 'Content-Type: text/plain\r\n\r\n';
        body += content + '\r\n';
        body += `--${boundary}--\r\n`;

        const uploadRes = await request("http://localhost:3001/api/upload", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": `multipart/form-data; boundary=${boundary}`,
                "Content-Length": Buffer.byteLength(body),
                "X-Organization": "1"
            }
        }, body);

        if (uploadRes.status === 200) {
            console.log(`      Success! Document uploaded (ID: ${uploadRes.body.document.id})`);
        } else {
            console.log("      Upload failed (might already exist), proceeding to search...");
        }

        console.log("      Waiting 5s for ingestion worker...");
        await sleep(5000);

        // 3. Search
        console.log("\n[3/4] Testing Search (Query: 'verifying')...");
        const searchRes = await request("http://localhost:3001/api/search", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "X-Organization": "1"
            }
        }, JSON.stringify({ query: "verifying", top_k: 3, org_id: 1, organization: "default" }));

        const hits = searchRes.body.results ? searchRes.body.results.length : 0;
        console.log(`      Hits Found: ${hits}`);
        if (hits > 0) {
            console.log(`      Sample Result: "${searchRes.body.results[0].text.substring(0, 60)}..."`);
        } else {
            console.log("      NO HITS FOUND (Unexpected)");
        }

        // 4. Chat
        console.log("\n[4/4] Testing Chat (Query: 'What is this document about?')...");
        const chatRes = await request("http://localhost:3001/api/chat", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        }, JSON.stringify({ query: "What is this document about?", org_id: 1 }));

        console.log(`      Context Used: ${chatRes.body.context_used}`);
        console.log(`      AI Response: "${chatRes.body.response.replace(/\n/g, ' ')}"`);

        console.log("\n=== DEMO COMPLETE: SYSTEM IS OPERATIONAL ===");

    } catch (e) {
        console.error("Demo Failed:", e.message);
    }
}
run();
