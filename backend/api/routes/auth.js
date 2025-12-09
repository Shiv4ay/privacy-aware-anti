/**
 * Authentication Routes
 * 10 endpoints for complete auth flow including registration, login, MFA, password reset
 * 
 * Endpoints:
 * - POST /auth/register - User registration
 * - POST /auth/login - Login with email/password
 * - POST /auth/refresh - Refresh access token
 * - POST /auth/logout - Invalidate tokens
 * - POST /auth/forgot-password - Request OTP for password reset
 * - POST /auth/reset-password - Reset password with OTP
 * - POST /auth/change-password - Change password (authenticated)
 * - POST /auth/mfa/setup - Enable MFA and get QR code
 * - POST /auth/mfa/verify - Verify MFA code
 * - GET /auth/me - Get current user profile
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// Auth managers
const jwtManager = require('../auth/jwtManager');
const passwordManager = require('../auth/passwordManager');
const mfaManager = require('../auth/mfaManager');

// Middleware
const { authenticateJWT } = require('../middleware/authMiddleware');

/**
 * Validation error handler
 */
function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
}

/**
 * 1. POST /auth/register
 * Register new user
 */
router.post('/register',
    [
        body('email').isEmail().normalizeEmail(),
        body('password').isString().notEmpty(),
        body('username').isString().isLength({ min: 3, max: 50 }),
        body('role').isIn(['student', 'faculty', 'auditor', 'guest']).optional()
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { email, password, username, role = 'student', department_id, organization_id } = req.body;

            // Validate password strength
            const passwordErrors = passwordManager.validatePasswordStrength(password);
            if (passwordErrors.length > 0) {
                return res.status(400).json({ errors: passwordErrors });
            }

            // Check if user exists
            const existingUser = await req.db.query(
                'SELECT user_id FROM users WHERE email = $1',
                [email]
            );

            if (existingUser.rows.length > 0) {
                return res.status(400).json({ error: 'User with this email already exists' });
            }

            // Hash password
            const passwordHash = await passwordManager.hashPassword(password);

            // Generate user ID
            const userIdResult = await req.db.query(
                'SELECT COALESCE(MAX(CAST(SUBSTRING(user_id FROM 4) AS INTEGER)), 0) + 1 as next_id FROM users'
            );
            const nextId = userIdResult.rows[0].next_id;
            const userId = `USR${String(nextId).padStart(5, '0')}`;

            // Insert user
            await req.db.query(
                `INSERT INTO users (user_id, username, email, password_hash, role, department_id, organization_id, is_active, created_at, last_password_change)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW(), NOW())`,
                [userId, username, email, passwordHash, role, department_id || null, organization_id || 'ORG001']
            );

            // Save password to history
            await passwordManager.savePasswordHistory(userId, passwordHash, req.db);

            // Log audit
            await req.db.query(
                `INSERT INTO audit_log (user_id, action, success) VALUES ($1, 'register', TRUE)`,
                [userId]
            );

            res.status(201).json({
                message: 'User registered successfully',
                userId,
                email
            });
        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({ error: 'Registration failed' });
        }
    }
);

/**
 * 2. POST /auth/login
 * Login with email and password
 */
router.post('/login',
    [
        body('email').isEmail().normalizeEmail(),
        body('password').isString().notEmpty()
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { email, password } = req.body;
            const ip = req.ip;

            // Get user
            const userResult = await req.db.query(
                `SELECT user_id, username, email, password_hash, role, department, org_id, entity_id,
                is_active, is_mfa_enabled, failed_login_attempts, locked_until
         FROM users 
         WHERE email = $1`,
                [email]
            );

            if (userResult.rows.length === 0) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const user = userResult.rows[0];

            // Check if account is locked
            if (user.locked_until && new Date(user.locked_until) > new Date()) {
                return res.status(401).json({
                    error: 'Account is temporarily locked',
                    lockedUntil: user.locked_until
                });
            }

            // Check if account is active
            if (!user.is_active) {
                return res.status(401).json({ error: 'Account is deactivated' });
            }

            // Verify password
            const passwordValid = await passwordManager.verifyPassword(password, user.password_hash);

            if (!passwordValid) {
                // Increment failed attempts
                const newAttempts = (user.failed_login_attempts || 0) + 1;
                let lockedUntil = null;

                if (newAttempts >= 5) {
                    lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
                    await passwordManager.sendSecurityEmail(
                        email,
                        'Account locked due to multiple failed login attempts',
                        user.username
                    );
                }

                await req.db.query(
                    `UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE user_id = $3`,
                    [newAttempts, lockedUntil, user.user_id]
                );

                // Log failed attempt
                await req.db.query(
                    `INSERT INTO audit_log (user_id, action, success, ip_address, error_message)
           VALUES ($1, 'login', FALSE, $2, 'Invalid password')`,
                    [user.user_id, ip]
                );

                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Password is correct - reset failed attempts
            await req.db.query(
                `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE user_id = $1`,
                [user.user_id]
            );

            // Check if MFA is enabled
            if (user.is_mfa_enabled) {
                // Generate temporary token for MFA verification
                const tempToken = jwtManager.generateAccessToken({ ...user, type: 'mfa_temp' });

                return res.json({
                    mfaRequired: true,
                    tempToken
                });
            }

            // Generate tokens
            const tokens = jwtManager.generateTokenPair(user);

            // Save session
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
            await req.db.query(
                `INSERT INTO auth_sessions (user_id, refresh_token, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
                [user.user_id, tokens.refreshToken, expiresAt, ip, req.get('user-agent')]
            );

            // Log successful login
            await req.db.query(
                `INSERT INTO audit_log (user_id, action, success, ip_address) VALUES ($1, 'login', TRUE, $2)`,
                [user.user_id, ip]
            );

            res.json({
                ...tokens,
                user: {
                    userId: user.user_id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    department: user.department,
                    org_id: user.org_id
                }
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Login failed' });
        }
    }
);

/**
 * 3. POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh',
    [body('refreshToken').isString().notEmpty()],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { refreshToken } = req.body;

            // Verify refresh token
            const payload = jwtManager.verifyRefreshToken(refreshToken);

            // Check session in database
            const sessionResult = await req.db.query(
                `SELECT s.*, u.user_id, u.username, u.email, u.role, u.department_id, u.organization_id
         FROM auth_sessions s
         JOIN users u ON s.user_id = u.user_id
         WHERE s.refresh_token = $1 AND s.is_active = TRUE AND s.expires_at > NOW()`,
                [refreshToken]
            );

            if (sessionResult.rows.length === 0) {
                return res.status(401).json({ error: 'Invalid or expired refresh token' });
            }

            const session = sessionResult.rows[0];

            // Generate new access token
            const accessToken = jwtManager.generateAccessToken(session);

            // Update session last_used
            await req.db.query(
                `UPDATE auth_sessions SET last_used = NOW() WHERE session_id = $1`,
                [session.session_id]
            );

            res.json({
                accessToken,
                expiresIn: 15 * 60,
                tokenType: 'Bearer'
            });
        } catch (error) {
            console.error('Refresh token error:', error);
            res.status(401).json({ error: 'Token refresh failed' });
        }
    }
);

/**
 * 4. POST /auth/logout
 * Logout and invalidate tokens
 */
router.post('/logout',
    authenticateJWT,
    async (req, res) => {
        try {
            const userId = req.user.userId;

            // Invalidate all sessions
            await req.db.query(
                `UPDATE auth_sessions SET is_active = FALSE WHERE user_id = $1`,
                [userId]
            );

            // Log logout
            await req.db.query(
                `INSERT INTO audit_log (user_id, action, success) VALUES ($1, 'logout', TRUE)`,
                [userId]
            );

            res.json({ message: 'Logged out successfully' });
        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({ error: 'Logout failed' });
        }
    }
);

/**
 * 5. POST /auth/forgot-password
 * Request password reset OTP
 */
router.post('/forgot-password',
    [body('email').isEmail().normalizeEmail()],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { email } = req.body;

            // Get user
            const userResult = await req.db.query(
                'SELECT user_id, username, email FROM users WHERE email = $1',
                [email]
            );

            // Always return success (don't leak user existence)
            if (userResult.rows.length === 0) {
                return res.json({ message: 'If the email exists, an OTP has been sent' });
            }

            const user = userResult.rows[0];

            // Generate OTP
            const { code: otp, expiresAt } = passwordManager.generateOTPWithExpiry();

            // Save OTP to database
            await req.db.query(
                `INSERT INTO password_reset_tokens (user_id, otp_code, expires_at, ip_address)
         VALUES ($1, $2, $3, $4)`,
                [user.user_id, otp, expiresAt, req.ip]
            );

            // Send email
            await passwordManager.sendOTPEmail(email, otp, user.username);

            // Log audit
            await req.db.query(
                `INSERT INTO audit_log (user_id, action, success) VALUES ($1, 'forgot_password', TRUE)`,
                [user.user_id]
            );

            res.json({ message: 'If the email exists, an OTP has been sent' });
        } catch (error) {
            console.error('Forgot password error:', error);
            res.status(500).json({ error: 'Request failed' });
        }
    }
);

/**
 * 6. POST /auth/reset-password
 * Reset password with OTP
 */
router.post('/reset-password',
    [
        body('email').isEmail().normalizeEmail(),
        body('otp').isString().isLength({ min: 6, max: 6 }),
        body('newPassword').isString().notEmpty()
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { email, otp, newPassword } = req.body;

            // Validate password strength
            const passwordErrors = passwordManager.validatePasswordStrength(newPassword);
            if (passwordErrors.length > 0) {
                return res.status(400).json({ errors: passwordErrors });
            }

            // Get user
            const userResult = await req.db.query(
                'SELECT user_id, username, email, password_hash FROM users WHERE email = $1',
                [email]
            );

            if (userResult.rows.length === 0) {
                return res.status(400).json({ error: 'Invalid OTP or email' });
            }

            const user = userResult.rows[0];

            // Get OTP token
            const tokenResult = await req.db.query(
                `SELECT * FROM password_reset_tokens 
         WHERE user_id = $1 AND otp_code = $2 AND used = FALSE AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
                [user.user_id, otp]
            );

            if (tokenResult.rows.length === 0) {
                return res.status(400).json({ error: 'Invalid or expired OTP' });
            }

            // Hash new password
            const newPasswordHash = await passwordManager.hashPassword(newPassword);

            // Check password history
            const isNewPassword = await passwordManager.checkPasswordHistory(user.user_id, newPassword, req.db);
            if (!isNewPassword) {
                return res.status(400).json({ error: 'Cannot reuse recent passwords' });
            }

            // Update password
            await req.db.query(
                `UPDATE users SET password_hash = $1, last_password_change = NOW() WHERE user_id = $2`,
                [newPasswordHash, user.user_id]
            );

            // Save to password history
            await passwordManager.savePasswordHistory(user.user_id, newPasswordHash, req.db);

            // Mark OTP as used
            await req.db.query(
                `UPDATE password_reset_tokens SET used = TRUE, used_at = NOW() WHERE token_id = $1`,
                [tokenResult.rows[0].token_id]
            );

            // Log audit
            await req.db.query(
                `INSERT INTO audit_log (user_id, action, success) VALUES ($1, 'password_reset', TRUE)`,
                [user.user_id]
            );

            res.json({ message: 'Password reset successfully' });
        } catch (error) {
            console.error('Reset password error:', error);
            res.status(500).json({ error: 'Password reset failed' });
        }
    }
);

/**
 * 7. POST /auth/change-password
 * Change password (authenticated user)
 */
router.post('/change-password',
    authenticateJWT,
    [
        body('currentPassword').isString().notEmpty(),
        body('newPassword').isString().notEmpty()
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { currentPassword, newPassword } = req.body;
            const userId = req.user.userId;

            // Validate new password strength
            const passwordErrors = passwordManager.validatePasswordStrength(newPassword);
            if (passwordErrors.length > 0) {
                return res.status(400).json({ errors: passwordErrors });
            }

            // Get current password hash
            const userResult = await req.db.query(
                'SELECT password_hash FROM users WHERE user_id = $1',
                [userId]
            );

            if (userResult.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            const user = userResult.rows[0];

            // Verify current password
            const isValid = await passwordManager.verifyPassword(currentPassword, user.password_hash);
            if (!isValid) {
                return res.status(400).json({ error: 'Current password is incorrect' });
            }

            // Check password history
            const isNewPassword = await passwordManager.checkPasswordHistory(userId, newPassword, req.db);
            if (!isNewPassword) {
                return res.status(400).json({ error: 'Cannot reuse recent passwords' });
            }

            // Hash new password
            const newPasswordHash = await passwordManager.hashPassword(newPassword);

            // Update password
            await req.db.query(
                `UPDATE users SET password_hash = $1, last_password_change = NOW() WHERE user_id = $2`,
                [newPasswordHash, userId]
            );

            // Save to history
            await passwordManager.savePasswordHistory(userId, newPasswordHash, req.db);

            // Log audit
            await req.db.query(
                `INSERT INTO audit_log (user_id, action, success) VALUES ($1, 'password_change', TRUE)`,
                [userId]
            );

            res.json({ message: 'Password changed successfully' });
        } catch (error) {
            console.error('Change password error:', error);
            res.status(500).json({ error: 'Password change failed' });
        }
    }
);

/**
 * 8. POST /auth/mfa/setup
 * Enable MFA and get QR code
 */
router.post('/mfa/setup',
    authenticateJWT,
    async (req, res) => {
        try {
            const userId = req.user.userId;
            const email = req.user.email;

            // Generate MFA secret and QR code
            const mfaData = await mfaManager.generateMfaSecret(userId, email);
            const recoveryCodes = await mfaManager.generateRecoveryCodes();

            // Save to database (not enabled yet - requires verification)
            await mfaManager.enableMFA(userId, mfaData.secret, recoveryCodes, req.db);

            res.json({
                secret: mfaData.secret,
                qrCode: mfaData.qrCodeDataURL,
                recoveryCodes,
                message: 'Scan QR code with authenticator app and verify to complete setup'
            });
        } catch (error) {
            console.error('MFA setup error:', error);
            res.status(500).json({ error: 'MFA setup failed' });
        }
    }
);

/**
 * 9. POST /auth/mfa/verify
 * Verify MFA code (during login or setup)
 */
router.post('/mfa/verify',
    [
        body('tempToken').optional().isString(),
        body('code').isString().isLength({ min: 6, max: 6 })
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { tempToken, code } = req.body;

            // Verify temp token
            const payload = jwtManager.verifyAccessToken(tempToken);
            const userId = payload.userId;

            // Get MFA secret
            const mfaData = await mfaManager.getMfaSecret(userId, req.db);
            if (!mfaData) {
                return res.status(400).json({ error: 'MFA not set up for this user' });
            }

            // Verify TOTP code
            const isValid = mfaManager.verifyMfaToken(mfaData.secret, code);
            if (!isValid) {
                return res.status(400).json({ error: 'Invalid MFA code' });
            }

            // Update last used
            await mfaManager.updateMfaLastUsed(userId, req.db);

            // Get full user
            const userResult = await req.db.query(
                `SELECT user_id, username, email, role, department_id, organization_id 
         FROM users WHERE user_id = $1`,
                [userId]
            );

            const user = userResult.rows[0];

            // Generate tokens
            const tokens = jwtManager.generateTokenPair(user);

            // Save session
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            await req.db.query(
                `INSERT INTO auth_sessions (user_id, refresh_token, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
                [user.user_id, tokens.refreshToken, expiresAt, req.ip, req.get('user-agent')]
            );

            // Log successful MFA login
            await req.db.query(
                `INSERT INTO audit_log (user_id, action, success, ip_address) VALUES ($1, 'mfa_login', TRUE, $2)`,
                [user.user_id, req.ip]
            );

            res.json({
                ...tokens,
                user: {
                    userId: user.user_id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    department: user.department_id,
                    organizationId: user.organization_id
                }
            });
        } catch (error) {
            console.error('MFA verify error:', error);
            res.status(500).json({ error: 'MFA verification failed' });
        }
    }
);

/**
 * 10. GET /auth/me
 * Get current user profile
 */
router.get('/me',
    authenticateJWT,
    async (req, res) => {
        try {
            const userId = req.user.userId;

            // Get full user profile
            const userResult = await req.db.query(
                `SELECT user_id, username, email, role, department_id, organization_id, entity_id,
                is_mfa_enabled, created_at, last_login
         FROM users 
         WHERE user_id = $1`,
                [userId]
            );

            if (userResult.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            const user = userResult.rows[0];

            res.json({
                userId: user.user_id,
                username: user.username,
                email: user.email,
                role: user.role,
                department: user.department_id,
                organizationId: user.organization_id,
                entityId: user.entity_id,
                isMfaEnabled: user.is_mfa_enabled,
                createdAt: user.created_at,
                lastLogin: user.last_login
            });
        } catch (error) {
            console.error('Get profile error:', error);
            res.status(500).json({ error: 'Failed to get profile' });
        }
    }
);

module.exports = router;
