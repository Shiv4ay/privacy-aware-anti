/**
 * Anomaly Detection & Security Alerts
 * Detects suspicious activity patterns and triggers alerts
 * 
 * Detection Rules:
 * 1. High-volume access (>50 records in 10 min)
 * 2. Off-hours access (midnight-6am)
 * 3. Privilege escalation attempts
 * 4. Geographic anomalies
 * 5. Data exfiltration patterns (>100MB in 24hrs)
 */

class AnomalyDetector {
    constructor(db) {
        this.db = db;
        this.accessCountCache = new Map(); // User access tracking
        this.downloadTracker = new Map(); // Download volume tracking
    }

    /**
     * Main anomaly detection function
     */
    async detectAnomalies(userId, activity) {
        const alerts = [];

        // 1. High-volume access detection
        if (await this.detectHighVolumeAccess(userId)) {
            alerts.push({
                type: 'HIGH_VOLUME_ACCESS',
                severity: 'HIGH',
                message: `User ${userId} accessed >50 records in 10 minutes`,
                userId,
                timestamp: new Date()
            });
        }

        // 2. Off-hours access detection
        if (this.detectOffHoursAccess()) {
            alerts.push({
                type: 'OFF_HOURS_ACCESS',
                severity: 'MEDIUM',
                message: `User ${userId} accessing system at ${new Date().getHours()}:00`,
                userId,
                timestamp: new Date()
            });
        }

        // 3. Privilege escalation detection
        if (this.detectPrivilegeEscalation(activity)) {
            alerts.push({
                type: 'PRIVILEGE_ESCALATION',
                severity: 'CRITICAL',
                message: `User ${userId} attempted unauthorized access to ${activity.resource}`,
                userId,
                resource: activity.resource,
                timestamp: new Date()
            });
        }

        // 4. Geographic anomaly detection
        if (await this.detectGeographicAnomaly(userId, activity.ip)) {
            alerts.push({
                type: 'GEOGRAPHIC_ANOMALY',
                severity: 'HIGH',
                message: `User ${userId} logged in from unusual location: ${activity.ip}`,
                userId,
                ip: activity.ip,
                timestamp: new Date()
            });
        }

        // 5. Data exfiltration detection
        if (await this.detectDataExfiltration(userId, activity.downloadBytes)) {
            alerts.push({
                type: 'DATA_EXFILTRATION',
                severity: 'CRITICAL',
                message: `User ${userId} downloaded excessive data in 24 hours`,
                userId,
                downloadBytes: activity.downloadBytes,
                timestamp: new Date()
            });
        }

        // Process alerts
        if (alerts.length > 0) {
            await this.logSecurityAlerts(userId, alerts);
            await this.notifySecurityTeam(alerts);
        }

        return alerts;
    }

    /**
     * Detect high-volume access (>50 records in 10 minutes)
     */
    async detectHighVolumeAccess(userId) {
        try {
            const result = await this.db.query(
                `SELECT COUNT(*) as access_count 
         FROM audit_log 
         WHERE user_id = $1 
         AND action IN ('read', 'access')
         AND created_at > NOW() - INTERVAL '10 minutes'`,
                [userId]
            );

            const count = parseInt(result.rows[0]?.access_count || 0);
            return count > 50;
        } catch (error) {
            console.error('High volume detection error:', error);
            return false;
        }
    }

    /**
     * Detect off-hours access (midnight - 6am)
     */
    detectOffHoursAccess() {
        const hour = new Date().getHours();
        return hour >= 0 && hour < 6;
    }

    /**
     * Detect privilege escalation (accessing admin resources as non-admin)
     */
    detectPrivilegeEscalation(activity) {
        const restrictedActions = ['access_admin_panel', 'modify_permissions', 'delete_user', 'bulk_export'];
        const allowedRoles = ['super_admin', 'university_admin'];

        if (restrictedActions.includes(activity.action)) {
            return !allowedRoles.includes(activity.userRole);
        }

        return false;
    }

    /**
     * Detect geographic anomaly (login from unusual location)
     */
    async detectGeographicAnomaly(userId, currentIp) {
        try {
            // Get last login IPs
            const result = await this.db.query(
                `SELECT DISTINCT ip_address 
         FROM audit_log 
         WHERE user_id = $1 
         AND action = 'login'
         AND success = TRUE
         AND created_at > NOW() - INTERVAL '30 days'
         LIMIT 10`,
                [userId]
            );

            const knownIps = result.rows.map(r => r.ip_address);

            // If current IP is not in known IPs and user has login history
            if (knownIps.length > 0 && !knownIps.includes(currentIp)) {
                return true;
            }

            return false;
        } catch (error) {
            console.error('Geographic anomaly detection error:', error);
            return false;
        }
    }

    /**
     * Detect data exfiltration (>100MB downloaded in 24 hours)
     */
    async detectDataExfiltration(userId, currentDownloadBytes = 0) {
        try {
            // Track download volume
            const cacheKey = `download:${userId}`;
            const now = Date.now();
            const window24h = 24 * 60 * 60 * 1000;

            if (!this.downloadTracker.has(cacheKey)) {
                this.downloadTracker.set(cacheKey, {
                    bytes: 0,
                    startTime: now
                });
            }

            const tracker = this.downloadTracker.get(cacheKey);

            // Reset if window expired
            if (now - tracker.startTime > window24h) {
                tracker.bytes = 0;
                tracker.startTime = now;
            }

            // Add current download
            tracker.bytes += currentDownloadBytes || 0;

            // Check threshold (100MB)
            const threshold = 100 * 1024 * 1024;
            return tracker.bytes > threshold;
        } catch (error) {
            console.error('Data exfiltration detection error:', error);
            return false;
        }
    }

    /**
     * Log security alerts to audit log
     */
    async logSecurityAlerts(userId, alerts) {
        try {
            for (const alert of alerts) {
                await this.db.query(
                    `INSERT INTO audit_log (user_id, action, success, error_message, metadata)
           VALUES ($1, $2, FALSE, $3, $4)`,
                    [
                        userId,
                        `anomaly_${alert.type.toLowerCase()}`,
                        alert.message,
                        JSON.stringify(alert)
                    ]
                );
            }
        } catch (error) {
            console.error('Log security alerts error:', error);
        }
    }

    /**
     * Notify security team of alerts
     */
    async notifySecurityTeam(alerts) {
        // Filter critical alerts
        const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL');

        if (criticalAlerts.length > 0) {
            console.error('[SECURITY ALERT] Critical security events detected:');
            criticalAlerts.forEach(alert => {
                console.error(JSON.stringify(alert, null, 2));
            });

            // TODO: Integrate with actual notification system (email, Slack, PagerDuty, etc.)
            // await emailSecurityTeam(criticalAlerts);
            // await sendSlackAlert(criticalAlerts);
        }

        // Log all alerts
        console.warn('[SECURITY] Anomaly detection results:');
        alerts.forEach(alert => {
            console.warn(`- [${alert.severity}] ${alert.type}: ${alert.message}`);
        });
    }

    /**
     * Check if action should be blocked based on alerts
     */
    shouldBlockAction(alerts) {
        // Block if any critical alerts
        return alerts.some(a => a.severity === 'CRITICAL');
    }

    /**
     * Clean up old cache entries
     */
    cleanup() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        for (const [key, value] of this.downloadTracker.entries()) {
            if (now - value.startTime > maxAge) {
                this.downloadTracker.delete(key);
            }
        }
    }
}

/**
 * Middleware for anomaly detection
 */
function anomalyDetectionMiddleware(req, res, next) {
    // Skip if no user context
    if (!req.user || !req.db) {
        return next();
    }

    const detector = new AnomalyDetector(req.db);

    // Detect anomalies asynchronously
    detector.detectAnomalies(req.user.userId, {
        action: req.path,
        method: req.method,
        ip: req.ip,
        userRole: req.user.role,
        resource: req.path,
        downloadBytes: parseInt(req.get('content-length') || '0')
    }).then(alerts => {
        if (detector.shouldBlockAction(alerts)) {
            return res.status(403).json({
                error: 'Suspicious activity detected - access temporarily restricted',
                alerts: alerts.map(a => ({ type: a.type, severity: a.severity }))
            });
        }
    }).catch(error => {
        console.error('Anomaly detection error:', error);
    });

    next();
}

module.exports = {
    AnomalyDetector,
    anomalyDetectionMiddleware
};
