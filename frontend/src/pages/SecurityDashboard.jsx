import React, { useState, useEffect } from 'react';
import { Shield, Lock, AlertTriangle, Eye, RefreshCw, Activity, Search, FileText, User } from 'lucide-react';
import client from '../api/index';
import toast from 'react-hot-toast';

export default function SecurityDashboard() {
    const [stats, setStats] = useState(null);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
    const [filter, setFilter] = useState({ status: null, pii: null });

    useEffect(() => {
        fetchData();
        const interval = setInterval(() => fetchStats(), 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        fetchLogs(1);
    }, [filter]);

    const fetchData = async () => {
        setLoading(true);
        try {
            await Promise.all([fetchStats(), fetchLogs(1)]);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await client.get('/audit/stats');
            setStats(res.data.stats);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    const fetchLogs = async (page = 1) => {
        try {
            const params = {
                page,
                limit: pagination.limit,
                ...filter
            };
            const res = await client.get('/audit/logs', { params });
            setLogs(res.data.logs);
            setPagination(prev => ({ ...prev, ...res.data.pagination }));
        } catch (error) {
            console.error('Failed to fetch logs:', error);
            toast.error('Failed to load audit logs');
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
        toast.success('Security data updated');
    };

    const toggleFilter = (newFilter) => {
        setFilter(prev => {
            // If clicking the same filter, clear it (toggle off)
            if (JSON.stringify(prev) === JSON.stringify(newFilter)) {
                return { status: null, pii: null };
            }
            return newFilter;
        });
    };

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

    return (
        <div className="p-8 min-h-screen bg-premium-black text-white animate-fade-in">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Shield className="w-8 h-8 text-premium-gold" />
                        Security Center
                    </h1>
                    <p className="text-gray-400 mt-2">Real-time monitoring of privacy operations and security events</p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/10"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Updating...' : 'Refresh Data'}
                </button>
            </div>

            {/* Stats Grid - Clickable */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <StatCard
                    title="Queries Allowed"
                    value={stats?.totalQueries - stats?.blockedQueries || 0}
                    subtext="processed successfully"
                    icon={Activity}
                    color="blue"
                    onClick={() => toggleFilter({ status: 'allowed', pii: null })}
                    isActive={filter.status === 'allowed'}
                />
                <StatCard
                    title="Queries Blocked"
                    value={stats?.blockedQueries || 0}
                    subtext="jailbreak attempts prevented"
                    icon={AlertTriangle}
                    color="red"
                    onClick={() => toggleFilter({ status: 'blocked', pii: null })}
                    isActive={filter.status === 'blocked'}
                />
                <StatCard
                    title="PII Redacted"
                    value={stats?.piiRedacted || 0}
                    subtext="sensitive data points protected"
                    icon={Eye}
                    color="yellow"
                    onClick={() => toggleFilter({ status: null, pii: 'true' })}
                    isActive={filter.pii === 'true'}
                />
                <StatCard
                    title="Privacy Score"
                    value={`${stats?.privacyScore || 100}%`}
                    subtext="Enterprise Compliance"
                    icon={Shield}
                    color="green"
                    onClick={() => setFilter({ status: null, pii: null })}
                    isActive={false} // Always click to reset
                />
            </div>

            {/* Active Controls */}
            <h2 className="text-xl font-bold mb-4">Active Privacy Controls</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <ControlCard
                    title="PII Redaction Engine"
                    status="Active"
                    description="Automatically hides sensitive personal data like emails and phone numbers."
                    icon={Eye}
                    color="green"
                />
                <ControlCard
                    title="Differential Privacy"
                    status="Active"
                    description="Adds statistical noise to protect individual identities in aggregate data."
                    icon={Shield}
                    color="blue"
                />
                <ControlCard
                    title="Envelope Encryption"
                    status="Active"
                    description="Military-grade encryption protects all files at rest and in transit."
                    icon={Lock}
                    color="yellow"
                />
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
                            {!filter.status && !filter.pii && 'Real-time privacy monitoring'}
                        </span>
                    </div>
                    {(filter.status || filter.pii) && (
                        <button
                            onClick={() => setFilter({ status: null, pii: null })}
                            className="text-xs text-red-400 hover:text-red-300 underline"
                        >
                            Clear Filters
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-white/5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                <th className="px-6 py-4">Timestamp</th>
                                <th className="px-6 py-4">User</th>
                                <th className="px-6 py-4">Action</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                        {new Date(log.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs">
                                                {log.username?.[0] || 'U'}
                                            </div>
                                            <span className="text-sm font-medium text-white">{log.username || 'System'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 py-1 text-xs rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {log.success ? (
                                            <span className="flex items-center gap-1.5 text-green-400 text-sm">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                                Allowed
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-red-400 text-sm">
                                                <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                                Blocked
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">
                                        {formatDetails(log)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-4 border-t border-white/10 flex items-center justify-between text-sm text-gray-400">
                    <div>
                        Showing {(pagination.page - 1) * pagination.limit + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
                    </div>
                    <div className="flex gap-2">
                        <button
                            disabled={pagination.page === 1}
                            onClick={() => fetchLogs(pagination.page - 1)}
                            className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <button
                            disabled={pagination.page >= pagination.pages}
                            onClick={() => fetchLogs(pagination.page + 1)}
                            className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Helpers & Components

function formatDetails(log) {
    if (log.error_message) return log.error_message;
    if (log.metadata?.pii_detected) return `PII Redacted: ${log.metadata.pii_types?.join(', ') || 'Sensitive Data'}`;
    if (log.action === 'search') return 'Search Query Processed';
    return JSON.stringify(log.metadata).substring(0, 50) + (JSON.stringify(log.metadata).length > 50 ? '...' : '');
}

function StatCard({ title, value, subtext, icon: Icon, color, onClick, isActive }) {
    const colors = {
        blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/30 text-blue-400',
        red: 'from-red-500/20 to-red-600/5 border-red-500/30 text-red-400',
        yellow: 'from-yellow-500/20 to-yellow-600/5 border-yellow-500/30 text-yellow-400',
        green: 'from-green-500/20 to-green-600/5 border-green-500/30 text-green-400',
    };

    return (
        <div
            onClick={onClick}
            className={`p-6 rounded-xl bg-gradient-to-br border backdrop-blur-sm cursor-pointer transition-all duration-200 
                ${colors[color].split(' ').slice(0, 3).join(' ')} 
                ${isActive ? 'ring-2 ring-offset-2 ring-offset-black ring-premium-gold scale-[1.02]' : 'hover:scale-[1.02] hover:border-premium-gold/50'}
            `}
        >
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-gray-400 text-sm font-medium mb-1">{title}</h3>
                    <p className={`text-3xl font-bold ${colors[color].split(' ').pop()}`}>{value.toLocaleString()}</p>
                </div>
                <div className={`p-2 rounded-lg bg-white/5 ${colors[color].split(' ').pop()}`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
            <p className="text-xs text-gray-500">{subtext}</p>
        </div>
    );
}

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
