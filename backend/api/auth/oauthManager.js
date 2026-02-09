/**
 * Google OAuth 2.0 Manager
 * Handles Google authentication flow
 */

const axios = require('axios');
const crypto = require('crypto');

class GoogleOAuthManager {
    constructor() {
        this.clientId = process.env.GOOGLE_CLIENT_ID;
        this.clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        this.redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/google/callback`;

        // OAuth endpoints
        this.authEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
        this.tokenEndpoint = 'https://oauth2.googleapis.com/token';
        this.userInfoEndpoint = 'https://www.googleapis.com/oauth2/v2/userinfo';
    }

    /**
     * Generate Google OAuth authorization URL
     */
    getAuthURL(state = null) {
        if (!this.clientId) {
            throw new Error('GOOGLE_CLIENT_ID not configured');
        }

        // Generate secure state token
        const stateToken = state || crypto.randomBytes(32).toString('hex');

        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            response_type: 'code',
            scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
            access_type: 'offline',
            prompt: 'consent',
            state: stateToken
        });

        return {
            url: `${this.authEndpoint}?${params.toString()}`,
            state: stateToken
        };
    }

    /**
     * Exchange authorization code for access token
     */
    async exchangeCodeForTokens(code) {
        try {
            const response = await axios.post(this.tokenEndpoint, {
                code,
                client_id: this.clientId,
                client_secret: this.clientSecret,
                redirect_uri: this.redirectUri,
                grant_type: 'authorization_code'
            }, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            return response.data;
        } catch (error) {
            console.error('Token exchange error:', error.response?.data || error.message);
            throw new Error('Failed to exchange authorization code');
        }
    }

    /**
     * Get user info from Google using access token
     */
    async getUserInfo(accessToken) {
        try {
            const response = await axios.get(this.userInfoEndpoint, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            return {
                googleId: response.data.id,
                email: response.data.email,
                name: response.data.name,
                givenName: response.data.given_name,
                familyName: response.data.family_name,
                picture: response.data.picture,
                verified: response.data.verified_email
            };
        } catch (error) {
            console.error('Get user info error:', error.response?.data || error.message);
            throw new Error('Failed to fetch user information');
        }
    }

    /**
     * Find or create user from OAuth data
     */
    async findOrCreateUser(db, userInfo, orgId = null) {
        const client = await db.connect();
        try {
            await client.query('BEGIN');

            // Check if user exists by OAuth ID
            let userResult = await client.query(
                'SELECT * FROM users WHERE oauth_provider = $1 AND oauth_id = $2',
                ['google', userInfo.googleId]
            );

            if (userResult.rows.length > 0) {
                // Update avatar if changed and always update last_login
                const updateResult = await client.query(
                    'UPDATE users SET last_login = NOW(), oauth_avatar_url = $1 WHERE id = $2 RETURNING *',
                    [userInfo.picture, userResult.rows[0].id]
                );
                await client.query('COMMIT');
                return updateResult.rows[0];
            }

            // Check if user exists by email
            userResult = await client.query(
                'SELECT * FROM users WHERE email = $1',
                [userInfo.email]
            );

            if (userResult.rows.length > 0) {
                // Link OAuth to existing account
                const updateResult = await client.query(
                    `UPDATE users 
                     SET oauth_provider = $1, oauth_id = $2, oauth_avatar_url = $3, last_login = NOW()
                     WHERE id = $4 RETURNING *`,
                    ['google', userInfo.googleId, userInfo.picture, userResult.rows[0].id]
                );
                await client.query('COMMIT');
                return updateResult.rows[0];
            }

            // Determine role and organization based on email
            let assignedRole = 'user';
            let assignedOrgId = orgId;

            // Super Admin: hostingweb2102@gmail.com
            if (userInfo.email === 'hostingweb2102@gmail.com') {
                assignedRole = 'super_admin';
                assignedOrgId = null; // Super admins don't belong to a specific org
            }
            // Admin: sibasundar2102@gmail.com
            else if (userInfo.email === 'sibasundar2102@gmail.com') {
                assignedRole = 'admin';
                // Get PES organization ID
                const orgResult = await client.query(
                    "SELECT id FROM organizations WHERE name = 'PES' AND type = 'University' LIMIT 1"
                );
                if (orgResult.rows.length > 0) {
                    assignedOrgId = orgResult.rows[0].id;
                }
            }

            // Create new user with assigned role
            const username = userInfo.email.split('@')[0] + '_' + crypto.randomBytes(4).toString('hex');
            const insertResult = await client.query(
                `INSERT INTO users (username, email, role, org_id, oauth_provider, oauth_id, oauth_avatar_url, is_active, password_hash, last_login)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, NOW())
                 RETURNING *`,
                [
                    username,
                    userInfo.email,
                    assignedRole,
                    assignedOrgId,
                    'google',
                    userInfo.googleId,
                    userInfo.picture,
                    '' // Empty password for OAuth users
                ]
            );

            await client.query('COMMIT');
            return insertResult.rows[0];

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Verify configuration
     */
    isConfigured() {
        return !!(this.clientId && this.clientSecret);
    }
}

module.exports = new GoogleOAuthManager();
