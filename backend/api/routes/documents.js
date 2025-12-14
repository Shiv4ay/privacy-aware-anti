const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Pool } = require('pg');
const axios = require('axios');
const csv = require('csv-parser');
const { Readable } = require('stream');

// Database pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB max file size
    },
    fileFilter: (req, file, cb) => {
        // Accept CSV, TXT, HTML, PDF files
        const allowedTypes = ['.csv', '.txt', '.html', '.htm', '.pdf'];
        const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));

        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${ext} not supported. Allowed: ${allowedTypes.join(', ')}`));
        }
    }
});

/**
 * Parse CSV buffer to array of objects
 */
async function parseCSV(buffer) {
    return new Promise((resolve, reject) => {
        const results = [];
        const stream = Readable.from(buffer.toString());

        stream
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
}

/**
 * Transform CSV row to searchable document
 */
function transformCSVRow(row, recordType, rowIndex) {
    // Create a readable text representation
    const fields = Object.entries(row)
        .filter(([key, value]) => value && value.toString().trim())
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');

    return {
        content: fields,
        metadata: {
            ...row,
            record_type: recordType,
            row_index: rowIndex,
            source: 'csv_upload'
        }
    };
}

/**
 * POST /api/documents/upload
 * Upload and process documents (CSV, TXT, HTML, PDF)
 */
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        console.log('[Documents] Upload request received');

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { organization_id, record_type, source_name } = req.body;
        const userId = req.user.userId;
        const userOrgId = req.user.organization || req.user.org_id;

        // Validate organization access
        if (!organization_id) {
            return res.status(400).json({ error: 'organization_id is required' });
        }

        // Check if user has access to this organization
        // Super admin can upload to any org, others only to their own
        if (req.user.role !== 'super_admin' && userOrgId !== parseInt(organization_id)) {
            return res.status(403).json({ error: 'Access denied to this organization' });
        }

        const file = req.file;
        const fileName = file.originalname;
        const fileExt = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));

        console.log(`[Documents] Processing ${fileExt} file: ${fileName}`);

        let documents = [];

        // Parse based on file type
        if (fileExt === '.csv') {
            // Parse CSV and create documents for each row
            const rows = await parseCSV(file.buffer);
            console.log(`[Documents] Parsed ${rows.length} CSV rows`);

            documents = rows.map((row, index) =>
                transformCSVRow(row, record_type || 'csv_row', index)
            );

        } else if (fileExt === '.txt' || fileExt === '.html' || fileExt === '.htm') {
            // For text/HTML, treat entire content as one document
            const content = file.buffer.toString('utf-8');
            documents = [{
                content: content,
                metadata: {
                    record_type: record_type || 'document',
                    source: source_name || fileName
                }
            }];

        } else if (fileExt === '.pdf') {
            // PDF handling would go here (simplified for now)
            return res.status(400).json({
                error: 'PDF support coming soon. Please use CSV, TXT, or HTML for now.'
            });
        }

        if (documents.length === 0) {
            return res.status(400).json({ error: 'No documents could be extracted from file' });
        }

        console.log(`[Documents] Created ${documents.length} document(s) from ${fileName}`);

        // Insert documents into database using BATCH processing for large files
        const insertedDocuments = [];
        const workerUrl = process.env.WORKER_URL || 'http://localhost:5000';
        const baseTimestamp = Date.now();
        const BATCH_SIZE = 500; // Process 500 rows at a time

        console.log(`[Documents] Using batch processing with size ${BATCH_SIZE} for ${documents.length} documents`);

        for (let i = 0; i < documents.length; i += BATCH_SIZE) {
            const batch = documents.slice(i, i + BATCH_SIZE);
            const batchStartIndex = i;

            // Build VALUES clause for batch insert
            const values = [];
            const params = [];
            let paramIndex = 1;

            batch.forEach((doc, batchIdx) => {
                const docIndex = batchStartIndex + batchIdx;
                const randomSuffix = Math.random().toString(36).substring(7);
                const fileKey = `${organization_id}/${baseTimestamp}_${docIndex}_${randomSuffix}_${fileName}`;

                values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, NOW(), $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10})`);

                params.push(
                    fileKey,
                    fileName,
                    fileName,
                    `/uploads/${fileKey}`,
                    userId,
                    file.size,
                    file.mimetype,
                    file.mimetype,
                    organization_id,
                    'pending',
                    JSON.stringify(doc.metadata)
                );

                paramIndex += 11;
            });

            // Execute batch insert
            const batchQuery = `
                INSERT INTO documents 
                (file_key, filename, original_filename, file_path, created_at, uploaded_by, file_size, mime_type, content_type, org_id, status, metadata)
                VALUES ${values.join(', ')}
                RETURNING id, filename, created_at
            `;

            const result = await pool.query(batchQuery, params);

            // Add to insertedDocuments
            result.rows.forEach(row => {
                insertedDocuments.push({
                    id: row.id,
                    filename: row.filename,
                    upload_date: row.created_at
                });
            });

            // Log progress
            console.log(`[Documents] Batch ${Math.floor(i / BATCH_SIZE) + 1}: Inserted ${result.rows.length} documents (${i + result.rows.length}/${documents.length})`);
        }

        console.log(`[Documents] Successfully uploaded ${insertedDocuments.length} documents to org ${organization_id}`);

        res.json({
            success: true,
            message: `Successfully uploaded ${insertedDocuments.length} document(s)`,
            documents: insertedDocuments,
            organization_id: organization_id
        });

    } catch (error) {
        console.error('[Documents] Upload error:', error);
        res.status(500).json({
            error: 'Upload failed',
            details: error.message
        });
    }
});

/**
 * GET /api/documents/stats
 * Get document statistics for current user/org
 */
router.get('/stats', async (req, res) => {
    try {
        const userOrgId = req.user.organization || req.user.org_id;

        if (!userOrgId && req.user.role !== 'super_admin') {
            return res.status(400).json({ error: 'User has no organization' });
        }

        let query;
        let params;

        if (req.user.role === 'super_admin') {
            query = 'SELECT COUNT(*) as count FROM documents';
            params = [];
        } else {
            query = 'SELECT COUNT(*) as count FROM documents WHERE org_id = $1';
            params = [userOrgId];
        }

        const result = await pool.query(query, params);

        // Also try to get search count from audit_log
        let searchCount = 0;
        try {
            const searchRes = await pool.query(
                "SELECT COUNT(*) as count FROM audit_log WHERE action = 'search' AND user_id = $1",
                [req.user.userId]
            );
            searchCount = parseInt(searchRes.rows[0]?.count || 0);
        } catch (e) {
            // Ignore audit log errors
        }

        res.json({
            success: true,
            total_documents: parseInt(result.rows[0].count),
            total_searches: searchCount
        });

    } catch (error) {
        console.error('[Documents] Stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

/**
 * GET /api/documents
 * List documents for current user's organization
 */
router.get('/', async (req, res) => {
    try {
        const userOrgId = req.user.organization || req.user.org_id;

        if (!userOrgId && req.user.role !== 'super_admin') {
            return res.status(400).json({ error: 'User has no organization' });
        }

        // Super admin can see all, others only their org
        let query;
        let params;

        if (req.user.role === 'super_admin') {
            query = `
                SELECT id, filename, created_at, uploaded_by, file_size, org_id
                FROM documents
                ORDER BY created_at DESC
                LIMIT 100
            `;
            params = [];
        } else {
            query = `
                SELECT id, filename, created_at, uploaded_by, file_size
                FROM documents
                WHERE org_id = $1
                ORDER BY created_at DESC
                LIMIT 100
            `;
            params = [userOrgId];
        }

        const result = await pool.query(query, params);

        res.json({
            success: true,
            documents: result.rows
        });

    } catch (error) {
        console.error('[Documents] List error:', error);
        res.status(500).json({ error: 'Failed to list documents' });
    }
});

module.exports = router;
