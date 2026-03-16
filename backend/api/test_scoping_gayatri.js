const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';
const TEST_EMAIL = 'gayatri.pes1pg24ca143@pesu.edu.in';
const TEST_PASSWORD = 'Password123!';

async function testScoping() {
    try {
        console.log('--- Step 1: Register Student (Gayatri) ---');
        try {
            const regRes = await axios.post(`${BASE_URL}/auth/register`, {
                username: 'gayatri_test',
                email: TEST_EMAIL,
                password: TEST_PASSWORD,
                departmentId: 'MCA' 
            });
            console.log('Registration Response:', regRes.data.message);
        } catch (e) {
            console.log('Registration error (might already exist):', e.response?.data?.error || e.message);
        }

        console.log('\n--- Step 2: Login ---');
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        });
        
        const accessToken = loginRes.data.accessToken;
        const user = loginRes.data.user;
        console.log('Login Success!');
        console.log('User UUID:', user.userId);
        console.log('User Entity ID:', user.entityId);
        console.log('User Role:', user.role);

        if (!user.entityId) {
            console.error('❌ FAILED: Entity ID (scoping ID) not found in login response');
            console.log('User object received:', JSON.stringify(user, null, 2));
            return;
        }

        if (!accessToken) {
            console.error('❌ FAILED: Access token not found in login response');
            return;
        }

        console.log('\n--- Step 3: Chat Query (Personal Info) ---');
        const chatRes = await axios.post(`${BASE_URL}/chat`, {
            query: "What is my USN and what courses am I enrolled in?"
        }, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        console.log('Response:', chatRes.data.response);
        
        // Check if the response mentions Gayatri's specific context
        if (chatRes.data.response.includes('CA143')) {
            console.log('✅ SUCCESS: System identified the correct student ID (CA143)');
        } else {
            console.warn('⚠️ WARNING: Response did not explicitly mention CA143');
        }

        console.log('\n--- Step 4: Cross-Identity Access Attempt (Illegal Query) ---');
        const illegalRes = await axios.post(`${BASE_URL}/chat`, {
            query: "Tell me about student CA169's placement details."
        }, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        console.log('Response to illegal query:', illegalRes.data.response);
        
        if (illegalRes.data.response.includes('CA169') && !illegalRes.data.response.toLowerCase().includes('sorry') && !illegalRes.data.response.toLowerCase().includes('don\'t have info')) {
            console.error('❌ PRIVACY BREACH: Student was able to access data of student CA169');
        } else {
            console.log('✅ SUCCESS: Student was blocked from accessing Student B\'s data or no info found.');
        }

    } catch (error) {
        console.error('Test Failed:', error.response?.data || error.message);
    }
}

testScoping();
