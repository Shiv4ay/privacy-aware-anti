import React, { useState, useEffect, useCallback } from 'react';
import client from '../api/index';
import { useAuth } from '../contexts/AuthContext';
import {
    Shield, AlertTriangle, Lock, Eye, Download, RefreshCw,
    ChevronLeft, ChevronRight, Filter, Activity, BarChart3
} from 'lucide-react';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';

const STATUS_DOT = {
    allowed:  'bg-emerald-400',
    blocked:  'bg-red-400',
    privacy:  'bg-amber-400',
};

function KpiCard({ icon: Icon, label, value, color, sub }) {
    return (
        <div className="glass-panel p-5 rounded-2xl flex items-center gap-4">
            <div className={`p-3 rounded-xl ${color}`}>
                <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">{label}</p>
                <p className="text-2xl font-bold text-white leading-none mt-0.5">{value ?? '—'}</p>
                {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

export default function AuditDashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [logs, setLogs] = useState([]);
    const [timeline, setTimeline] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalLogs, setTotalLogs] = useState(0);
    const [filters, setFilters] = useState({ status: '', pii_only: false });
    const [exporting, setExporting] = useState(false);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = { page, limit: 15 };
            if (filters.status) params.status = filters.status;
            if (filters.pii_only) params.pii_only = true;

            const [statsRes, logsRes, timelineRes] = await Promise.all([
                client.get('/audit/stats'),
                client.get('/audit/logs', { params }),
                client.get('/audit/timeline'),
            ]);
            setStats(statsRes.data.stats);
            setLogs(logsRes.data.logs || []);
            setTotalPages(logsRes.data.pagination?.pages || 1);
            setTotalLogs(logsRes.data.pagination?.total || 0);
            setTimeline(timelineRes.data.timeline || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load audit data');
        } finally {
            setLoading(false);
        }
    }, [page, filters]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handleExport = async () => {
        setExporting(true);
        try {
            const res = await client.get('/audit/export', { responseType: 'blob' });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            setError('Export failed. Please try again.');
        } finally {
            setExporting(false);
        }
    };

    const privacyScore = stats?.privacyScore;
    const scoreColor = privacyScore >= 90 ? 'text-emerald-400'
        : privacyScore >= 70 ? 'text-amber-400' : 'text-red-400';

    return (
        <div className="space-y-8">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                            <Shield className="w-8 h-8 text-purple-400" />
                            Audit Dashboard
                        </h1>
                        <p className="text-gray-400 mt-1">Security events, privacy violations, and system activity</p>
                    </div>
                    <div className="flex gap-3 flex-shrink-0">
                        <button
                            onClick={fetchAll}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={exporting || loading}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" />
                            {exporting ? 'Exporting…' : 'Export CSV'}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                        {error}
                    </div>
                )}

                {/* KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <KpiCard
                        icon={Activity} label="Total Queries"
                        value={stats?.totalQueries?.toLocaleString()}
                        color="bg-blue-600/80" />
                    <KpiCard
                        icon={Lock} label="Blocked"
                        value={stats?.blockedQueries?.toLocaleString()}
                        color="bg-red-600/80" />
                    <KpiCard
                        icon={AlertTriangle} label="Jailbreak Attempts"
                        value={stats?.jailbreakAttempts?.toLocaleString()}
                        color="bg-orange-600/80" />
                    <KpiCard
                        icon={Eye} label="Privacy Violations"
                        value={stats?.privacyViolations?.toLocaleString()}
                        color="bg-amber-600/80" />
                    <KpiCard
                        icon={Shield} label="Privacy Score"
                        value={privacyScore != null ? `${privacyScore}%` : null}
                        color="bg-emerald-600/80"
                        sub={privacyScore != null
                            ? (privacyScore >= 90 ? 'Excellent' : privacyScore >= 70 ? 'Good' : 'Needs attention')
                            : null}
                    />
                </div>

                {/* Timeline Chart */}
                <div className="glass-panel p-6 rounded-2xl">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                            <BarChart3 className="w-5 h-5 text-purple-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-white">7-Day Activity</h2>
                    </div>
                    {timeline.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={timeline}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                <XAxis dataKey="day" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(17,24,39,0.95)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: 12,
                                        color: '#E5E7EB',
                                        fontSize: 13
                                    }}
                                />
                                <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
                                <Line type="monotone" dataKey="queries" stroke="#8B5CF6" strokeWidth={2} dot={false} name="Queries" />
                                <Line type="monotone" dataKey="blocked" stroke="#EF4444" strokeWidth={2} dot={false} name="Blocked" />
                                <Line type="monotone" dataKey="jailbreaks" stroke="#F59E0B" strokeWidth={2} dot={false} name="Jailbreaks" />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
                            {loading ? 'Loading chart…' : 'No timeline data available'}
                        </div>
                    )}
                </div>

                {/* Log Explorer */}
                <div className="glass-panel p-6 rounded-2xl">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/10 rounded-lg">
                                <Filter className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">Log Explorer</h2>
                                {totalLogs > 0 && (
                                    <p className="text-xs text-gray-500">{totalLogs.toLocaleString()} total entries</p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <select
                                value={filters.status}
                                onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1); }}
                                className="text-sm rounded-xl bg-white/5 border border-white/10 text-gray-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                            >
                                <option value="">All Status</option>
                                <option value="allowed">Allowed</option>
                                <option value="blocked">Blocked</option>
                                <option value="privacy">Privacy</option>
                            </select>
                            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={filters.pii_only}
                                    onChange={e => { setFilters(f => ({ ...f, pii_only: e.target.checked })); setPage(1); }}
                                    className="rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/50"
                                />
                                PII Detected Only
                            </label>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="text-left py-3 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Time</th>
                                    <th className="text-left py-3 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">User</th>
                                    <th className="text-left py-3 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Action</th>
                                    <th className="text-left py-3 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Resource</th>
                                    <th className="text-left py-3 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-12 text-gray-500">
                                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                                            Loading logs…
                                        </td>
                                    </tr>
                                ) : logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-12 text-gray-500">
                                            No logs found for the selected filters
                                        </td>
                                    </tr>
                                ) : logs.map(log => (
                                    <tr key={log.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                        <td className="py-3 px-3 text-gray-400 whitespace-nowrap text-xs">
                                            {new Date(log.created_at).toLocaleString('en-IN', {
                                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </td>
                                        <td className="py-3 px-3">
                                            <span className="text-gray-200">
                                                {log.username || log.email || (log.user_id ? log.user_id.slice(0, 8) + '…' : '—')}
                                            </span>
                                            {log.role && (
                                                <span className="ml-1.5 text-xs text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                                                    {log.role}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-gray-300 font-mono text-xs">
                                            {log.action}
                                        </td>
                                        <td className="py-3 px-3 text-gray-400 text-xs">
                                            {log.resource_type || '—'}
                                        </td>
                                        <td className="py-3 px-3">
                                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${log.success ? 'text-emerald-400' : 'text-red-400'}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${log.success ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                                {log.success ? 'success' : 'failed'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/5">
                            <span className="text-xs text-gray-500">
                                Page {page} of {totalPages}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors border border-white/10"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors border border-white/10"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
