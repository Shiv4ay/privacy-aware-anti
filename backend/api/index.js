const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); // Robust load relative to file

const express = require('express');
const { Pool } = require('pg');
const Redis = require('ioredis');
const axios = require('axios');
const Minio = require('minio');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');
// path already required at top
const jwt = require('jsonwebtoken');
const url = require('url'); // For MinIO parsing
const http = require('http'); // Required for Socket.io
const RealtimeService = require('./realtime');

// ==========================================
// Middleware Imports
// ==========================================
// Phase 4 Security
const { configureSecurityHeaders } = require('./middleware/securityHeaders');
const { apiLimiter } = require('./middleware/rateLimiter');
const { sanitizeBody } = require('./middleware/validator');
const { authenticateJWT } = require('./middleware/authMiddleware');
const { anomalyDetectionMiddleware } = require('./security/anomalyDetector');
const { encryptEnvelope } = require('./security/cryptoManager');

// Application Logic
const { attachUserId } = require('./middleware/attachUserId');
const { abacMiddleware } = require('./middleware/abacMiddleware');

const PORT = Number(process.env.API_PORT || process.env.PORT || 3001);

// ==========================================
// Service Connections
// ==========================================

// Database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Redis
const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379/0', {
    retryStrategy: (times) => Math.min(times * 50, 2000),
    maxRetriesPerRequest: 3
});
redis.on('error', (err) => console.warn('Redis warning:', err.message));

// Worker Service URL
const WORKER_URL = process.env.WORKER_URL || 'http://worker:8001';

// MinIO (Robust Setup)
function parseMinio(raw) {
    if (!raw) return null;
    raw = String(raw).trim();
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
        const p = url.parse(raw);
        const port = p.port ? parseInt(p.port, 10) : (p.protocol === 'https:' ? 443 : 80);
        return {
            host: p.hostname,
            port: (!isNaN(port) && port > 0 && port <= 65535) ? port : 9000,
            useSSL: p.protocol === 'https:'
        };
    }
    if (raw.includes('/')) raw = raw.split('/')[0];
    if (raw.includes(':')) {
        const parts = raw.split(':');
        const port = parseInt(parts[1] || '9000', 10);
        return {
            host: parts[0],
            port: (!isNaN(port) && port > 0 && port <= 65535) ? port : 9000,
            useSSL: false
        };
    }
    return { host: raw, port: 9000, useSSL: false };
}

const MINIO_RAW = process.env.MINIO_ENDPOINT || `${process.env.MINIO_HOST || 'minio'}:${process.env.MINIO_PORT || '9000'}`;
const _m = parseMinio(MINIO_RAW);
const minioClient = new Minio.Client({
    endPoint: _m.host,
    port: Number(_m.port) || 9000,
    useSSL: !!_m.useSSL,
    accessKey: process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || 'minioadmin123'
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'privacy-documents';

// Check MinIO and ensure bucket
minioClient.bucketExists(BUCKET_NAME, (err, exists) => {
    if (err) return console.warn("MinIO check failed:", err.message);
    if (!exists) {
        minioClient.makeBucket(BUCKET_NAME, 'us-east-1', (err) => {
            if (err) console.error('MinIO bucket creation error:', err);
            else console.log(`✅ MinIO bucket '${BUCKET_NAME}' created`);
        });
    } else {
        console.log(`✅ MinIO bucket '${BUCKET_NAME}' ready`);
    }
});

// Multer Setup
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// ==========================================
// Express App Setup
// ==========================================
// Express App Setup
const app = express();

// 0. Public Health Check (Root level - for Docker)
app.get('/healthz', async (req, res) => {
    try {
        const health = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            services: { postgres: false, redis: false, minio: false, worker: false }
        };
        try { await pool.query('SELECT 1'); health.services.postgres = true; } catch (e) { }
        try { await redis.ping(); health.services.redis = true; } catch (e) { }
        try { await new Promise((r, j) => minioClient.listBuckets((e) => e ? j(e) : r())); health.services.minio = true; } catch (e) { }
        try {
            const WORKER_URL = process.env.WORKER_URL || 'http://worker:8001';
            await axios.get(`${WORKER_URL}/health`, { timeout: 1000 });
            health.services.worker = true;
        } catch (e) { }

        res.status(200).json(health);
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// 1. Basic Middleware
app.use((req, res, next) => { console.log(`[DEBUG] Request ${req.method} ${req.url} started`); next(); });

app.use(cors({
    origin: function (origin, callback) { return callback(null, true); },
    credentials: true
}));

app.use((req, res, next) => { console.log('[DEBUG] CORS passed'); next(); });

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => { console.log('[DEBUG] Body parser passed'); next(); });

// 2. Security Headers (Phase 4)
configureSecurityHeaders(app);

app.use((req, res, next) => { console.log('[DEBUG] Security Headers passed'); next(); });

// 3. Input Sanitization (Phase 4)
app.use(sanitizeBody);

app.use((req, res, next) => { console.log('[DEBUG] Sanitizer passed'); next(); });

// 4. Rate Limiting (Phase 4)
app.use('/api', (req, res, next) => { console.log('[DEBUG] Entering Rate Limiter'); next(); }, apiLimiter);

app.use((req, res, next) => { console.log('[DEBUG] Rate Limiter passed'); next(); });

// 5. Database Context (Phase 4)
app.use((req, res, next) => {
    req.db = pool;
    req.redis = redis;
    next();
});


// ==========================================
// Routes
// ==========================================

// Standard Auth System
const authRoutes = require('./routes/auth');
app.use('/api/auth', (req, res, next) => { console.log('[DEBUG] Entering Auth Routes'); next(); }, authRoutes);
console.log('✅ Auth System mounted at /api/auth');

// User Setup Routes
const userSetupRoutes = require('./routes/userSetup');
app.use('/api/user', authenticateJWT, (req, res, next) => {
    console.log(`[DEBUG] Handling User Route: ${req.url}`);
    next();
}, userSetupRoutes);
console.log('✅ User Setup mounted at /api/user');

// Session Routes (Phase 16)
app.use('/api/session', require('./routes/session'));
console.log('✅ Session Routes mounted at /api/session');

// Admin Routes (for user management)
const adminRoutes = require('./routes/admin');
app.use('/api/admin', authenticateJWT, adminRoutes);
console.log('✅ Admin Routes mounted at /api/admin');

// Dev Routes (for testing/token generation)
const devAuthRoutes = require('./routes/devAuth');
app.use('/api', devAuthRoutes);

// Ingestion Routes (Phase 12 Fix)
const ingestRoutes = require('./routes/ingest');
// Make DB pool available to ingest routes
app.set('pool', pool);
app.use('/api/ingest', authenticateJWT, (req, res, next) => {
    console.log(`[DEBUG] Handling Ingest Route: ${req.url}`);
    next();
}, ingestRoutes);
console.log('✅ Ingestion Routes mounted at /api/ingest');

// Documents Upload Routes (University Dataset Integration)
const documentsRoutes = require('./routes/documents');
app.use('/api/documents', authenticateJWT, documentsRoutes);
console.log('✅ Documents Routes mounted at /api/documents');

// Organizations Routes (Super Admin)
const orgsRoutes = require('./routes/orgs');
app.use('/api/orgs', authenticateJWT, orgsRoutes);
console.log('✅ Organizations Routes mounted at /api/orgs');

// Profile Routes (All authenticated users)
const profileRoutes = require('./routes/profile');
app.use('/api/profile', authenticateJWT, profileRoutes);
console.log('✅ Profile Routes mounted at /api/profile');

// Audit Routes (Security Center)
const auditRoutes = require('./routes/audit');
app.use('/api/audit', authenticateJWT, auditRoutes);
console.log('✅ Audit Routes mounted at /api/audit');

// Notifications Routes
const notificationRoutes = require('./routes/notifications');
app.use('/api/notifications', authenticateJWT, notificationRoutes);
console.log('✅ Notifications Routes mounted at /api/notifications');

// Chat & Search Routes
const chatRoutes = require('./routes/chat');
app.use('/api', chatRoutes);
console.log('✅ Chat & Search mounted at /api');

// try {
//     const authRoutes = require('./routes/auth');
//     app.use('/api/auth', (req, res, next) => { console.log('[DEBUG] Entering Auth Routes'); next(); }, authRoutes);
//     console.log('✅ Phase 4 Auth Routes mounted at /api/auth');
// } catch (error) {
//     console.error('❌ Failed to mount auth routes:', error.message);
// }


// 3. Document Upload (Authenticated + Anomaly Check)
app.post('/api/upload', authenticateJWT, anomalyDetectionMiddleware, async (req, res, next) => {
    try {
        await attachUserId(req, res, async () => {
            upload.single('file')(req, res, async (err) => {
                if (err) return next(err);
                if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

                const fileName = req.file.originalname;
                const fileBuffer = fs.readFileSync(req.file.path);
                const fileKey = `${Date.now()}-${fileName}`;

                try {
                    // Encrypt the file using Envelope Encryption
                    const { encryptedData, encryptedDEK, iv, authTag } = encryptEnvelope(fileBuffer);

                    // Upload encrypted data to MinIO
                    await minioClient.putObject(BUCKET_NAME, fileKey, encryptedData, encryptedData.length);

                    const uploaderId = req.user?.id || (req.user?.sub ? Number(req.user.sub) : null);
                    const result = await pool.query(
                        `INSERT INTO documents 
                         (file_key, filename, status, uploaded_by, is_encrypted, encrypted_dek, encryption_iv, encryption_tag, file_size) 
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
                         RETURNING id`,
                        [fileKey, fileName, 'pending', uploaderId, true, encryptedDEK, iv, authTag, req.file.size]
                    );

                    console.log(`[ALE-UPLOAD] user=${uploaderId} file=${fileName} key=${fileKey} (Encrypted)`);

                    const jobData = {
                        key: fileKey,
                        filename: fileName,
                        document_id: result.rows[0].id,
                        uploaded_at: new Date().toISOString()
                    };
                    await redis.lpush('document_jobs', JSON.stringify(jobData));
                    fs.unlinkSync(filePath);

                    res.json({
                        success: true,
                        message: 'File uploaded successfully',
                        document: result.rows[0]
                    });
                } catch (error) {
                    try { fs.unlinkSync(filePath); } catch (e) { }
                    throw error;
                }
            });
        });
    } catch (error) {
        next(error);
    }
});

// 4. Document List
app.get('/api/documents', authenticateJWT, async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        const result = await pool.query(
            'SELECT id, filename, status, content_preview, created_at, processed_at FROM documents ORDER BY created_at DESC LIMIT $1 OFFSET $2',
            [limit, offset]
        );
        const count = await pool.query('SELECT COUNT(*) FROM documents');
        res.json({
            documents: result.rows,
            pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(count.rows[0].count) }
        });
    } catch (error) {
        next(error);
    }
});

// 5. Document Download
app.get('/api/download/:id', authenticateJWT, anomalyDetectionMiddleware, async (req, res, next) => {
    try {
        const result = await pool.query(
            'SELECT file_key, filename, is_encrypted, encrypted_dek, encryption_iv, encryption_tag FROM documents WHERE id = $1',
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Document not found' });

        const { file_key, filename, is_encrypted, encrypted_dek, encryption_iv, encryption_tag } = result.rows[0];

        const { decryptEnvelope } = require('./security/cryptoManager');

        minioClient.getObject(BUCKET_NAME, file_key, (err, stream) => {
            if (err) return res.status(404).json({ error: 'File not found in storage' });

            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            if (is_encrypted) {
                const chunks = [];
                stream.on('data', chunk => chunks.push(chunk));
                stream.on('end', () => {
                    try {
                        const encryptedBuffer = Buffer.concat(chunks);
                        const decryptedBuffer = decryptEnvelope(encryptedBuffer, encrypted_dek, encryption_iv, encryption_tag);
                        res.send(decryptedBuffer);
                    } catch (decErr) {
                        console.error('[ALE] Download decryption failed:', decErr.message);
                        res.status(500).json({ error: 'Failed to decrypt document' });
                    }
                });
                stream.on('error', (streamErr) => {
                    res.status(500).json({ error: 'Stream error during download' });
                });
            } else {
                stream.pipe(res);
            }
        });
    } catch (error) {
        next(error);
    }
});

// 6. Search and Chat routes are now handled by routes/chat.js (mounted at line 204)
// Commenting out duplicate inline definitions to prevent routing conflicts
/*
// 6. Search (ABAC Protected)
app.post('/api/search', authenticateJWT, abacMiddleware('search'), anomalyDetectionMiddleware, async (req, res, next) => {
    try {
        await attachUserId(req, res, async () => {
            const userForWorker = {
                ...req.user,
                id: (req.user && (req.user.id || req.user.sub)) ? Number(req.user.id || req.user.sub) : null
            };

            const headersToForward = {
                Authorization: req.get('Authorization') || '',
                'x-user-b64': userForWorker ? Buffer.from(JSON.stringify(userForWorker)).toString('base64') : ''
            };

            const response = await axios.post(`${WORKER_URL}/search`, {
                user: userForWorker,
                query: req.body.query,
                top_k: req.body.top_k || 5
            }, { headers: headersToForward, timeout: 30000 });

            res.json(response.data);
        });
    } catch (error) {
        next(error);
    }
});

// 7. Chat
app.post('/api/chat', authenticateJWT, anomalyDetectionMiddleware, async (req, res, next) => {
    try {
        await attachUserId(req, res, async () => {
            const userForWorker = {
                ...req.user,
                id: (req.user && (req.user.id || req.user.sub)) ? Number(req.user.id || req.user.sub) : null
            };

            const headersToForward = {
                Authorization: req.get('Authorization') || '',
                'x-user-b64': userForWorker ? Buffer.from(JSON.stringify(userForWorker)).toString('base64') : ''
            };

            const response = await axios.post(`${WORKER_URL}/chat`, {
                user: userForWorker,
                query: req.body.query,
                context: req.body.context
            }, { headers: headersToForward, timeout: 60000 });

            res.json(response.data);
        });
    } catch (error) {
        next(error);
    }
});
*/

// Error Handling
app.use((error, req, res, next) => {
    console.error('================================================');
    console.error('CRITICAL SERVER ERROR:', error);
    console.error('STACK:', error.stack);
    console.error('================================================');
    res.status(500).json({ error: 'Internal server error', details: error.message });
});

// Create HTTP Server
const server = http.createServer(app);

// Initialize Real-time Service
const realtime = new RealtimeService(server, pool);
app.set('realtime', realtime);

// Start
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`✅ Real-time Gateway & Application endpoints ready`);
});
