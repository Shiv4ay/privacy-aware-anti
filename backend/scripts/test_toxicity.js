const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

// Login to get token
async function uploadToxicDoc() {
    try {
        console.log('Logging in as super admin...');
        const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
            email: 'hostingweb2102@gmail.com',
            password: 'password'
        });

        const cookie = loginRes.headers['set-cookie'][0];
        console.log('Login successful.');

        // Create a temporary toxic file
        const filename = 'toxic_test_doc.txt';
        const badText = `I hate everyone. You are all terrible and worthless. I wish you all the worst. I want to hurt people. I am going to find you and kill you all. You deserve to suffer.`;
        fs.writeFileSync(filename, badText);

        const form = new FormData();
        form.append('files', fs.createReadStream(filename));

        console.log('Uploading toxic document...');
        const uploadRes = await axios.post('http://localhost:3000/api/documents/upload', form, {
            headers: {
                ...form.getHeaders(),
                Cookie: cookie
            }
        });

        console.log('Upload response:', uploadRes.data);
        fs.unlinkSync(filename);

        console.log('Upload complete. Let the worker process it and check the DB status.');

    } catch (e) {
        console.error('Test failed:', e.response?.data || e.message);
    }
}

uploadToxicDoc();
