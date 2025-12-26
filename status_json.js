
const http = require('http');

function request(urlStr, options, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlStr);
        const reqOpts = { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method: options.method || 'GET', headers: options.headers || {} };
        const req = http.request(reqOpts, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        });
        req.end(body);
    });
}
async function run() {
    const loginRes = await request("http://localhost:3001/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" } }, JSON.stringify({ email: "admin@privacy-aware-rag.local", password: "password" }));
    const token = loginRes.accessToken;
    const docs = await request("http://localhost:3001/api/documents", { headers: { "Authorization": `Bearer ${token}` } });

    console.log("JSON_OUTPUT_START");
    console.log(JSON.stringify(docs.documents.map(d => ({ id: d.id, filename: d.filename, status: d.status, processed_at: d.processed_at }))));
    console.log("JSON_OUTPUT_END");
}
run();
