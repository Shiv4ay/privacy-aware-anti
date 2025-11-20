
const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function run() {
    try {
        const email = `debug_${Date.now()}@test.com`;
        console.log('Registering user:', email);

        try {
            await axios.post(`${API_URL}/auth/register`, {
                name: 'Debug User',
                email: email,
                password: 'password123',
                organization: 'DebugOrg',
                department: 'DebugDept',
                user_category: 'DebugCat'
            });
        } catch (e) {
            if (e.response?.status !== 409) throw e;
            console.log('User exists, proceeding to login');
        }

        console.log('Logging in...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: email,
            password: 'password123'
        });

        const token = loginRes.data.token;
        console.log('Login successful. Token obtained.');
        console.log('Login Response User:', JSON.stringify(loginRes.data.user, null, 2));

        console.log('Fetching /auth/me...');
        const meRes = await axios.get(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('/auth/me Response:', JSON.stringify(meRes.data, null, 2));

    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

run();
