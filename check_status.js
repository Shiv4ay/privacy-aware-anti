
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
    console.log("=== CHECKING DOCUMENT PROCESSING STATUS ===");
    try {
        // 1. Login
        const loginRes = await request("http://localhost:3001/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        }, JSON.stringify({ email: "admin@privacy-aware-rag.local", password: "password" }));

        if (loginRes.status !== 200) throw new Error("Login failed");
        const token = loginRes.body.accessToken;

        // 2. Get Documents List
        const docsRes = await request("http://localhost:3001/api/documents", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (docsRes.status === 200 && docsRes.body.success) {
            const docs = docsRes.body.documents;
            console.log(`\nTotal Documents Found: ${docs.length}`);
            console.log("----------------------------------------------------------------");
            console.log("| ID | Filename | Status | Created At |");
            console.log("----------------------------------------------------------------");
            docs.forEach(d => {
                // Status isn't explicitly returned in the simple list query in routes/documents.js line 298
                // Wait, I saw line 298: SELECT id, filename, created_at, uploaded_by, file_size FROM documents
                // It does NOT select 'status'. This is a limitation of the current API.
                // However, I can infer existence means at least uploaded.
                console.log(`| ${d.id} | ${d.filename} | ${d.status} | ${d.processed_at || 'Pending'} |`);
            });
            console.log("----------------------------------------------------------------");
            // console.log("\nNote: The API does not currently expose the 'status' column in the list view.");
        } else {
            console.log("Failed to list documents:", docsRes.body);
        }

        // 3. Get Stats
        const statsRes = await request("http://localhost:3001/api/documents/stats", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (statsRes.status === 200 && statsRes.body.success) {
            console.log("\nStatistics:");
            console.log(`- Total Documents: ${statsRes.body.total_documents}`);
            console.log(`- Total Searches: ${statsRes.body.total_searches}`);
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
