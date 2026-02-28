import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Shield, Lock, AlertTriangle, Eye, RefreshCw, Activity, FileText } from 'lucide-react';
import client from '../api/index';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';

export default function SecurityDashboard() {
    const [stats, setStats] = useState(null);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
    const [filter, setFilter] = useState({ status: null, pii: null });
    const [flashCards, setFlashCards] = useState({});   // cards to flash on update
    const pageRef = useRef(1);
    const filterRef = useRef({ status: null, pii: null });
    const prevStatsRef = useRef(null);

    // ── helpers ────────────────────────────────────────────────────
    const fetchStats = useCallback(async () => {
        try {
            const res = await client.get('/audit/stats');
            const next = res.data.stats;
            setStats(prev => {
                if (prev) {
                    // Detect which cards changed and flash them
                    const changed = {};
                    if (next.totalQueries !== prev.totalQueries) changed.allowed = true;
                    if (next.blockedQueries !== prev.blockedQueries) changed.blocked = true;
                    if (next.piiRedacted !== prev.piiRedacted) changed.pii = true;
                    if (next.privacyScore !== prev.privacyScore) changed.score = true;
                    if (Object.keys(changed).length > 0) {
                        setFlashCards(changed);
                        setTimeout(() => setFlashCards({}), 1200);
                    }
                }
                return next;
            });
        } catch (e) {
            console.error('Stats fetch error:', e);
        }
    }, []);

    const fetchLogs = useCallback(async (page = 1) => {
        try {
            const f = filterRef.current;
            const params = { page, limit: 20 };
            if (f.status) params.status = f.status;
            if (f.pii) params.pii = f.pii;
            const res = await client.get('/audit/logs', { params });
            setLogs(res.data.logs || []);
            setPagination(prev => ({ ...prev, ...res.data.pagination, page }));
            pageRef.current = page;
        } catch (e) {
            console.error('Logs fetch error:', e);
        }
    }, []);

    const fetchAll = useCallback(async () => {
        await Promise.all([fetchStats(), fetchLogs(1)]);
    }, [fetchStats, fetchLogs]);

    // ── mount: polling every 2s + Socket.IO ───────────────────────
    useEffect(() => {
        setLoading(true);
        fetchAll().finally(() => setLoading(false));

        // 2-second polling for snappy real-time feel
        const interval = setInterval(() => {
            fetchStats();
            fetchLogs(pageRef.current);
        }, 2000);

        // Socket.IO for instant push events
        const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const socket = io(socketUrl, {
            withCredentials: true,
            transports: ['websocket', 'polling'],
            reconnectionDelay: 1000,
            reconnectionAttempts: 15
        });

        socket.on('connect', () => {
            console.log('[Security] Socket connected:', socket.id);
            socket.emit('subscribe:system');
        });

        socket.on('activity', (evt) => {
            console.log('[Security] Real-time event:', evt);
            // Refresh both stats and logs immediately on any event
            fetchStats();
            fetchLogs(pageRef.current);
        });

        return () => {
            clearInterval(interval);
            socket.disconnect();
        };
    }, []); // eslint-disable-line

    // Re-fetch when filter changes
    useEffect(() => {
        filterRef.current = filter;
        fetchLogs(1);
    }, [filter]); // eslint-disable-line

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchAll();
        setRefreshing(false);
        toast.success('Security data refreshed');
    };

    const toggleFilter = (nf) =>
        setFilter(prev => JSON.stringify(prev) === JSON.stringify(nf) ? { status: null, pii: null } : nf);

    if (loading && !stats) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-premium-black text-white">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="w-8 h-8 animate-spin text-premium-gold" />
                    <p>Loading Security Center...</p>
                </div>
            </div>
        );
    }

    const allowed = Math.max(0, (stats?.totalQueries ?? 0) - (stats?.blockedQueries ?? 0));
    const blocked = stats?.blockedQueries ?? 0;
    const piiCount = stats?.piiRedacted ?? 0;
    const score = stats?.privacyScore ?? 100;

    return (
        <div className="p-8 min-h-screen bg-premium-black text-white animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Shield className="w-8 h-8 text-premium-gold" />
                        Security Center
                    </h1>
                    <p className="text-gray-400 mt-2">Real-time monitoring of privacy operations and security events</p>
                </div>
                <button onClick={handleRefresh} disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/10">
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Updating...' : 'Refresh Data'}
                </button>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <StatCard title="Queries Allowed" value={allowed} subtext="processed successfully" icon={Activity} color="blue" flash={flashCards.allowed} onClick={() => toggleFilter({ status: 'allowed', pii: null })} isActive={filter.status === 'allowed'} />
                <StatCard title="Queries Blocked" value={blocked} subtext="jailbreak attempts prevented" icon={AlertTriangle} color="red" flash={flashCards.blocked} onClick={() => toggleFilter({ status: 'blocked', pii: null })} isActive={filter.status === 'blocked'} />
                <StatCard title="PII Redacted" value={piiCount} subtext="sensitive data points protected" icon={Eye} color="yellow" flash={flashCards.pii} onClick={() => toggleFilter({ status: null, pii: 'true' })} isActive={filter.pii === 'true'} />
                <StatCard title="Privacy Score" value={`${score}%`} subtext="Enterprise Compliance" icon={Shield} color="green" flash={flashCards.score} onClick={() => setFilter({ status: null, pii: null })} isActive={false} />
            </div>

            {/* Active Controls */}
            <h2 className="text-xl font-bold mb-4">Active Privacy Controls</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <ControlCard title="PII Redaction Engine" status="Active" description="Automatically hides sensitive personal data like emails and phone numbers." icon={Eye} color="green" />
                <ControlCard title="Differential Privacy" status="Active" description="Adds statistical noise to protect individual identities in aggregate data." icon={Shield} color="blue" />
                <ControlCard title="Envelope Encryption" status="Active" description="Military-grade encryption protects all files at rest and in transit." icon={Lock} color="yellow" />
            </div>

            {/* Audit Log Table */}
            <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <FileText className="w-5 h-5 text-premium-gold" />
                            Security Audit Log
                        </h2>
                        <span className="text-xs text-gray-500">
                            {filter.status === 'allowed' && 'Showing Allowed Queries'}
                            {filter.status === 'blocked' && 'Showing Blocked Queries'}
                            {filter.pii === 'true' && 'Showing PII Redaction Events'}
                            {!filter.status && !filter.pii && 'Real-time privacy monitoring · auto-refreshes every 2s'}
                        </span>
                    </div>
                    {(filter.status || filter.pii) && (
                        <button onClick={() => setFilter({ status: null, pii: null })} className="text-xs text-red-400 hover:text-red-300 underline">
                            Clear Filters
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-white/5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                <th className="px-4 py-4">Timestamp</th>
                                <th className="px-4 py-4">User</th>
                                <th className="px-4 py-4">Action</th>
                                <th className="px-4 py-4" style={{ minWidth: '320px' }}>Details &amp; Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        No audit log entries yet. Perform a search or chat to generate entries.
                                    </td>
                                </tr>
                            ) : logs.map((log) => (
                                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-400">
                                        {new Date(log.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-xs font-bold border border-white/10 text-gray-300">
                                                {(log.username || 'S')[0].toUpperCase()}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-white">{log.username || 'System Agent'}</span>
                                                {log.email && <span className="text-[10px] text-premium-gold font-mono opacity-80">{log.email}</span>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-xs rounded-full border font-semibold ${log.action === 'chat' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                            : log.action === 'search' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                            }`}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <AuditDetails log={log} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-4 border-t border-white/10 flex items-center justify-between text-sm text-gray-400">
                    <div>
                        {pagination.total > 0
                            ? `Showing ${(pagination.page - 1) * pagination.limit + 1}–${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total} entries`
                            : '0 entries'}
                    </div>
                    <div className="flex gap-2">
                        <button disabled={pagination.page <= 1} onClick={() => fetchLogs(pagination.page - 1)} className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
                        <button disabled={pagination.page >= pagination.pages} onClick={() => fetchLogs(pagination.page + 1)} className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── AuditDetails ──────────────────────────────────────────────────────────────
function AuditDetails({ log }) {
    const m = log.metadata || {};

    const success = log.success !== false && m.success !== 'false';
    const piiDetected = m.pii_detected === 'true' || m.pii_detected === true;
    const piiTypes = Array.isArray(m.pii_types) ? m.pii_types
        : (typeof m.pii_types === 'string' && m.pii_types ? m.pii_types.split(',').map(s => s.trim()) : []);
    const query = m.query_redacted || '';
    const resultCount = m.results_count != null ? Number(m.results_count) : null;
    const errorMsg = m.error || null;
    const isLogin = log.action === 'login' || log.action === 'oauth_login';

    return (
        <div className="flex flex-col gap-1.5">
            {/* Row 1: Status + query */}
            <div className="flex items-center gap-2 flex-wrap">
                {success ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/15 text-green-400 border border-green-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> ALLOWED
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" /> BLOCKED
                    </span>
                )}

                {query && (
                    <span className="text-gray-200 text-xs font-mono" style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }} title={query}>
                        "{query}"
                    </span>
                )}

                {isLogin && !query && (
                    <span className="text-blue-400 text-xs font-semibold">
                        🔐 Authenticated via {m.provider || 'Google OAuth'}
                    </span>
                )}

                {errorMsg && <span className="text-red-400 text-xs italic">{errorMsg}</span>}
            </div>

            {/* Row 2: PII info + result count */}
            {(piiDetected || resultCount != null) && (
                <div className="flex items-center gap-1.5 flex-wrap">
                    {piiDetected ? (
                        <>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
                                🔒 PII Redacted
                            </span>
                            {piiTypes.filter(Boolean).map(t => (
                                <span key={t} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 uppercase tracking-wide">
                                    {t}
                                </span>
                            ))}
                        </>
                    ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/10 text-green-500 border border-green-500/20">
                            ✓ No PII detected
                        </span>
                    )}
                    {resultCount != null && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                            {resultCount} result{resultCount !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ title, value, subtext, icon: Icon, color, onClick, isActive, flash }) {
    const colorMap = {
        blue: { bg: 'from-blue-500/20 to-blue-600/5', border: 'border-blue-500/30', text: 'text-blue-400' },
        red: { bg: 'from-red-500/20 to-red-600/5', border: 'border-red-500/30', text: 'text-red-400' },
        yellow: { bg: 'from-yellow-500/20 to-yellow-600/5', border: 'border-yellow-500/30', text: 'text-yellow-400' },
        green: { bg: 'from-green-500/20 to-green-600/5', border: 'border-green-500/30', text: 'text-green-400' },
    };
    const c = colorMap[color] || colorMap.blue;
    const display = typeof value === 'number' ? value.toLocaleString() : String(value ?? 0);

    return (
        <div
            onClick={onClick}
            className={`p-6 rounded-xl bg-gradient-to-br border backdrop-blur-sm cursor-pointer transition-all duration-300
                ${c.bg} ${c.border}
                ${flash ? 'ring-2 ring-premium-gold scale-[1.04] shadow-lg shadow-premium-gold/20' : 'hover:scale-[1.02] hover:border-premium-gold/50'}
                ${isActive ? 'ring-2 ring-premium-gold scale-[1.02]' : ''}
            `}
        >
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-gray-400 text-sm font-medium mb-1">{title}</h3>
                    <p className={`text-3xl font-bold transition-all duration-300 ${c.text} ${flash ? 'scale-110' : ''}`}>
                        {display}
                    </p>
                </div>
                <div className={`p-2 rounded-lg bg-white/5 ${c.text}`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
            {flash && (
                <div className="text-[10px] text-premium-gold font-bold animate-pulse mb-1">↑ UPDATED</div>
            )}
            <p className="text-xs text-gray-500">{subtext}</p>
        </div>
    );
}

// ── ControlCard ───────────────────────────────────────────────────────────────
function ControlCard({ title, status, description, icon: Icon, color }) {
    return (
        <div className="p-6 rounded-xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 backdrop-blur-sm hover:border-premium-gold/30 transition-colors">
            <div className="flex items-center gap-4 mb-4">
                <div className={`p-3 rounded-lg bg-${color}-500/20 text-${color}-400`}>
                    <Icon className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white">{title}</h3>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-xs text-green-400 font-medium uppercase tracking-wider">{status}</span>
                    </div>
                </div>
            </div>
            <p className="text-sm text-gray-400">{description}</p>
        </div>
    );
}
