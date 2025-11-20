// // backend/api/index.js
// require('dotenv').config();

// const express = require('express');
// const { Pool } = require('pg');
// const Redis = require('ioredis');
// const axios = require('axios');
// const Minio = require('minio');
// const multer = require('multer');
// const fs = require('fs');
// const cors = require('cors');
// const path = require('path');
// const jwt = require('jsonwebtoken');

// const { abacMiddleware } = require('./middleware/abacMiddleware');
// const { attachUserId } = require('./middleware/attachUserId');
// // If you keep an auth middleware file, require it; otherwise keep your inline function below.
// // const authMiddleware = require('./middleware/authMiddleware');

// const PORT = process.env.PORT || 3001;

// // Database connection
// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
// });

// // Redis connection
// const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379/0');

// // Service URLs
// const WORKER_URL = process.env.WORKER_URL || 'http://worker:8001';

// // ---------- Robust MinIO init (inserted) ----------
// const url = require('url');

// function parseMinio(raw) {
//   if (!raw) return null;
//   raw = String(raw).trim();

//   if (raw.startsWith('http://') || raw.startsWith('https://')) {
//     const p = url.parse(raw);
//     return {
//       host: p.hostname,
//       port: p.port ? parseInt(p.port, 10) : (p.protocol === 'https:' ? 443 : 80),
//       useSSL: p.protocol === 'https:'
//     };
//   }

//   if (raw.includes('/')) raw = raw.split('/')[0];

//   if (raw.includes(':')) {
//     const parts = raw.split(':');
//     return { host: parts[0], port: parseInt(parts[1] || '9000', 10), useSSL: false };
//   }

//   return { host: raw, port: 9000, useSSL: false };
// }

// const MINIO_RAW = process.env.MINIO_ENDPOINT || `${process.env.MINIO_HOST || 'minio'}:${process.env.MINIO_PORT || '9000'}`;
// const _m = parseMinio(MINIO_RAW);

// const MINIO_HOST = _m.host;
// const MINIO_PORT = _m.port;
// const MINIO_USE_SSL = _m.useSSL;

// const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || process.env.MINIO_ACCESS_KEY;
// const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || process.env.MINIO_SECRET_KEY;

// const minioClient = new Minio.Client({
//   endPoint: MINIO_HOST,
//   port: Number(MINIO_PORT),
//   useSSL: !!MINIO_USE_SSL,
//   accessKey: MINIO_ACCESS_KEY,
//   secretKey: MINIO_SECRET_KEY
// });

// // quick check (non-blocking)
// minioClient.listBuckets((err, buckets) => {
//   if (err) console.warn("MinIO listBuckets check failed:", err.message || err);
//   else console.log("MinIO connected. Buckets:", (buckets || []).map(b => b.name));
// });
// // ---------- End MinIO init ----------

// const BUCKET_NAME = process.env.MINIO_BUCKET || 'privacy-documents';

// // Express app setup
// const app = express();

// // Middleware
// app.use(cors({
//   origin: process.env.FRONTEND_URL || 'http://localhost:3000',
//   credentials: true
// }));
// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// // Development-only token endpoint registration (do not run in production)
// if (process.env.NODE_ENV === 'development') {
//   try {
//     const devAuth = require('./routes/devAuth');
//     app.use('/api', devAuth); // exposes POST /api/dev/token
//     console.log('Dev auth route enabled at POST /api/dev/token');
//   } catch (e) {
//     console.warn('Dev auth route not found or failed to load — skipping dev token endpoint.');
//   }
// }

// // -----------------------------
// // Simple Auth middleware that verifies Bearer JWT and attaches req.user
// // -----------------------------
// function authMiddleware(req, res, next) {
//     const auth = req.get('Authorization') || req.get('authorization') || '';
//     if (!auth || !auth.startsWith('Bearer ')) {
//         return res.status(401).json({ error: 'Missing token' });
//     }
//     const token = auth.slice(7).trim();
//     try {
//         const secret = process.env.JWT_SECRET;
//         if (!secret) {
//             console.error('JWT_SECRET not set in environment');
//             return res.status(500).json({ error: 'Server misconfigured' });
//         }
//         const payload = jwt.verify(token, secret);
//         req.user = payload;
//         return next();
//     } catch (err) {
//         console.error('Token verification failed:', err.message || err);
//         return res.status(401).json({ error: 'Invalid token' });
//     }
// }

// // Multer configuration for file uploads
// const upload = multer({
//     dest: 'uploads/',
//     limits: {
//         fileSize: 50 * 1024 * 1024 // 50MB limit
//     }
// });

// // Ensure MinIO bucket exists
// minioClient.bucketExists(BUCKET_NAME, (err, exists) => {
//     if (err) {
//         console.error('MinIO bucket check error:', err);
//         return;
//     }

//     if (!exists) {
//         minioClient.makeBucket(BUCKET_NAME, 'us-east-1', (err) => {
//             if (err) {
//                 console.error('MinIO bucket creation error:', err);
//             } else {
//                 console.log(`MinIO bucket '${BUCKET_NAME}' created successfully`);
//             }
//         });
//     } else {
//         console.log(`MinIO bucket '${BUCKET_NAME}' exists`);
//     }
// });

// // -----------------------------
// // Health Check Endpoint
// // -----------------------------
// app.get('/api/health', async (req, res) => {
//     const healthChecks = {
//         postgres: false,
//         redis: false,
//         worker: false,
//         minio: false,
//         timestamp: new Date().toISOString()
//     };

//     // Check PostgreSQL
//     try {
//         await pool.query('SELECT 1');
//         healthChecks.postgres = true;
//     } catch (error) {
//         healthChecks.postgres_error = error.message;
//     }

//     // Check Redis
//     try {
//         const pong = await redis.ping();
//         healthChecks.redis = pong === 'PONG';
//     } catch (error) {
//         healthChecks.redis_error = error.message;
//     }

//     // Check Worker service
//     try {
//         const response = await axios.get(`${WORKER_URL}/health`, { timeout: 5000 });
//         healthChecks.worker = response.status === 200;
//         healthChecks.worker_details = response.data;
//     } catch (error) {
//         healthChecks.worker_error = error.message;
//     }

//     // Check MinIO
//     try {
//         await new Promise((resolve, reject) => {
//             minioClient.bucketExists(BUCKET_NAME, (err, exists) => {
//                 if (err) return reject(err);
//                 healthChecks.minio = exists;
//                 resolve();
//             });
//         });
//     } catch (error) {
//         healthChecks.minio_error = error.message;
//     }

//     const overallStatus = healthChecks.postgres && healthChecks.redis && healthChecks.worker && healthChecks.minio
//         ? 'healthy' : 'degraded';

//     res.json({
//         status: overallStatus,
//         checks: healthChecks
//     });
// });

// // -----------------------------
// // Document Upload Endpoint (requires auth)
// // -----------------------------
// app.post('/api/upload', authMiddleware, async (req, res, next) => {
//     try {
//         // ensure attachUserId runs and populates req.user.id if possible
//         await attachUserId(req, res, async () => {
//             // multer handler
//             upload.single('file')(req, res, async (err) => {
//                 if (err) return next(err);
//                 if (!req.file) {
//                     return res.status(400).json({
//                         error: 'No file uploaded',
//                         details: 'Please select a file to upload'
//                     });
//                 }

//                 const fileName = req.file.originalname;
//                 const filePath = req.file.path;
//                 const fileKey = `${Date.now()}-${fileName}`;

//                 try {
//                     // Upload file to MinIO
//                     const fileStream = fs.createReadStream(filePath);
//                     const fileStats = fs.statSync(filePath);

//                     await new Promise((resolve, reject) => {
//                         minioClient.putObject(BUCKET_NAME, fileKey, fileStream, fileStats.size, (err, etag) => {
//                             if (err) return reject(err);
//                             resolve(etag);
//                         });
//                     });

//                     // Store document record in database; use numeric id or sub if id missing
//                     const uploaderId = req.user?.id || (req.user?.sub ? Number(req.user.sub) : null);
//                     const result = await pool.query(
//                         'INSERT INTO documents (file_key, filename, status, uploaded_by) VALUES ($1, $2, $3, $4) RETURNING id',
//                         [fileKey, fileName, 'pending', uploaderId]
//                     );

//                     // LOG PATCH: Log uploads clearly for easier debugging
//                     // This is the single tiny safe addition you requested.
//                     console.log(`[UPLOAD] user=${uploaderId} file=${fileName} key=${fileKey}`);

//                     // Queue processing job
//                     const jobData = {
//                         key: fileKey,
//                         filename: fileName,
//                         document_id: result.rows[0].id,
//                         uploaded_at: new Date().toISOString()
//                     };

//                     await redis.lpush('document_jobs', JSON.stringify(jobData));

//                     // Clean up temporary file
//                     fs.unlinkSync(filePath);

//                     res.json({
//                         success: true,
//                         message: 'File uploaded successfully and queued for processing',
//                         document: {
//                             id: result.rows[0].id,
//                             filename: fileName,
//                             file_key: fileKey,
//                             status: 'pending'
//                         }
//                     });

//                 } catch (error) {
//                     console.error('Upload error:', error);

//                     // Clean up temporary file
//                     try {
//                         fs.unlinkSync(filePath);
//                     } catch (cleanupError) {
//                         console.error('Cleanup error:', cleanupError);
//                     }

//                     res.status(500).json({
//                         error: 'Upload failed',
//                         details: error.message
//                     });
//                 }
//             });
//         });
//     } catch (err) {
//         next(err);
//     }
// });

// // -----------------------------
// // Document List Endpoint (requires auth)
// // -----------------------------
// app.get('/api/documents', authMiddleware, async (req, res) => {
//     try {
//         await attachUserId(req, res, async () => {
//             const { page = 1, limit = 20 } = req.query;
//             const offset = (page - 1) * limit;

//             const result = await pool.query(
//                 'SELECT id, filename, status, content_preview, created_at, processed_at FROM documents ORDER BY created_at DESC LIMIT $1 OFFSET $2',
//                 [limit, offset]
//             );

//             const countResult = await pool.query('SELECT COUNT(*) FROM documents');
//             const total = parseInt(countResult.rows[0].count);

//             res.json({
//                 documents: result.rows,
//                 pagination: {
//                     page: parseInt(page),
//                     limit: parseInt(limit),
//                     total,
//                     pages: Math.ceil(total / limit)
//                 }
//             });
//         });
//     } catch (error) {
//         console.error('Document list error:', error);
//         res.status(500).json({
//             error: 'Failed to fetch documents',
//             details: error.message
//         });
//     }
// });

// // -----------------------------
// // Document Download Endpoint (requires auth)
// // -----------------------------
// app.get('/api/download/:id', authMiddleware, async (req, res, next) => {
//     try {
//         await attachUserId(req, res, async () => {
//             const documentId = req.params.id;

//             const result = await pool.query(
//                 'SELECT file_key, filename FROM documents WHERE id = $1',
//                 [documentId]
//             );

//             if (result.rows.length === 0) {
//                 return res.status(404).json({ error: 'Document not found' });
//             }

//             const { file_key, filename } = result.rows[0];

//             minioClient.getObject(BUCKET_NAME, file_key, (err, dataStream) => {
//                 if (err) {
//                     console.error('MinIO download error:', err);
//                     return res.status(404).json({ error: 'File not found in storage' });
//                 }

//                 res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
//                 res.setHeader('Content-Type', 'application/octet-stream');
//                 dataStream.pipe(res);
//             });
//         });
//     } catch (error) {
//         next(error);
//     }
// });

// // -----------------------------
// // Search Endpoint (ABAC-protected) - requires auth + ABAC
// // -----------------------------
// app.post('/api/search', authMiddleware, abacMiddleware('search'), async (req, res) => {
//     const { query, top_k = 5 } = req.body;

//     if (!query || typeof query !== 'string' || query.trim().length === 0) {
//         return res.status(400).json({
//             error: 'Missing or invalid query',
//             details: 'Query must be a non-empty string'
//         });
//     }

//     try {
//         await attachUserId(req, res, async () => {
//             // ensure numeric id is present (map sub -> id if needed)
//             const userForWorker = {
//                 ...req.user,
//                 id: (req.user && (req.user.id || req.user.sub)) ? Number(req.user.id || req.user.sub) : null
//             };

//             const payload = {
//                 user: userForWorker,
//                 query: query.trim(),
//                 top_k,
//                 client_ip: req.ip,
//                 user_agent: req.get('User-Agent')
//             };

//             // Forward Authorization + compact user to worker
//             const headersToForward = {
//               Authorization: req.get('Authorization') || req.get('authorization') || '',
//               'x-user-b64': userForWorker ? Buffer.from(JSON.stringify(userForWorker)).toString('base64') : ''
//             };

//             const response = await axios.post(`${WORKER_URL}/search`, payload, {
//                 timeout: 30000,
//                 headers: headersToForward
//             });

//             res.json({
//                 success: true,
//                 ...response.data
//             });
//         });
//     } catch (error) {
//         console.error('Search error:', error);

//         let errorMessage = 'Search failed';
//         let statusCode = 500;

//         if (error.response) {
//             errorMessage = error.response.data?.detail || error.response.data?.error || errorMessage;
//             statusCode = error.response.status;
//         } else if (error.code === 'ECONNREFUSED') {
//             errorMessage = 'Search service unavailable';
//             statusCode = 503;
//         } else if (error.code === 'ECONNABORTED') {
//             errorMessage = 'Search request timed out';
//             statusCode = 504;
//         }

//         res.status(statusCode).json({
//             error: errorMessage,
//             details: error.message
//         });
//     }
// });

// // -----------------------------
// // Chat Endpoint (requires auth)
// // -----------------------------
// app.post('/api/chat', authMiddleware, async (req, res) => {
//     const { query, context } = req.body;

//     if (!query || typeof query !== 'string' || query.trim().length === 0) {
//         return res.status(400).json({
//             error: 'Missing or invalid query',
//             details: 'Query must be a non-empty string'
//         });
//     }

//     try {
//         await attachUserId(req, res, async () => {
//             const userForWorker = {
//                 ...req.user,
//                 id: (req.user && (req.user.id || req.user.sub)) ? Number(req.user.id || req.user.sub) : null
//             };

//             const payload = {
//                 user: userForWorker,
//                 query: query.trim(),
//                 context
//             };

//             // Forward Authorization + compact user to worker
//             const headersToForward = {
//               Authorization: req.get('Authorization') || req.get('authorization') || '',
//               'x-user-b64': userForWorker ? Buffer.from(JSON.stringify(userForWorker)).toString('base64') : ''
//             };

//             const response = await axios.post(`${WORKER_URL}/chat`, payload, {
//                 timeout: 60000, // Longer timeout for chat responses
//                 headers: headersToForward
//             });

//             res.json({
//                 success: true,
//                 ...response.data
//             });
//         });
//     } catch (error) {
//         console.error('Chat error:', error);

//         let errorMessage = 'Chat failed';
//         let statusCode = 500;

//         if (error.response) {
//             errorMessage = error.response.data?.detail || error.response.data?.error || errorMessage;
//             statusCode = error.response.status;
//         } else if (error.code === 'ECONNREFUSED') {
//             errorMessage = 'Chat service unavailable';
//             statusCode = 503;
//         }

//         res.status(statusCode).json({
//             error: errorMessage,
//             details: error.message
//         });
//     }
// });

// // -----------------------------
// // Document Status Endpoint (requires auth)
// // -----------------------------
// app.get('/api/documents/:id/status', authMiddleware, async (req, res) => {
//     try {
//         await attachUserId(req, res, async () => {
//             const documentId = req.params.id;

//             const result = await pool.query(
//                 'SELECT id, filename, status, created_at, processed_at FROM documents WHERE id = $1',
//                 [documentId]
//             );

//             if (result.rows.length === 0) {
//                 return res.status(404).json({ error: 'Document not found' });
//             }

//             res.json({
//                 success: true,
//                 document: result.rows[0]
//             });
//         });
//     } catch (error) {
//         console.error('Status check error:', error);
//         res.status(500).json({
//             error: 'Status check failed',
//             details: error.message
//         });
//     }
// });

// // -----------------------------
// // Error handling middleware
// // -----------------------------
// app.use((error, req, res, next) => {
//     console.error('Unhandled error:', error);
//     res.status(500).json({
//         error: 'Internal server error',
//         details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
//     });
// });

// // 404 handler
// app.use((req, res) => {
//     res.status(404).json({
//         error: 'Endpoint not found',
//         path: req.path
//     });
// });

// // -----------------------------
// // Server startup
// // -----------------------------
// app.listen(PORT, '0.0.0.0', () => {
//     console.log(`Privacy-Aware RAG API Gateway listening on port ${PORT}`);
//     console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
// });

// // Graceful shutdown
// process.on('SIGTERM', () => {
//     console.log('SIGTERM received, shutting down gracefully');
//     process.exit(0);
// });

// process.on('SIGINT', () => {
//     console.log('SIGINT received, shutting down gracefully');
//     process.exit(0);
// });


// backend/api/index.js
require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const Redis = require('ioredis');
const axios = require('axios');
const Minio = require('minio');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');

const { abacMiddleware } = require('./middleware/abacMiddleware');
const { attachUserId } = require('./middleware/attachUserId');
// const authMiddleware = require('./middleware/authMiddleware');

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

// ---------- Robust MinIO init (inserted) ----------
const url = require('url');

function parseMinio(raw) {
    if (!raw) return null;
    raw = String(raw).trim();

    if (raw.startsWith('http://') || raw.startsWith('https://')) {
        const p = url.parse(raw);
        return {
            host: p.hostname,
            port: p.port ? parseInt(p.port, 10) : (p.protocol === 'https:' ? 443 : 80),
            useSSL: p.protocol === 'https:'
        };
    }

    if (raw.includes('/')) raw = raw.split('/')[0];

    if (raw.includes(':')) {
        const parts = raw.split(':');
        return { host: parts[0], port: parseInt(parts[1] || '9000', 10), useSSL: false };
    }

    return { host: raw, port: 9000, useSSL: false };
}

const MINIO_RAW = process.env.MINIO_ENDPOINT || `${process.env.MINIO_HOST || 'minio'}:${process.env.MINIO_PORT || '9000'}`;
const _m = parseMinio(MINIO_RAW);

const MINIO_HOST = _m.host;
const MINIO_PORT = _m.port;
const MINIO_USE_SSL = _m.useSSL;

const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || process.env.MINIO_ACCESS_KEY;
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || process.env.MINIO_SECRET_KEY;

const minioClient = new Minio.Client({
    endPoint: MINIO_HOST,
    port: Number(MINIO_PORT),
    useSSL: !!MINIO_USE_SSL,
    accessKey: MINIO_ACCESS_KEY,
    secretKey: MINIO_SECRET_KEY
});

// quick check (non-blocking)
minioClient.listBuckets((err, buckets) => {
    if (err) console.warn("MinIO listBuckets check failed:", err.message || err);
    else console.log("MinIO connected. Buckets:", (buckets || []).map(b => b.name));
});
// ---------- End MinIO init ----------

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

// Development-only token endpoint registration (do not run in production)
if (process.env.NODE_ENV === 'development') {
    try {
        const devAuth = require('./routes/devAuth');
        app.use('/api', devAuth); // exposes POST /api/dev/token
        console.log('Dev auth route enabled at POST /api/dev/token');
    } catch (e) {
        console.warn('Dev auth route not found or failed to load — skipping dev token endpoint.');
    }
}

// -----------------------------
// Simple Auth middleware that verifies Bearer JWT and attaches req.user
// Also supports dev auth key for development
// -----------------------------
function authMiddleware(req, res, next) {
    // Check for dev auth key first (development only)
    if (process.env.NODE_ENV === 'development') {
        const devAuthKey = req.get('x-dev-auth') || req.get('x-dev-auth-key');
        const expectedKey = process.env.DEV_AUTH_KEY || 'super-secret-dev-key';

        if (devAuthKey && devAuthKey === expectedKey) {
            // Create a dev user object
            req.user = {
                id: 1,
                sub: 1,
                username: 'dev-user',
                email: 'dev@localhost',
                name: 'Development User',
                roles: ['admin'],
                role: 'admin'
            };
            return next();
        }
    }

    // Standard JWT token verification
    const auth = req.get('Authorization') || req.get('authorization') || '';
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing token' });
    }
    const token = auth.slice(7).trim();
    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error('JWT_SECRET not set in environment');
            return res.status(500).json({ error: 'Server misconfigured' });
        }
        const payload = jwt.verify(token, secret);
        req.user = payload;
        return next();
    } catch (err) {
        console.error('Token verification failed:', err.message || err);
        return res.status(401).json({ error: 'Invalid token' });
    }
}

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
// Authentication Endpoints
// -----------------------------
const bcrypt = require('bcrypt');

// Ensure users table has password_hash column
async function ensurePasswordColumn() {
    try {
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS password_hash TEXT,
            ADD COLUMN IF NOT EXISTS name TEXT,
            ADD COLUMN IF NOT EXISTS email TEXT UNIQUE
        `);
        console.log('Users table schema verified/updated');
    } catch (err) {
        console.warn('Schema update warning (may already exist):', err.message);
    }
}
ensurePasswordColumn();

// Register endpoint
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password, organization, department, user_category } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                error: 'Missing required fields',
                details: 'Name, email, and password are required'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                error: 'Password too short',
                details: 'Password must be at least 6 characters'
            });
        }

        // Check if user exists
        const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            return res.status(409).json({ error: 'User already exists' });
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Insert user (default role: user)
        // We need to get the role_id for 'user'
        const roleResult = await pool.query("SELECT id FROM user_roles WHERE name = 'user'");
        const roleId = roleResult.rows[0]?.id || 2; // Default to 2 if not found

        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash, name, role_id, organization, department, user_category) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, username, email, name, role_id, created_at, organization, department, user_category`,
            [email.split('@')[0], email, passwordHash, name, roleId, organization || 'default', department || 'general', user_category || 'employee']
        );

        const user = result.rows[0];

        // Get role name
        const userRoleResult = await pool.query(
            'SELECT name FROM user_roles WHERE id = $1',
            [user.role_id]
        );
        const roleName = userRoleResult.rows[0]?.name || 'user';

        // Generate JWT token
        const token = jwt.sign(
            {
                sub: user.id,
                id: user.id,
                username: user.username,
                email: user.email,
                name: user.name,
                roles: [roleName],
                role: roleName,
                organization: user.organization,
                department: user.department,
                user_category: user.user_category
            },
            process.env.JWT_SECRET || 'jwtsecret123',
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                name: user.name,
                roles: [roleName],
                organization: user.organization,
                department: user.department,
                user_category: user.user_category
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            error: 'Registration failed',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Missing credentials',
                details: 'Email and password are required'
            });
        }

        // Find user by email or username
        const userResult = await pool.query(
            `SELECT u.id, u.username, u.email, u.name, u.password_hash, u.role_id, u.is_active, u.organization, u.department, u.user_category,
                    ur.name as role_name
             FROM users u
             LEFT JOIN user_roles ur ON u.role_id = ur.id
             WHERE u.email = $1 OR u.username = $1`,
            [email]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                error: 'Invalid credentials',
                details: 'Email or password incorrect'
            });
        }

        const user = userResult.rows[0];

        if (!user.is_active) {
            return res.status(403).json({ error: 'Account is disabled' });
        }

        // Verify password
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({
                error: 'Invalid credentials',
                details: 'Email or password incorrect'
            });
        }

        // Update last login
        await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

        // Get roles
        const roles = user.role_name ? [user.role_name] : ['user'];

        // Generate JWT token
        const token = jwt.sign(
            {
                sub: user.id,
                id: user.id,
                username: user.username,
                email: user.email,
                name: user.name,
                roles: roles,
                role: roles[0] || 'user',
                organization: user.organization,
                department: user.department,
                user_category: user.user_category
            },
            process.env.JWT_SECRET || 'jwtsecret123',
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                name: user.name,
                roles: roles,
                organization: user.organization,
                department: user.department,
                user_category: user.user_category
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: 'Login failed',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Get current user endpoint
app.get('/api/auth/me', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id || req.user.sub;

        const userResult = await pool.query(
            `SELECT u.id, u.username, u.email, u.name, u.role_id, u.is_active, u.created_at,
                    ur.name as role_name
             FROM users u
             LEFT JOIN user_roles ur ON u.role_id = ur.id
             WHERE u.id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        const user = userResult.rows[0];
        const roles = user.role_name ? [user.role_name] : ['user'];

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                name: user.name,
                roles: roles,
                created_at: user.created_at
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            error: 'Failed to get user',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
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
// Document Upload Endpoints (requires auth)
// Support both /api/upload and /api/documents/upload
// -----------------------------
const handleUpload = async (req, res, next) => {
    try {
        // ensure attachUserId runs and populates req.user.id if possible
        await attachUserId(req, res, async () => {
            // multer handler
            upload.single('file')(req, res, async (err) => {
                if (err) return next(err);
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

                    // Store document record in database; use numeric id or sub if id missing
                    const uploaderId = req.user?.id || (req.user?.sub ? Number(req.user.sub) : null);
                    const result = await pool.query(
                        'INSERT INTO documents (file_key, filename, status, uploaded_by) VALUES ($1, $2, $3, $4) RETURNING id',
                        [fileKey, fileName, 'pending', uploaderId]
                    );

                    console.log(`[UPLOAD] user=${uploaderId} file=${fileName} key=${fileKey}`);

                    // Queue processing job
                    const jobData = {
                        key: fileKey,
                        filename: fileName,
                        document_id: result.rows[0].id,
                        uploaded_at: new Date().toISOString(),
                        organization: req.user.organization || 'default',
                        department: req.user.department || 'general',
                        user_category: req.user.user_category || 'employee'
                    };

                    await redis.lpush('document_jobs', JSON.stringify(jobData));

                    // Clean up temporary file
                    fs.unlinkSync(filePath);

                    res.json({
                        success: true,
                        message: 'File uploaded successfully and queued for processing',
                        docId: result.rows[0].id, // Frontend expects docId
                        id: result.rows[0].id,
                        filename: fileName,
                        file_key: fileKey,
                        status: 'pending',
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
        });
    } catch (err) {
        next(err);
    }
};

// Register both endpoints
app.post('/api/upload', authMiddleware, handleUpload);
app.post('/api/documents/upload', authMiddleware, handleUpload);

// -----------------------------
// Document List Endpoint (requires auth)
// -----------------------------
app.get('/api/documents', authMiddleware, async (req, res) => {
    try {
        await attachUserId(req, res, async () => {
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
// Document Download Endpoint (requires auth)
// -----------------------------
app.get('/api/download/:id', authMiddleware, async (req, res, next) => {
    try {
        await attachUserId(req, res, async () => {
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
        });
    } catch (error) {
        next(error);
    }
});

// -----------------------------
// Search Endpoint (ABAC-protected) - requires auth + ABAC
// -----------------------------
app.post('/api/search', authMiddleware, abacMiddleware('search'), async (req, res) => {
    const { query, top_k = 5 } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({
            error: 'Missing or invalid query',
            details: 'Query must be a non-empty string'
        });
    }

    try {
        await attachUserId(req, res, async () => {
            const userForWorker = {
                ...req.user,
                id: (req.user && (req.user.id || req.user.sub)) ? Number(req.user.id || req.user.sub) : null
            };

            const payload = {
                user: userForWorker,
                query: query.trim(),
                top_k,
                client_ip: req.ip,
                user_agent: req.get('User-Agent'),
                organization: req.user.organization || 'default',
                department: req.user.department,
                user_category: req.user.user_category
            };

            const headersToForward = {
                Authorization: req.get('Authorization') || req.get('authorization') || '',
                'x-user-b64': userForWorker ? Buffer.from(JSON.stringify(userForWorker)).toString('base64') : '',
                'Content-Type': 'application/json'
            };

            const response = await axios.post(`${WORKER_URL}/search`, payload, {
                timeout: 30000,
                headers: headersToForward
            });

            // Forward all response data including privacy fields (query_redacted, query_hash, etc.)
            res.json({
                success: true,
                query: response.data?.query,
                query_redacted: response.data?.query_redacted, // Privacy: redacted query
                query_hash: response.data?.query_hash, // Privacy: hashed query for audit
                results: response.data?.results || [],
                total_found: response.data?.total_found || 0,
                ...response.data // Include any other fields
            });
        });
    } catch (error) {
        console.error('Search error:', error);

        let errorMessage = 'Search failed';
        let statusCode = 500;

        if (error.response) {
            // try to provide clear error info returned by worker
            console.error('Worker response data:', error.response.data);
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
// Chat Endpoint (requires auth)
// -----------------------------
app.post('/api/chat', authMiddleware, async (req, res) => {
    const { query, context } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({
            error: 'Missing or invalid query',
            details: 'Query must be a non-empty string'
        });
    }

    try {
        await attachUserId(req, res, async () => {
            const userForWorker = {
                ...req.user,
                id: (req.user && (req.user.id || req.user.sub)) ? Number(req.user.id || req.user.sub) : null
            };

            const payload = {
                user: userForWorker,
                query: query.trim(),
                context,
                organization: req.user.organization || 'default',
                department: req.user.department,
                user_category: req.user.user_category
            };

            const headersToForward = {
                Authorization: req.get('Authorization') || req.get('authorization') || '',
                'x-user-b64': userForWorker ? Buffer.from(JSON.stringify(userForWorker)).toString('base64') : '',
                'Content-Type': 'application/json'
            };

            const response = await axios.post(`${WORKER_URL}/chat`, payload, {
                timeout: 60000, // Longer timeout for chat responses
                headers: headersToForward
            });

            res.json({
                success: true,
                ...response.data
            });
        });
    } catch (error) {
        console.error('Chat error:', error);

        let errorMessage = 'Chat failed';
        let statusCode = 500;

        if (error.response) {
            console.error('Worker response data:', error.response.data);
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
// Document Status Endpoint (requires auth)
// -----------------------------
app.get('/api/documents/:id/status', authMiddleware, async (req, res) => {
    try {
        await attachUserId(req, res, async () => {
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
        });
    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({
            error: 'Status check failed',
            details: error.message
        });
    }
});

// Get Current User Profile
app.get('/api/auth/me', authMiddleware, async (req, res) => {
    try {
        const user = req.user;
        // Return user details including organization
        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            name: user.name, // Assuming name is in user object or fetch if needed
            roles: user.roles,
            organization: user.organization,
            department: user.department,
            user_category: user.user_category
        });
    } catch (error) {
        console.error('Auth check error:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

// -----------------------------
// Admin Endpoints (requires auth + admin role)
// -----------------------------

// Middleware to check for admin role
function adminMiddleware(req, res, next) {
    if (!req.user || !req.user.roles || (!req.user.roles.includes('admin') && !req.user.roles.includes('super_admin'))) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// List Users
app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '' } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT u.id, u.username, u.email, u.name, u.organization, u.department, u.user_category, u.is_active, u.created_at, u.last_login,
                   ur.name as role_name
            FROM users u
            LEFT JOIN user_roles ur ON u.role_id = ur.id
        `;

        const params = [limit, offset];

        if (search) {
            query += ` WHERE u.username ILIKE $3 OR u.email ILIKE $3 OR u.name ILIKE $3`;
            params.push(`%${search}%`);
        }

        query += ` ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`;

        const result = await pool.query(query, params);

        // Count total
        let countQuery = 'SELECT COUNT(*) FROM users u';
        const countParams = [];
        if (search) {
            countQuery += ` WHERE u.username ILIKE $1 OR u.email ILIKE $1 OR u.name ILIKE $1`;
            countParams.push(`%${search}%`);
        }
        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        res.json({
            users: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Admin list users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Update User (Role, Org, Department)
app.put('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const userId = req.params.id;
        const { role, organization, department, user_category, is_active } = req.body;

        // Get role_id
        let roleId = null;
        if (role) {
            const roleRes = await pool.query('SELECT id FROM user_roles WHERE name = $1', [role]);
            if (roleRes.rows.length > 0) {
                roleId = roleRes.rows[0].id;
            }
        }

        // Build update query dynamically
        const updates = [];
        const values = [];
        let idx = 1;

        if (roleId) { updates.push(`role_id = $${idx++}`); values.push(roleId); }
        if (organization) { updates.push(`organization = $${idx++}`); values.push(organization); }
        if (department) { updates.push(`department = $${idx++}`); values.push(department); }
        if (user_category) { updates.push(`user_category = $${idx++}`); values.push(user_category); }
        if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); values.push(is_active); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(userId);
        const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, username, email, role_id, organization, department, is_active`;

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            success: true,
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Admin update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Audit Logs
app.get('/api/admin/audit-logs', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { page = 1, limit = 20, user_id, action, start_date, end_date } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT a.*, u.username, u.email
            FROM audit_logs a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE 1=1
        `;
        const params = [];
        let idx = 1;

        if (user_id) { query += ` AND a.user_id = $${idx++}`; params.push(user_id); }
        if (action) { query += ` AND a.action = $${idx++}`; params.push(action); }
        if (start_date) { query += ` AND a.created_at >= $${idx++}`; params.push(start_date); }
        if (end_date) { query += ` AND a.created_at <= $${idx++}`; params.push(end_date); }

        // Filter by admin's organization if not super_admin (optional, for now global admin sees all)
        // if (!req.user.roles.includes('super_admin')) {
        //    query += ` AND u.organization = $${idx++}`; params.push(req.user.organization);
        // }

        query += ` ORDER BY a.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        // Count total (simplified)
        const countResult = await pool.query('SELECT COUNT(*) FROM audit_logs');
        const total = parseInt(countResult.rows[0].count);

        res.json({
            logs: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Admin audit logs error:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
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
