const { Server } = require('socket.io');
const Redis = require('ioredis');

class RealtimeService {
    constructor(server, pool) {
        this.io = new Server(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"],
                credentials: true
            }
        });

        this.pool = pool;
        this.redisSub = new Redis(process.env.REDIS_URL || 'redis://redis:6379/0', {
            maxRetriesPerRequest: null
        });

        this.setupSocketHandlers();
        this.setupRedisSubscription();
        this.startStatsInterval();

        console.log('🚀 Real-time logic initialized');
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`[Realtime] New connection: ${socket.id}`);

            socket.on('subscribe:system', () => {
                socket.join('system_admins');
                console.log(`[Realtime] ${socket.id} joined system_admins room`);
                // Send immediate stats on subscribe
                this.broadcastSystemStats();
            });

            socket.on('disconnect', () => {
                console.log(`[Realtime] Connection closed: ${socket.id}`);
            });
        });
    }

    setupRedisSubscription() {
        this.redisSub.subscribe('system_activity', (err, count) => {
            if (err) console.error('[Realtime] Redis subscription error:', err);
            else console.log(`[Realtime] Subscribed to ${count} channels`);
        });

        this.redisSub.on('message', (channel, message) => {
            if (channel === 'system_activity') {
                try {
                    const activity = JSON.parse(message);
                    // Broadcast to all Super Admins
                    this.io.to('system_admins').emit('activity', activity);
                } catch (e) {
                    console.error('[Realtime] Failed to parse Redis message:', e);
                }
            }
        });
    }

    startStatsInterval() {
        // Broadcast stats every 15 seconds
        setInterval(() => this.broadcastSystemStats(), 15000);
    }

    async broadcastSystemStats() {
        if (!this.pool) return;
        try {
            const statsQuery = `
                SELECT 
                    (SELECT COUNT(*) FROM organizations) as org_count,
                    (SELECT COUNT(*) FROM users) as user_count,
                    (SELECT COUNT(*) FROM documents) as doc_count,
                    (SELECT COALESCE(SUM(file_size), 0) FROM documents) as storage_used
            `;
            const result = await this.pool.query(statsQuery);
            const stats = {
                totalOrganizations: parseInt(result.rows[0].org_count),
                totalUsers: parseInt(result.rows[0].user_count),
                totalDocuments: parseInt(result.rows[0].doc_count),
                totalStorage: parseInt(result.rows[0].storage_used),
                timestamp: new Date().toISOString()
            };
            this.io.to('system_admins').emit('stats_update', stats);
        } catch (e) {
            console.error('[Realtime] Stats broadcast error:', e.message);
        }
    }

    // Ability to broadcast stats updates manually
    broadcastStats(stats) {
        this.io.to('system_admins').emit('stats_update', stats);
    }
}

module.exports = RealtimeService;
