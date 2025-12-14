const axios = require('axios');

async function validate() {
    try {
        console.log('--- 1. Authenticating ---');
        // Use internal Docker URL/port
        const baseUrl = 'http://localhost:3001/api';

        const tokenRes = await axios.post(`${baseUrl}/dev/token`, {
            key: 'super-secret-dev-key',
            user: { role: 'super_admin', org_id: 1, username: 'admin' }
        });
        const token = tokenRes.data.token;
        console.log('Token acquired.');

        const headers = { Authorization: `Bearer ${token}` };

        console.log('\n--- 2. Validating Stats ---');
        const statsRes = await axios.get(`${baseUrl}/admin/documents/stats`, { headers });
        console.log('Stats Response:', JSON.stringify(statsRes.data, null, 2));

        if (!statsRes.data.overallStats || statsRes.data.overallStats.total_documents < 800000) {
            console.error('FAIL: Expected > 800k documents, valid stats object');
        } else {
            console.log('PASS: Stats look correct.');
        }

        console.log('\n--- 3. Validating Sorting ---');
        const sortRes = await axios.get(`${baseUrl}/admin/documents?sortBy=filename&sortOrder=ASC&limit=3`, { headers });
        console.log('Sorted Docs (Top 3):', sortRes.data.documents.map(d => d.filename));

        console.log('\nValidation Complete.');
    } catch (err) {
        console.error('Validation Error:', err.message);
        if (err.response) console.error(err.response.data);
    }
}

validate();
