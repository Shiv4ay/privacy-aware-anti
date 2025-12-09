const API_URL = 'http://localhost:5000/api';
const SUPER_ADMIN_KEY = 'dev-super-admin'; // From authMiddleware.js

async function runTests() {
    console.log('Starting Multi-Tenancy Verification...');

    try {
        // 1. Create Organizations
        console.log('\n1. Creating Organizations...');
        const orgA = await createOrg('Org A', 'University', 'org-a.com');
        const orgB = await createOrg('Org B', 'Hospital', 'org-b.com');
        console.log(`   Org A ID: ${orgA.id}`);
        console.log(`   Org B ID: ${orgB.id}`);

        // 2. Create Users
        console.log('\n2. Creating Users...');

        const userA = await registerUser('User A', 'usera@org-a.com', 'password123', orgA.id);
        const userB = await registerUser('User B', 'userb@org-b.com', 'password123', orgB.id);

        const tokenA = await login('usera@org-a.com', 'password123');
        const tokenB = await login('userb@org-b.com', 'password123');

        console.log('   User A and User B created and logged in.');

        // 3. Upload Document as User A (Simulated via Search)
        console.log('\n3. User A Searching...');

        const searchA = await search(tokenA, 'test query');
        console.log(`   User A Search Success: ${searchA.success} (Found: ${searchA.total_found})`);

        const searchB = await search(tokenB, 'test query');
        console.log(`   User B Search Success: ${searchB.success} (Found: ${searchB.total_found})`);

        console.log('\nVerification Complete (Basic Flow).');

    } catch (error) {
        console.error('Test Failed:', error.message);
    }
}

async function createOrg(name, type, domain) {
    try {
        const res = await fetch(`${API_URL}/orgs/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPER_ADMIN_KEY}`
            },
            body: JSON.stringify({ name, type, domain })
        });
        const data = await res.json();
        if (!res.ok) {
            if (data.error === 'Organization already exists') {
                const listRes = await fetch(`${API_URL}/orgs`, {
                    headers: { 'Authorization': `Bearer ${SUPER_ADMIN_KEY}` }
                });
                const list = await listRes.json();
                return list.organizations.find(o => o.name === name);
            }
            throw new Error(data.error || 'Failed to create org');
        }
        return data.organization;
    } catch (e) {
        throw e;
    }
}

async function registerUser(name, email, password, org_id) {
    const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, org_id, department: 'IT', user_category: 'employee' })
    });
    const data = await res.json();
    if (!res.ok && res.status !== 409) {
        throw new Error(data.error || 'Failed to register user');
    }
}

async function login(email, password) {
    const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    return data.token;
}

async function search(token, query) {
    const res = await fetch(`${API_URL}/search`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Search failed');
    return data;
}

runTests();
