const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const jwt = require('jsonwebtoken');

const DATA_DIR = '/tmp/university_data';
const UPLOAD_URL = 'http://localhost:3001/api/documents/upload';

async function ingest() {
    try {
        console.log('[Ingest] Generating token...');
        // Generate valid token locally using env secret
        const payload = {
            id: 1,
            userId: 1, // Required by jwtManager
            username: 'admin',
            email: 'admin@mit.edu',
            role: 'super_admin',
            org_id: 1,
            organizationId: 1, // Required by jwtManager
            organization: 1,
            type: 'access'
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret-key-change-this', { expiresIn: '1h' });
        console.log('[Ingest] Token generated.');

        const files = fs.readdirSync(DATA_DIR);
        console.log(`[Ingest] Found ${files.length} files.`);

        for (const file of files) {
            if (file.startsWith('.')) continue;

            const filePath = path.join(DATA_DIR, file);
            const recordType = file.replace('.csv', '').replace('.json', '');

            console.log(`[Ingest] Uploading ${file}...`);

            // Build curl command
            // Note: -F file=@path handles the file upload
            const cmd = `curl -X POST "${UPLOAD_URL}" \
                -H "Authorization: Bearer ${token}" \
                -F "file=@${filePath}" \
                -F "organization_id=1" \
                -F "record_type=${recordType}" \
                -F "source_name=University Dataset" \
                -v`; // Verbose mode for debug

            try {
                // Execute curl
                execSync(cmd, { stdio: 'inherit' }); // Print output directly
                console.log(`\n[Ingest] Finished ${file}`);
            } catch (err) {
                console.error(`[Ingest] Curl failed for ${file}:`, err.message);
            }
        }
    } catch (err) {
        console.error('[Ingest] Script error:', err.message);
    }
}

ingest();
