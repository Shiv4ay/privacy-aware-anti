// Minimal server to test Phase 4
require('dotenv').config({ path: '../../.env' });
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = 3002; // Different port to avoid conflicts

// DB
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Attach DB
app.use((req, res, next) => {
    req.db = pool;
    next();
});

// Mount Phase 4
console.log('Mounting Phase 4 routes...');
try {
    const authRoutes = require('./routes/auth');
    app.use('/api/auth/phase4', authRoutes);
    console.log('✅ Mounted Phase 4 routes');
} catch (e) {
    console.error('❌ Failed to mount:', e);
}

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
    console.log(`Minimal server running on port ${PORT}`);
    console.log(`Test URL: http://localhost:${PORT}/api/auth/phase4/me`);
});
