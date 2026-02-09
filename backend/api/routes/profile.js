const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// Configure MinIO/S3 client for avatar uploads
const s3Client = new S3Client({
    endpoint: process.env.MINIO_ENDPOINT || 'http://minio:9000',
    region: 'us-east-1',
    credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin123'
    },
    forcePathStyle: true
});

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
        }
    }
});

/**
 * GET /api/profile
 * Get current user's full profile
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await req.db.query(
            `SELECT u.id, u.user_id, u.username, u.email, u.role, u.org_id, u.department,
                    u.bio, u.oauth_avatar_url, u.custom_avatar_url, u.preferences,
                    u.created_at, u.last_login, u.oauth_provider,
                    o.name as organization_name, o.type as organization_type
             FROM users u
             LEFT JOIN organizations o ON u.org_id = o.id
             WHERE u.id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        // Determine avatar URL priority: custom > oauth > null
        const avatarUrl = user.custom_avatar_url || user.oauth_avatar_url || null;

        res.json({
            profile: {
                userId: user.user_id || user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                bio: user.bio,
                avatarUrl,
                organization: user.org_id ? {
                    id: user.org_id,
                    name: user.organization_name,
                    type: user.organization_type
                } : null,
                department: user.department,
                accountType: user.oauth_provider || 'email',
                createdAt: user.created_at,
                lastLogin: user.last_login,
                preferences: user.preferences || {}
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

/**
 * PUT /api/profile
 * Update user profile (bio, preferences)
 */
router.put('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const { bio, preferences } = req.body;

        const updates = [];
        const values = [];
        let paramCount = 1;

        if (bio !== undefined) {
            updates.push(`bio = $${paramCount++}`);
            values.push(bio);
        }

        if (preferences !== undefined) {
            updates.push(`preferences = $${paramCount++}`);
            values.push(JSON.stringify(preferences));
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(userId);

        await req.db.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount}`,
            values
        );

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

/**
 * POST /api/profile/avatar
 * Upload custom avatar image
 */
router.post('/avatar', upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const userId = req.user.id;
        const fileExt = path.extname(req.file.originalname);
        const fileName = `avatars/${userId}_${crypto.randomBytes(8).toString('hex')}${fileExt}`;

        // Upload to MinIO
        await s3Client.send(new PutObjectCommand({
            Bucket: process.env.MINIO_BUCKET || 'privacy-documents',
            Key: fileName,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
            ACL: 'public-read'
        }));

        const avatarUrl = `${process.env.MINIO_ENDPOINT}/${process.env.MINIO_BUCKET}/${fileName}`;

        // Update user's custom_avatar_url
        await req.db.query(
            'UPDATE users SET custom_avatar_url = $1 WHERE id = $2',
            [avatarUrl, userId]
        );

        res.json({
            message: 'Avatar uploaded successfully',
            avatarUrl
        });
    } catch (error) {
        console.error('Avatar upload error:', error);
        res.status(500).json({ error: 'Failed to upload avatar' });
    }
});

/**
 * DELETE /api/profile/avatar
 * Remove custom avatar
 */
router.delete('/avatar', async (req, res) => {
    try {
        const userId = req.user.id;

        // Get current avatar URL
        const result = await req.db.query(
            'SELECT custom_avatar_url FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const customAvatarUrl = result.rows[0].custom_avatar_url;

        // Delete from MinIO if exists
        if (customAvatarUrl) {
            try {
                const fileName = customAvatarUrl.split('/').pop();
                await s3Client.send(new DeleteObjectCommand({
                    Bucket: process.env.MINIO_BUCKET || 'privacy-documents',
                    Key: `avatars/${fileName}`
                }));
            } catch (s3Error) {
                console.error('MinIO delete error (non-fatal):', s3Error);
            }
        }

        // Remove custom_avatar_url from database
        await req.db.query(
            'UPDATE users SET custom_avatar_url = NULL WHERE id = $1',
            [userId]
        );

        res.json({ message: 'Avatar removed successfully' });
    } catch (error) {
        console.error('Delete avatar error:', error);
        res.status(500).json({ error: 'Failed to delete avatar' });
    }
});

/**
 * GET /api/profile/stats
 * Get user activity statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;

        let stats = {};

        // Super admin sees system-wide stats
        if (role === 'super_admin') {
            const userCount = await req.db.query('SELECT COUNT(*) FROM users');
            const orgCount = await req.db.query('SELECT COUNT(*) FROM organizations');
            const docCount = await req.db.query('SELECT COUNT(*) FROM documents');

            stats = {
                totalUsers: parseInt(userCount.rows[0].count),
                totalOrganizations: parseInt(orgCount.rows[0].count),
                totalDocuments: parseInt(docCount.rows[0].count)
            };
        }
        // Admin sees organization stats
        else if (role === 'admin' && req.user.org_id) {
            const orgUsers = await req.db.query(
                'SELECT COUNT(*) FROM users WHERE org_id = $1',
                [req.user.org_id]
            );
            const orgDocs = await req.db.query(
                'SELECT COUNT(*) FROM documents WHERE org_id = $1',
                [req.user.org_id]
            );

            stats = {
                organizationUsers: parseInt(orgUsers.rows[0].count),
                organizationDocuments: parseInt(orgDocs.rows[0].count)
            };
        }
        // Regular users see personal stats
        else {
            const userDocs = await req.db.query(
                'SELECT COUNT(*) FROM documents WHERE uploaded_by = $1',
                [userId]
            );

            stats = {
                documentsUploaded: parseInt(userDocs.rows[0].count)
            };
        }

        res.json({ stats });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

module.exports = router;
