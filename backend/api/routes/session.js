const express = require('express');
const router = express.Router();
const jwtManager = require('../auth/jwtManager');
const { authenticateJWT } = require('../middleware/authMiddleware');

// POST /api/session/set-org
// POST /api/session/set-org
router.post('/set-org', authenticateJWT, async (req, res) => {
    try {
        // PHASE 5: Handle input flexibly (user asked for 'organization', previous code used 'org_id')
        const { organization, org_id } = req.body;
        const targetOrg = organization || org_id;

        console.log('[Session] Switching context to:', targetOrg);

        if (!targetOrg) {
            return res.status(400).json({ error: 'Organization required' });
        }

        const user = req.user;

        // Generate new access token with updated organization
        // We use jwtManager to ensure consistent secret and algorithm usage
        // MAPPING: We construct a user-like object for the generator
        const tokenPayload = {
            user_id: user.userId || user.user_id || user.id,
            email: user.email,
            username: user.username,
            role: user.role,
            department: user.department || user.department_id,
            // CRITICAL: This injects the new organization context into the token
            organization_id: targetOrg
        };

        const accessToken = jwtManager.generateAccessToken(tokenPayload);

        console.log('[Session] New token generated for org:', targetOrg);

        res.json({
            success: true,
            token: accessToken,
            user: {
                ...user,
                organization: targetOrg
            }
        });

    } catch (error) {
        console.error('Session update error:', error);
        res.status(500).json({ error: 'Failed to update session context' });
    }
});

module.exports = router;
