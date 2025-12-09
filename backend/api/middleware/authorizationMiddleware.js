/**
 * Authorization Middleware (ABAC)
 * Enforces attribute-based access control policies on routes
 * 
 * Usage:
 *   app.get('/students/:id', authenticateJWT, authorize({ resource: 'student_record', action: 'read' }), handler)
 */

const { getABACEngine } = require('../authorization/abacEngine');

/**
 * Create authorization middleware with ABAC
 */
function authorize(options = {}) {
    const { resource: resourceType, action, fetchResource } = options;

    return async (req, res, next) => {
        try {
            // Ensure user is authenticated
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            // Build subject from authenticated user
            const subject = {
                userId: req.user.userId,
                role: req.user.role,
                department: req.user.department,
                organizationId: req.user.organizationId,
                entityId: req.user.entityId,
                email: req.user.email
            };

            // Build resource object
            let resource = {
                type: resourceType,
                id: req.params.id || null
            };

            // Fetch full resource if needed (e.g., check ownership)
            if (fetchResource && typeof fetchResource === 'function') {
                const fetchedResource = await fetchResource(req);
                if (fetchedResource) {
                    resource = { ...resource, ...fetchedResource };
                }
            } else if (resource.id && req.db) {
                // Auto-fetch resource from database if ID is provided
                resource = await autoFetchResource(req.db, resourceType, resource.id) || resource;
            }

            // Build context
            const context = {
                time: new Date(),
                ip: req.ip,
                method: req.method,
                path: req.path
            };

            // Evaluate ABAC policy
            const abacEngine = getABACEngine();
            const decision = await abacEngine.evaluate(subject, resource, action, context);

            if (!decision.allowed) {
                // Log denial for audit
                if (req.db) {
                    await logAccessDenial(req.db, subject, resource, action, decision.reason);
                }

                return res.status(403).json({
                    error: 'Access denied',
                    reason: decision.reason,
                    policies: decision.denyPolicies
                });
            }

            // Access granted - attach resource to request
            req.resource = resource;
            req.abacDecision = decision;

            next();
        } catch (error) {
            console.error('Authorization error:', error);
            return res.status(500).json({ error: 'Authorization check failed' });
        }
    };
}

/**
 * Auto-fetch resource from database based on type and ID
 */
async function autoFetchResource(db, resourceType, resourceId) {
    try {
        let query, tableName, idColumn;

        switch (resourceType) {
            case 'student_record':
                tableName = 'students';
                idColumn = 'student_id';
                break;
            case 'results':
                tableName = 'results';
                idColumn = 'result_id';
                break;
            case 'attendance':
                tableName = 'attendance';
                idColumn = 'attendance_id';
                break;
            case 'placements':
                tableName = 'placements';
                idColumn = 'placement_id';
                break;
            default:
                return null;
        }

        const result = await db.query(
            `SELECT * FROM ${tableName} WHERE ${idColumn} = $1 LIMIT 1`,
            [resourceId]
        );

        if (result.rows.length > 0) {
            return {
                ...result.rows[0],
                type: resourceType,
                id: resourceId
            };
        }

        return null;
    } catch (error) {
        console.error('Auto-fetch resource error:', error);
        return null;
    }
}

/**
 * Log access denial to audit log
 */
async function logAccessDenial(db, subject, resource, action, reason) {
    try {
        await db.query(
            `INSERT INTO audit_log (user_id, action, resource_type, resource_id, success, error_message)
       VALUES ($1, $2, $3, $4, FALSE, $5)`,
            [subject.userId, action, resource.type, resource.id, reason]
        );
    } catch (error) {
        console.error('Log access denial error:', error);
    }
}

/**
 * Shorthand: Authorize read access
 */
function authorizeRead(resourceType, fetchResource) {
    return authorize({ resource: resourceType, action: 'read', fetchResource });
}

/**
 * Shorthand: Authorize write access (create/update)
 */
function authorizeWrite(resourceType, fetchResource) {
    return authorize({ resource: resourceType, action: 'update', fetchResource });
}

/**
 * Shorthand: Authorize delete access
 */
function authorizeDelete(resourceType, fetchResource) {
    return authorize({ resource: resourceType, action: 'delete', fetchResource });
}

/**
 * Check ownership (for simple ownership checks without full ABAC)
 */
function checkOwnership(getOwnerId) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const ownerId = typeof getOwnerId === 'function' ? getOwnerId(req) : req.params.id;

        // Students can only access own records
        if (req.user.role === 'student' && req.user.entityId !== ownerId) {
            return res.status(403).json({ error: 'You can only access your own records' });
        }

        next();
    };
}

module.exports = {
    authorize,
    authorizeRead,
    authorizeWrite,
    authorizeDelete,
    checkOwnership
};
