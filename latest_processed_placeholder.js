
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
    try {
        // 1. Login
        const loginRes = await request("http://localhost:3001/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        }, JSON.stringify({ email: "admin@privacy-aware-rag.local", password: "password" }));

        const token = loginRes.body.accessToken;

        // 2. Get Documents (We have to filter client side because API is limited, OR query DB directly)
        // Since API pagination checks `created_at` DESC, processed ones might be anywhere if they were uploaded long ago.
        // Queries "processed_at" is better done via DB for accuracy in this debug context.
        // But let's try to be "user-like" via API first. 
        // Wait, I updated the API to return `processed_at`.
        // But `list` endpoint orders by `created_at`.
        // If these files were uploaded long ago (bulk import), they might be deep in the list.
        // It is better to use a direct DB query script for the user to see the "Live Stream".
        // Let's switch to a direct PG query node script for accurate "Latest PROCESSED" (not latest uploaded).
    } catch (e) {
        console.error(e);
    }
}
// Actually, let's write a python script for DB access, it's easier in this env or just use psql.
// User wants to know "how will i know".
// I'll provide a PSQL command they can run, AND run it for them.
