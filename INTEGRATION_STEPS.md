# Phase 4 Integration Steps

## Current Status
✅ **Phase 4 Core Components Built** (14 files created)
✅ **Dependencies Installed** (bcrypt, JWT, speakeasy, etc.)
✅ **JWT Secrets Generated** (in JWT_SECRETS.txt)
❌ **Not Yet Integrated** into main server

## Integration Steps

### Step 1: Update .env File ⚠️ **REQUIRED**

Open `C:\project3\AntiGravity\PRIVACY-AWARE-RAG-GUIDE-CUR\.env` and add:

```env
# Replace existing JWT_SECRET line with these:
JWT_SECRET=7f3a8b9c2e1d4f6a8c9b2e3d4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a
JWT_REFRESH_SECRET=3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c

# Add if not present:
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

### Step 2: Run Database Migration 📊 **CRITICAL**

```bash
# Option A: Using psql command line
psql -U postgres -d privacy_docs -f "C:\project3\AntiGravity\PRIVACY-AWARE-RAG-GUIDE-CUR\backend\database\migrations\004_auth_system.sql"

# Option B: Using pgAdmin
# 1. Open pgAdmin
# 2. Connect to privacy_docs database
# 3. Tools > Query Tool
# 4. File > Open > Select 004_auth_system.sql
# 5. Execute (F5)
```

**This creates 5 new tables**:
- `auth_sessions` - JWT session management
- `password_reset_tokens` - OTP codes
- `mfa_secrets` - 2FA secrets
- `password_history` - Password reuse prevention  
- `audit_log` - Security event tracking

### Step 3: Integrate into Main Server 🔧

**Option A: Quick Integration (Recommended for Testing)**

Add these lines to `backend/api/index.js` **AFTER line 110** (after other middleware):

```javascript
// Phase 4: Auth System Integration
const { configureSecurityHeaders } = require('./middleware/securityHeaders');
const { apiLimiter } = require('./middleware/rateLimiter');
const { sanitizeBody } = require('./middleware/validator');
const phase4AuthRoutes = require('./routes/auth');

// Security headers
configureSecurityHeaders(app);

// Input sanitization
app.use(sanitizeBody);

// Attach database to requests
app.use((req, res, next) => { req.db = pool; next(); });

// Phase 4 auth routes (replaces existing /api/auth/* endpoints)
app.use('/api/auth', phase4AuthRoutes);

// Rate limiting
app.use('/api', apiLimiter);
```

**Option B: Full Integration (Production Ready)**

See `PHASE4_INTEGRATION.js` for complete integration code with anomaly detection.

### Step 4: Test the System ✅

```bash
# 1. Start server
cd backend/api
node index.js

# 2. Test registration
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@university.edu",
    "password": "SecurePass123!@#",
    "username": "testuser",
    "role": "student",
    "department_id": "DEPT_CS",
    "organization_id": "ORG001"
  }'

# 3. Test login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@university.edu",
    "password": "SecurePass123!@#"
  }'

# Should return: accessToken, refreshToken, and user object
```

### Step 5: Verify Database Tables 🔍

```sql
-- Check if tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('auth_sessions', 'password_reset_tokens', 'mfa_secrets', 'password_history', 'audit_log');

-- Should show all 5 tables

-- Check user table modifications
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('password_hash', 'organization_id', 'is_mfa_enabled', 'failed_login_attempts');

-- Should show all 4 added columns
```

## What's Next?

After integration:

1. **Test All Endpoints** (see PHASE4_SETUP_GUIDE.md)
2. **Migrate Existing Users** from CSV (create migration script)
3. **Update Frontend** to use new auth flow
4. **Enable MFA** for specific users
5. **Configure Email** for OTP delivery (production)

## Troubleshooting

**Error: Cannot find module './routes/auth'**
→ Check that `backend/api/routes/auth.js` exists

**Error: JWT_SECRET not configured**
→ Update `.env` with generated secrets

**Error: relation "auth_sessions" does not exist**
→ Run database migration (Step 2)

**Error: ECONNREFUSED (port 5432)**
→ Start PostgreSQL database

## Files to Review

- `PHASE4_SETUP_GUIDE.md` - Complete deployment guide
- `PHASE4_INTEGRATION.js` - Full integration code
- `JWT_SECRETS.txt` - Generated secrets
- `backend/api/routes/auth.js` - 10 auth endpoints
- `backend/database/migrations/004_auth_system.sql` - Database schema

**Status**: ⚠️ Ready for Integration - Follow steps above to complete setup
