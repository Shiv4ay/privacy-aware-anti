// Test script to verify password validation
const passwordManager = require('./auth/passwordManager');

async function testPassword() {
    const password = 'Admin123!';

    // Get hash from database
    const dbHash = '$2b$12$szmwMn5aLzllz1GPJWY1KOFX6chfKvILlajiZw33ocQONpC5O9Bia';

    console.log('Testing password:', password);
    console.log('Against hash:', dbHash);

    const isValid = await passwordManager.verifyPassword(password, dbHash);
    console.log('Password valid:', isValid);

    // Also test hash generation
    const newHash = await passwordManager.hashPassword(password);
    console.log('\nNew hash generated:', newHash);

    const newValid = await passwordManager.verifyPassword(password, newHash);
    console.log('New hash valid:', newValid);
}

testPassword().catch(console.error);
