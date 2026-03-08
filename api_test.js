const axios = require('axios');

async function testLogin() {
    try {
        // Step 1: Initial Login (Should return multiple orgs)
        console.log("--- Step 1: Login without org_id ---");
        const res1 = await axios.post('http://localhost:3001/api/auth/login', {
            email: 'sibasundar2102@gmail.com',
            password: 'dummy_password' // Needs correct password or will fail
        });
        console.log("Step 1 Response:", res1.data);
    } catch (e) {
        console.error("Step 1 Failed:", e.response ? e.response.data : e.message);
    }
}

testLogin();
