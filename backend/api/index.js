require('dotenv').config();

const { abacMiddleware } = require('./middleware/abacMiddleware');
const express = require('express');
const { Pool } = require('pg');
const Redis = require('ioredis');
const axios = require('axios');
const Minio = require('minio');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');
const path = require('path');

const PORT = process.env.PORT || 3001;

// Database connection
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379/0');

// Service URLs
const WORKER_URL = process.env.WORKER_URL || 'http://worker:8001';

// MinIO client configuration
const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'minio',
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
    secretKey: process.env.MINIO_SECRET_KEY || 'secure_password',
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'privacy-documents';

// Express app setup
const app = express();

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer configuration for file uploads
const upload = multer({ 
    dest: 'uploads/',
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

// Ensure MinIO bucket exists
minioClient.bucketExists(BUCKET_NAME, (err, exists) => {
    if (err) {
        console.error('MinIO bucket check error:', err);
        return;
    }

    if (!exists) {
        minioClient.makeBucket(BUCKET_NAME, 'us-east-1', (err) => {
            if (err) {
                console.error('MinIO bucket creation error:', err);
            } else {
                console.log(`MinIO bucket '${BUCKET_NAME}' created successfully`);
            }
        });
    } else {
        console.log(`MinIO bucket '${BUCKET_NAME}' exists`);
    }
});

// -----------------------------
// Health Check Endpoint
// -----------------------------
app.get('/api/health', async (req, res) => {
    const healthChecks = {
        postgres: false,
        redis: false,
        worker: false,
        minio: false,
        timestamp: new Date().toISOString()
    };

    // Check PostgreSQL
    try {
        await pool.query('SELECT 1');
        healthChecks.postgres = true;
    } catch (error) {
        healthChecks.postgres_error = error.message;
    }

    // Check Redis
    try {
        const pong = await redis.ping();
        healthChecks.redis = pong === 'PONG';
    } catch (error) {
        healthChecks.redis_error = error.message;
    }

    // Check Worker service
    try {
        const response = await axios.get(`${WORKER_URL}/health`, { timeout: 5000 });
        healthChecks.worker = response.status === 200;
        healthChecks.worker_details = response.data;
    } catch (error) {
        healthChecks.worker_error = error.message;
    }

    // Check MinIO
    try {
        await new Promise((resolve, reject) => {
            minioClient.bucketExists(BUCKET_NAME, (err, exists) => {
                if (err) return reject(err);
                healthChecks.minio = exists;
                resolve();
            });
        });
    } catch (error) {
        healthChecks.minio_error = error.message;
    }

    const overallStatus = healthChecks.postgres && healthChecks.redis && healthChecks.worker && healthChecks.minio
        ? 'healthy' : 'degraded';

    res.json({
        status: overallStatus,
        checks: healthChecks
    });
});

// -----------------------------
// Document Upload Endpoint
// -----------------------------
app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ 
            error: 'No file uploaded',
            details: 'Please select a file to upload'
        });
    }

    const fileName = req.file.originalname;
    const filePath = req.file.path;
    const fileKey = `${Date.now()}-${fileName}`;

    try {
        // Upload file to MinIO
        const fileStream = fs.createReadStream(filePath);
        const fileStats = fs.statSync(filePath);

        await new Promise((resolve, reject) => {
            minioClient.putObject(BUCKET_NAME, fileKey, fileStream, fileStats.size, (err, etag) => {
                if (err) return reject(err);
                resolve(etag);
            });
        });

        // Store document record in database
        const result = await pool.query(
            'INSERT INTO documents (file_key, filename, status) VALUES ($1, $2, $3) RETURNING id',
            [fileKey, fileName, 'pending']
        );

        // Queue processing job
        const jobData = {
            key: fileKey,
            filename: fileName,
            document_id: result.rows[0].id,
            uploaded_at: new Date().toISOString()
        };

        await redis.lpush('document_jobs', JSON.stringify(jobData));

        // Clean up temporary file
        fs.unlinkSync(filePath);

        res.json({
            success: true,
            message: 'File uploaded successfully and queued for processing',
            document: {
                id: result.rows[0].id,
                filename: fileName,
                file_key: fileKey,
                status: 'pending'
            }
        });

    } catch (error) {
        console.error('Upload error:', error);

        // Clean up temporary file
        try {
            fs.unlinkSync(filePath);
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError);
        }

        res.status(500).json({
            error: 'Upload failed',
            details: error.message
        });
    }
});

// -----------------------------
// Document List Endpoint
// -----------------------------
app.get('/api/documents', async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const result = await pool.query(
            'SELECT id, filename, status, content_preview, created_at, processed_at FROM documents ORDER BY created_at DESC LIMIT $1 OFFSET $2',
            [limit, offset]
        );

        const countResult = await pool.query('SELECT COUNT(*) FROM documents');
        const total = parseInt(countResult.rows[0].count);

        res.json({
            documents: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Document list error:', error);
        res.status(500).json({
            error: 'Failed to fetch documents',
            details: error.message
        });
    }
});

// -----------------------------
// Document Download Endpoint
// -----------------------------
app.get('/api/download/:id', async (req, res) => {
    try {
        const documentId = req.params.id;

        const result = await pool.query(
            'SELECT file_key, filename FROM documents WHERE id = $1',
            [documentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const { file_key, filename } = result.rows[0];

        minioClient.getObject(BUCKET_NAME, file_key, (err, dataStream) => {
            if (err) {
                console.error('MinIO download error:', err);
                return res.status(404).json({ error: 'File not found in storage' });
            }

            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Type', 'application/octet-stream');
            dataStream.pipe(res);
        });

    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({
            error: 'Download failed',
            details: error.message
        });
    }
});

// -----------------------------
// Search Endpoint (ABAC-protected)
// -----------------------------
app.post('/api/search', abacMiddleware('search'), async (req, res) => {
    const { query, top_k = 5 } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({
            error: 'Missing or invalid query',
            details: 'Query must be a non-empty string'
        });
    }

    try {
        // Build payload including user attributes set by abacMiddleware
        const payload = {
            user: req.user, // user object attached by middleware
            query: query.trim(),
            top_k
        };

        const response = await axios.post(`${WORKER_URL}/search`, payload, {
            timeout: 30000
        });

        res.json({
            success: true,
            ...response.data
        });

    } catch (error) {
        console.error('Search error:', error);

        let errorMessage = 'Search failed';
        let statusCode = 500;

        if (error.response) {
            errorMessage = error.response.data?.detail || error.response.data?.error || errorMessage;
            statusCode = error.response.status;
        } else if (error.code === 'ECONNREFUSED') {
            errorMessage = 'Search service unavailable';
            statusCode = 503;
        } else if (error.code === 'ECONNABORTED') {
            errorMessage = 'Search request timed out';
            statusCode = 504;
        }

        res.status(statusCode).json({
            error: errorMessage,
            details: error.message
        });
    }
});

// -----------------------------
// Chat Endpoint
// -----------------------------
app.post('/api/chat', async (req, res) => {
    const { query, context } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({ 
            error: 'Missing or invalid query',
            details: 'Query must be a non-empty string'
        });
    }

    try {
        const response = await axios.post(`${WORKER_URL}/chat`, {
            query: query.trim(),
            context
        }, {
            timeout: 60000 // Longer timeout for chat responses
        });

        res.json({
            success: true,
            ...response.data
        });

    } catch (error) {
        console.error('Chat error:', error);

        let errorMessage = 'Chat failed';
        let statusCode = 500;

        if (error.response) {
            errorMessage = error.response.data?.detail || error.response.data?.error || errorMessage;
            statusCode = error.response.status;
        } else if (error.code === 'ECONNREFUSED') {
            errorMessage = 'Chat service unavailable';
            statusCode = 503;
        }

        res.status(statusCode).json({
            error: errorMessage,
            details: error.message
        });
    }
});

// -----------------------------
// Document Status Endpoint
// -----------------------------
app.get('/api/documents/:id/status', async (req, res) => {
    try {
        const documentId = req.params.id;

        const result = await pool.query(
            'SELECT id, filename, status, created_at, processed_at FROM documents WHERE id = $1',
            [documentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        res.json({
            success: true,
            document: result.rows[0]
        });

    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({
            error: 'Status check failed',
            details: error.message
        });
    }
});

// -----------------------------
// Error handling middleware
// -----------------------------
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        path: req.path
    });
});

// -----------------------------
// Server startup
// -----------------------------
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Privacy-Aware RAG API Gateway listening on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});
