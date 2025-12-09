# Restore clean index.js with ONLY Phase 4 active
file_path = r'C:\project3\AntiGravity\PRIVACY-AWARE-RAG-GUIDE-CUR\backend\api\index.js'

content = """require('dotenv').config({ path: '../../.env' }); // Load from project root

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

// Route imports
// const superAdminRoutes = require('./routes/superAdmin');
// const adminRoutes = require('./routes/admin');
// const devAuth = require('./routes/devAuth');
// const userSetupRoutes = require('./routes/userSetup');
// const ingestRoutes = require('./routes/ingest');

const PORT = process.env.PORT || 3001;

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379/0', {
    retryStrategy: (times) => Math.min(times * 50, 2000),
    maxRetriesPerRequest: 3
});
redis.on('error', (err) => console.warn('Redis warning:', err.message));

// MinIO connection
const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_HOST || 'minio',
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123'
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'privacy-documents';

// Express app setup
const app = express();

// Middleware
app.use(cors({
    origin: function(origin, callback) {
        return callback(null, true); // Allow all for now to fix issues
    },
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==================== PHASE 4 AUTH SYSTEM ====================
console.log('🔐 Initializing Phase 4 Auth System...');

// Attach database to all requests
app.use((req, res, next) => { 
    req.db = pool; 
    next(); 
});

// Mount Phase 4 auth routes
try {
    const phase4AuthRoutes = require('./routes/auth');
    app.use('/api/auth/phase4', phase4AuthRoutes); // Mount at proper path
    console.log('✅ Phase 4 Auth System mounted at /api/auth/phase4/*');
} catch (error) {
    console.error('⚠️  Phase 4 failed to load:', error.message);
}
// =============================================================

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Auth endpoints available at: http://localhost:${PORT}/api/auth/phase4/me`);
});
"""

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Index.js restored with ONLY Phase 4 (Isolation Mode)")
