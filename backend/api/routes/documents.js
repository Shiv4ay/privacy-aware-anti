const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Pool } = require('pg');
const axios = require('axios');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { encryptEnvelope } = require('../security/cryptoManager');

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
        const userId = req.user.id; // Use primary key integer ID for DB FK
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
            // Basic PDF support - treat as binary document
            // Text extraction can be added later
            const base64Content = file.buffer.toString('base64');
            documents = [{
                content: `PDF Document: ${fileName} (${(file.size / 1024).toFixed(2)} KB)`,
                metadata: {
                    record_type: record_type || 'pdf_document',
                    source: source_name || fileName,
                    file_type: 'pdf',
                    base64_content: base64Content.substring(0, 100) // Store first 100 chars as preview
                }
            }];
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

                // Encrypt the metadata (which contains the actual content)
                const metadataString = JSON.stringify(doc.metadata);
                const { encryptedData, encryptedDEK, iv, authTag } = encryptEnvelope(Buffer.from(metadataString));

                values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, NOW(), $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11}, $${paramIndex + 12}, $${paramIndex + 13}, $${paramIndex + 14})`);

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
                    encryptedData.toString('base64'), // Store encrypted metadata as base64 in metadata column? Wait, metadata is JSONB.
                    // We'll store it as a JSON object containing the encrypted base64 string
                    true, // is_encrypted
                    encryptedDEK,
                    iv,
                    authTag
                );

                // Let's reconsider: metadata is JSONB. If we store base64 as one key, it works.
                params[params.length - 5] = JSON.stringify({ encrypted_content: encryptedData.toString('base64') });

                paramIndex += 15;
            });

            // Execute batch insert - Update query with new columns
            const batchQuery = `
                INSERT INTO documents 
                (file_key, filename, original_filename, file_path, created_at, uploaded_by, file_size, mime_type, content_type, org_id, status, metadata, is_encrypted, encrypted_dek, encryption_iv, encryption_tag)
                VALUES ${values.join(', ')}
                RETURNING id, filename, created_at
            `;

            console.log('[DEBUG] Executing Batch Insert:');
            // console.log('Query:', batchQuery); 
            console.log('Params Count:', params.length);
            console.log('Sample Params:', params.slice(0, 20));
            console.log('First 5 params types:', params.slice(0, 5).map(p => typeof p));

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

        // Trigger automatic processing via worker
        try {
            const workerUrl = process.env.WORKER_URL || 'http://worker:8001';
            console.log(`[Documents] Triggering auto-processing for org ${organization_id}`);

            // Call worker's process-batch endpoint asynchronously (don't wait for completion)
            const axios = require('axios');
            axios.post(`${workerUrl}/process-batch?org_id=${organization_id}&batch_size=${insertedDocuments.length}`)
                .then(response => {
                    console.log(`[Documents] Auto-processing completed:`, response.data);
                })
                .catch(err => {
                    console.error(`[Documents] Auto-processing failed:`, err.message);
                    // Don't fail the upload if processing fails
                });
        } catch (procError) {
            console.error('[Documents] Failed to trigger auto-processing:', procError.message);
            // Continue anyway - user can process manually
        }

        res.json({
            success: true,
            message: `Successfully uploaded ${insertedDocuments.length} document(s)`,
            documents: insertedDocuments,
            organization_id: organization_id,
            processing_status: 'triggered' // Indicate processing was started
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
 * Get comprehensive document statistics
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
            query = `
                SELECT 
                    COUNT(*) as total_documents,
                    COUNT(DISTINCT filename) as total_files,
                    COALESCE(SUM(file_size), 0) as total_storage,
                    MAX(created_at) as latest_upload,
                    COUNT(CASE WHEN status = 'processed' THEN 1 END) as processed,
                    COUNT(CASE WHEN status IN ('pending', 'processing') THEN 1 END) as pending
                FROM documents
            `;
            params = [];
        } else {
            query = `
                SELECT 
                    COUNT(*) as total_documents,
                    COUNT(DISTINCT filename) as total_files,
                    COALESCE(SUM(file_size), 0) as total_storage,
                    MAX(created_at) as latest_upload,
                    COUNT(CASE WHEN status = 'processed' THEN 1 END) as processed,
                    COUNT(CASE WHEN status IN ('pending', 'processing') THEN 1 END) as pending
                FROM documents 
                WHERE org_id = $1
            `;
            params = [userOrgId];
        }

        const result = await pool.query(query, params);
        const stats = result.rows[0];

        // Ensure numbers are numbers (Postgres BIGINT comes as string)
        const formattedStats = {
            total_documents: parseInt(stats.total_documents),
            total_files: parseInt(stats.total_files),
            total_storage: parseInt(stats.total_storage),
            latest_upload: stats.latest_upload,
            processed: parseInt(stats.processed),
            pending: parseInt(stats.pending)
        };

        res.json({
            success: true,
            documents: stats, // Keeping this for backward compatibility if needed, but structure changed
            ...formattedStats
        });

    } catch (error) {
        console.error('[Documents] Stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

/**
 * GET /api/documents
 * List documents with pagination and filtering
 */
router.get('/', async (req, res) => {
    try {
        const userOrgId = req.user.organization || req.user.org_id;
        const {
            page = 1,
            limit = 50,
            sortBy = 'created_at',
            sortOrder = 'DESC',
            search = '',
            filename = ''
        } = req.query;

        if (!userOrgId && req.user.role !== 'super_admin') {
            return res.status(400).json({ error: 'User has no organization' });
        }

        // Build query
        const offset = (page - 1) * limit;
        const validSortColumns = ['created_at', 'filename', 'file_size', 'status'];
        const sortCol = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
        const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        let whereClause = '';
        const params = [];
        let paramIdx = 1;

        if (req.user.role !== 'super_admin') {
            whereClause = `WHERE org_id = $${paramIdx}`;
            params.push(userOrgId);
            paramIdx++;
        }

        if (search) {
            const prefix = whereClause ? 'AND' : 'WHERE';
            whereClause += ` ${prefix} (filename ILIKE $${paramIdx} OR content_preview ILIKE $${paramIdx})`;
            params.push(`%${search}%`);
            paramIdx++;
        }

        if (filename) {
            const prefix = whereClause ? 'AND' : 'WHERE';
            whereClause += ` ${prefix} filename = $${paramIdx}`;
            params.push(filename);
            paramIdx++;
        }

        // Get total count for pagination
        const countQuery = `SELECT COUNT(*) FROM documents ${whereClause}`;
        const countResult = await pool.query(countQuery, params); // Re-use params as they match the where clause
        const total = parseInt(countResult.rows[0].count);

        // Get data
        const query = `
            SELECT id, filename, created_at, uploaded_by, file_size, org_id, status, processed_at, metadata
            FROM documents
            ${whereClause}
            ORDER BY ${sortCol} ${order}
            LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
        `;

        const listParams = [...params, limit, offset];
        const result = await pool.query(query, listParams);

        // Process results to ensure types are correct
        const documents = result.rows.map(doc => ({
            ...doc,
            file_size: parseInt(doc.file_size || 0) // Ensure number
        }));

        res.json({
            success: true,
            documents: documents,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('[Documents] List error:', error);
        res.status(500).json({ error: 'Failed to list documents' });
    }
});

/**
 * DELETE /api/documents/:id
 * Delete a document by ID
 */
router.delete('/:id', async (req, res) => {
    try {
        const docId = parseInt(req.params.id);
        const userId = req.user?.id;
        const userOrgId = req.user?.organization;
        const userRole = req.user?.role;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get document details first to verify ownership
        const docQuery = await pool.query(
            'SELECT id, filename, org_id, file_key FROM documents WHERE id = $1',
            [docId]
        );

        if (docQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const document = docQuery.rows[0];

        // Check permissions - only allow delete if:
        // 1. User is super_admin, OR
        // 2. Document belongs to user's organization
        if (userRole !== 'super_admin' && document.org_id !== userOrgId) {
            return res.status(403).json({ error: 'Forbidden - cannot delete documents from other organizations' });
        }

        // Delete from ChromaDB vector store if processed
        try {
            const workerUrl = process.env.WORKER_URL || 'http://worker:8001';
            const vectorId = `doc_${document.org_id}_${docId}`;

            console.log(`[Documents] Attempting to delete vector ${vectorId} from ChromaDB`);

            // Call worker to delete from vector store (best effort)
            axios.delete(`${workerUrl}/vectors/${vectorId}?org_id=${document.org_id}`)
                .then(() => console.log(`[Documents] Vector ${vectorId} deleted from ChromaDB`))
                .catch(err => console.error(`[Documents] Failed to delete vector: ${err.message}`));
        } catch (err) {
            console.error('[Documents] Error calling worker for vector deletion:', err.message);
            // Continue with database deletion even if vector deletion fails
        }

        // Delete from database
        const deleteResult = await pool.query(
            'DELETE FROM documents WHERE id = $1 RETURNING id, filename',
            [docId]
        );

        if (deleteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        console.log(`[Documents] Deleted document ${docId}: ${deleteResult.rows[0].filename}`);

        res.json({
            success: true,
            message: `Document "${deleteResult.rows[0].filename}" deleted successfully`,
            deleted_id: docId
        });

    } catch (error) {
        console.error('[Documents] Delete error:', error);
        res.status(500).json({
            error: 'Failed to delete document',
            details: error.message
        });
    }
});

module.exports = router;
