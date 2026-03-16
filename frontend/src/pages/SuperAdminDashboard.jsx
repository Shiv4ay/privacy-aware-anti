import React, { useState, useEffect, useCallback, useRef } from 'react';
import client from '../api/index';
import { useAuth } from '../contexts/AuthContext';
import {
    Building, Plus, Trash2, Globe, Shield, Activity, Users, FileText, Database,
    Zap, Server, Cpu, Clock, CheckCircle2, XCircle, AlertCircle, TrendingUp,
    HardDrive, Search, RefreshCw, ChevronDown, BarChart3, Lock, Unlock,
    UserX, UserCheck, AlertTriangle, Download, Filter, Eye, EyeOff,
    Crown, Settings, LogOut, Ban, ShieldAlert, Network, Layers
} from 'lucide-react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import AmbientBackground from '../components/ui/AmbientBackground';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Reusable mini components ──────────────────────────────────
const Badge = ({ color = 'gray', children }) => {
    const colors = {
        green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        red: 'bg-red-500/10 text-red-400 border-red-500/20',
        amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        gold: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
        gray: 'bg-white/5 text-gray-400 border-white/10',
    };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${colors[color] || colors.gray}`}>
            {children}
        </span>
    );
};

const roleColor = (role) => {
    if (role === 'super_admin') return 'gold';
    if (role === 'admin') return 'purple';
    if (role === 'faculty') return 'blue';
    if (role === 'student') return 'green';
    return 'gray';
};

const GlassCard = ({ children, className = '', glow }) => (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm ${glow ? 'shadow-lg shadow-yellow-500/5' : ''} ${className}`}>
        {children}
    </div>
);

const StatCard = ({ icon: Icon, label, value, sub, color }) => (
    <GlassCard className="p-6 relative overflow-hidden group hover:border-white/20 transition-all">
        <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity bg-gradient-to-br ${color}`} />
        <div className="flex items-start justify-between mb-4">
            <div className={`p-2.5 rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
                <Icon className="w-5 h-5 text-white" />
            </div>
        </div>
        <div className="text-3xl font-black text-white tracking-tight">{value}</div>
        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">{label}</div>
        {sub && <div className="text-[10px] text-gray-600 mt-1">{sub}</div>}
    </GlassCard>
);

const TABS = [
    { id: 'command', label: 'Command Center', icon: Layers },
    { id: 'orgs', label: 'Organizations', icon: Building },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'threats', label: 'Threat Intel', icon: ShieldAlert },
    { id: 'analytics', label: 'System Analytics', icon: BarChart3 },
];

// ═══════════════════════════════════════════════════════════════
export default function SuperAdminDashboard() {
    const { user } = useAuth();
    const [tab, setTab] = useState('command');
    const socketRef = useRef(null);

    // Data states
    const [orgs, setOrgs] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [threats, setThreats] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [orgAnalytics, setOrgAnalytics] = useState([]);
    const [systemStatus, setSystemStatus] = useState(null);
    const [liveActivity, setLiveActivity] = useState([]);

    // UI states
    const [loading, setLoading] = useState(true);
    const [userSearch, setUserSearch] = useState('');
    const [userOrgFilter, setUserOrgFilter] = useState('');
    const [auditAction, setAuditAction] = useState('');
    const [auditPage, setAuditPage] = useState(1);
    const [auditTotal, setAuditTotal] = useState(0);
    const [newOrg, setNewOrg] = useState({ name: '', type: '', domain: '' });
    const [showCreateOrg, setShowCreateOrg] = useState(false);
    const [pendingRoleChange, setPendingRoleChange] = useState(null); // {userId, role}

    // ── Fetch helpers ──────────────────────────────────────────
    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [orgsRes, usersRes, threatsRes, statusRes, analyticsRes] = await Promise.allSettled([
                client.get('/orgs'),
                client.get('/admin/users'),
                client.get('/admin/threats'),
                client.get('/orgs/system-status'),
                client.get('/admin/org-analytics'),
            ]);
            if (orgsRes.status === 'fulfilled' && orgsRes.value.data?.success)
                setOrgs(orgsRes.value.data.organizations || []);
            if (usersRes.status === 'fulfilled' && usersRes.value.data?.success)
                setAllUsers(usersRes.value.data.users || []);
            if (threatsRes.status === 'fulfilled' && threatsRes.value.data?.success)
                setThreats(threatsRes.value.data.threats || []);
            if (statusRes.status === 'fulfilled' && statusRes.value.data?.success)
                setSystemStatus(statusRes.value.data);
            if (analyticsRes.status === 'fulfilled' && analyticsRes.value.data?.success)
                setOrgAnalytics(analyticsRes.value.data.orgs || []);
        } finally { setLoading(false); }
    }, []);

    const fetchAuditLogs = useCallback(async () => {
        try {
            const params = new URLSearchParams({ page: auditPage, limit: 50 });
            if (auditAction) params.append('action', auditAction);
            const res = await client.get(`/admin/audit-logs?${params}`);
            if (res.data?.success) {
                setAuditLogs(res.data.logs || []);
                setAuditTotal(res.data.total || 0);
            }
        } catch { /* silent */ }
    }, [auditPage, auditAction]);

    // ── Socket ──────────────────────────────────────────────────
    useEffect(() => {
        fetchAll();
        const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const socket = io(socketUrl, { withCredentials: true, transports: ['websocket', 'polling'] });
        socketRef.current = socket;

        socket.on('connect', () => socket.emit('subscribe:system'));
        socket.on('activity', (evt) => {
            setLiveActivity(prev => [evt, ...prev].slice(0, 20));
            if (evt.action === 'jailbreak_attempt')
                setThreats(prev => [{
                    id: evt.id, time: evt.created_at, username: evt.username,
                    email: evt.email, details: evt.metadata
                }, ...prev].slice(0, 100));
        });

        const poll = setInterval(fetchAll, 60000);
        return () => { socket.disconnect(); clearInterval(poll); };
    }, [fetchAll]);

    useEffect(() => { if (tab === 'analytics') fetchAuditLogs(); }, [tab, auditPage, auditAction, fetchAuditLogs]);

    // ── Actions ─────────────────────────────────────────────────
    const handleCreateOrg = async (e) => {
        e.preventDefault();
        const t = toast.loading('Creating organization…');
        try {
            const res = await client.post('/orgs/create', newOrg);
            if (res.data.success) {
                toast.success('Organization created', { id: t });
                setNewOrg({ name: '', type: '', domain: '' });
                setShowCreateOrg(false);
                fetchAll();
            }
        } catch (err) { toast.error(err.response?.data?.error || 'Failed', { id: t }); }
    };

    const handleDeleteOrg = async (org) => {
        if (!window.confirm(`☠️ Permanently delete "${org.name}" and ALL its data? This cannot be undone.`)) return;
        const t = toast.loading('Deleting…');
        try {
            await client.post(`/orgs/delete/${org.id}`);
            toast.success('Organization deleted', { id: t });
            fetchAll();
        } catch { toast.error('Failed', { id: t }); }
    };

    const handlePrivacyToggle = async (orgId, currentLevel) => {
        const newLevel = currentLevel === 'standard' ? 'strict' : 'standard';
        const t = toast.loading(`Setting privacy to ${newLevel}…`);
        try {
            await client.patch(`/admin/orgs/${orgId}/privacy`, { privacy_level: newLevel });
            toast.success(`Privacy updated to ${newLevel}`, { id: t });
            setOrgAnalytics(prev => prev.map(o => o.id === orgId ? { ...o, privacy_level: newLevel } : o));
            setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, privacy_level: newLevel } : o));
        } catch (err) { toast.error(err.response?.data?.error || 'Failed to update privacy', { id: t }); }
    };

    const handleRoleChange = async (userId, role) => {
        const t = toast.loading('Updating role…');
        try {
            await client.patch(`/admin/users/${userId}/role`, { role });
            toast.success(`Role updated to ${role}`, { id: t });
            setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
            setPendingRoleChange(null);
        } catch (err) { toast.error(err.response?.data?.error || 'Failed', { id: t }); }
    };

    const handleStatusToggle = async (u) => {
        const newStatus = !u.is_active;
        const t = toast.loading(newStatus ? 'Activating user…' : 'Suspending user…');
        try {
            await client.patch(`/admin/users/${u.id}/status`, { is_active: newStatus });
            toast.success(newStatus ? 'User activated' : 'User suspended & sessions killed', { id: t });
            setAllUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: newStatus } : x));
        } catch (err) { toast.error(err.response?.data?.error || 'Failed', { id: t }); }
    };

    const handleDeleteUser = async (u) => {
        if (!window.confirm(`Permanently delete user "${u.name || u.email}"?`)) return;
        const t = toast.loading('Deleting user…');
        try {
            await client.delete(`/admin/users/${u.id}`);
            toast.success('User permanently deleted', { id: t });
            setAllUsers(prev => prev.filter(x => x.id !== u.id));
        } catch (err) { toast.error(err.response?.data?.error || 'Failed', { id: t }); }
    };

    const exportAuditCSV = () => {
        const header = 'ID,Time,Action,Resource,User,Org,IP';
        const rows = auditLogs.map(l =>
            `${l.id},"${new Date(l.created_at).toISOString()}","${l.action}","${l.resource_type}","${l.username || ''}","${l.org_name || ''}","${l.ip_address || ''}"`
        );
        const csv = [header, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'audit_export.csv'; a.click();
    };

    const formatBytes = (b) => { if (!b || b === 0) return '0 B'; const k = 1024, s = ['B', 'KB', 'MB', 'GB', 'TB']; const i = Math.floor(Math.log(b) / Math.log(k)); return `${(b / Math.pow(k, i)).toFixed(1)} ${s[i]}`; };

    const filteredUsers = allUsers.filter(u => {
        const q = userSearch.toLowerCase();
        const matchSearch = !q || (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
        const matchOrg = !userOrgFilter || String(u.org_id) === userOrgFilter;
        return matchSearch && matchOrg;
    });

    // ── Render ──────────────────────────────────────────────────
    return (
        <>
            <AmbientBackground />
            <div className="relative z-10 min-h-screen pb-16">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-6 space-y-6">

                    {/* ── Top Header ── */}
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-600/20 border border-yellow-500/30">
                                    <Crown className="w-5 h-5 text-yellow-400" />
                                </div>
                                <h1 className="text-2xl font-black text-white tracking-tight">
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500">
                                        Super Admin Console
                                    </span>
                                </h1>
                                <Badge color="gold">GODMODE</Badge>
                            </div>
                            <p className="text-xs text-gray-500 ml-12">
                                {user?.username} · Full system authority · {new Date().toLocaleString()}
                            </p>
                        </div>
                        <button onClick={fetchAll} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all" title="Refresh all data">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    {/* ── Tab Bar ── */}
                    <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.03] border border-white/10 overflow-x-auto">
                        {TABS.map(t => (
                            <button key={t.id} onClick={() => setTab(t.id)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap flex-shrink-0 ${tab === t.id ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
                                <t.icon className="w-3.5 h-3.5" />
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>

                            {/* ════════════════════════════════
                                TAB: COMMAND CENTER
                            ════════════════════════════════ */}
                            {tab === 'command' && (
                                <div className="space-y-6">
                                    {/* KPI Cards */}
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                        <StatCard icon={Building} label="Organizations" value={orgs.length} color="from-blue-500 to-indigo-600" sub="Across all tenants" />
                                        <StatCard icon={Users} label="Total Users" value={allUsers.length} color="from-purple-500 to-pink-600" sub={`${allUsers.filter(u => u.is_active).length} active`} />
                                        <StatCard icon={ShieldAlert} label="Threats Blocked" value={threats.length} color="from-red-500 to-rose-700" sub="Jailbreak attempts" />
                                        <StatCard icon={TrendingUp} label="System Queries" value={systemStatus?.stats?.totalSearches || '—'} color="from-emerald-500 to-teal-600" sub="Chat + Search" />
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        {/* Live Activity Feed */}
                                        <GlassCard className="lg:col-span-2 p-6 flex flex-col">
                                            <div className="flex items-center justify-between mb-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-yellow-500/10 rounded-xl">
                                                        <Activity className="w-5 h-5 text-yellow-400" />
                                                    </div>
                                                    <div>
                                                        <h2 className="text-sm font-black text-white uppercase tracking-widest">Live System Feed</h2>
                                                        <p className="text-[10px] text-gray-600">Real-time WebSocket events</p>
                                                    </div>
                                                </div>
                                                <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                    LIVE
                                                </span>
                                            </div>
                                            <div className="space-y-2 flex-1 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                                                {[...liveActivity, ...(systemStatus?.recentActivity || [])].slice(0, 15).map((log, idx) => (
                                                    <div key={`${log.id}-${idx}`} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${log.action?.includes('jailbreak') ? 'bg-red-500/10 text-red-400' :
                                                            log.action?.includes('fail') ? 'bg-orange-500/10 text-orange-400' :
                                                                log.action?.includes('upload') || log.action?.includes('create') ? 'bg-green-500/10 text-green-400' :
                                                                    'bg-blue-500/10 text-blue-400'
                                                            }`}>
                                                            <Shield className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-xs font-bold text-white capitalize">{log.action?.replace(/_/g, ' ')}</span>
                                                            <span className="text-[10px] text-gray-600 ml-2">by {log.username || log.email || 'System'}</span>
                                                        </div>
                                                        <span className="text-[10px] font-mono text-gray-600 shrink-0">
                                                            {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                ))}
                                                {liveActivity.length === 0 && !systemStatus?.recentActivity?.length && (
                                                    <div className="text-center py-10 text-gray-600 text-xs">Waiting for events…</div>
                                                )}
                                            </div>
                                        </GlassCard>

                                        {/* Service Health */}
                                        <GlassCard className="p-6">
                                            <div className="flex items-center gap-3 mb-5">
                                                <div className="p-2 bg-blue-500/10 rounded-xl">
                                                    <Network className="w-5 h-5 text-blue-400" />
                                                </div>
                                                <div>
                                                    <h2 className="text-sm font-black text-white uppercase tracking-widest">Infrastructure</h2>
                                                    <p className="text-[10px] text-gray-600">Service health monitor</p>
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                {[
                                                    { name: 'PostgreSQL', key: 'postgres', icon: Database, label: 'Primary DB' },
                                                    { name: 'Redis Cache', key: 'redis', icon: Zap, label: 'Session Store' },
                                                    { name: 'AI Worker', key: 'worker', icon: Cpu, label: 'Processing Engine' },
                                                    { name: 'MinIO Storage', key: 'minio', icon: HardDrive, label: 'File Store' },
                                                    { name: 'ChromaDB', key: 'chroma', icon: Layers, label: 'Vector Store' },
                                                ].map(svc => {
                                                    const ok = systemStatus?.health?.[svc.key] !== false;
                                                    return (
                                                        <div key={svc.key} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className={`p-1.5 rounded-lg ${ok ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                                    <svc.icon className="w-3.5 h-3.5" />
                                                                </div>
                                                                <div>
                                                                    <div className="text-xs font-bold text-white">{svc.name}</div>
                                                                    <div className="text-[9px] text-gray-600">{svc.label}</div>
                                                                </div>
                                                            </div>
                                                            <Badge color={ok ? 'green' : 'red'}>{ok ? 'Online' : 'Offline'}</Badge>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </GlassCard>
                                    </div>
                                </div>
                            )}

                            {/* ════════════════════════════════
                                TAB: ORGANIZATIONS
                            ════════════════════════════════ */}
                            {tab === 'orgs' && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-lg font-black text-white">Organization Registry</h2>
                                        <button onClick={() => setShowCreateOrg(v => !v)}
                                            className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 rounded-xl text-yellow-400 font-bold text-xs uppercase tracking-widest transition-all">
                                            <Plus className="w-3.5 h-3.5" /> New Tenant
                                        </button>
                                    </div>

                                    {/* Create Org Form */}
                                    <AnimatePresence>
                                        {showCreateOrg && (
                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                                                <GlassCard className="p-6 border-yellow-500/20">
                                                    <h3 className="text-sm font-black text-white mb-4 uppercase tracking-widest">Onboard New Organization</h3>
                                                    <form onSubmit={handleCreateOrg} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        {[
                                                            { key: 'name', placeholder: 'Organization name', icon: Building },
                                                            { key: 'type', placeholder: 'Sector (e.g. Education)', icon: Layers },
                                                            { key: 'domain', placeholder: 'Domain (e.g. org.com)', icon: Globe },
                                                        ].map(f => (
                                                            <div key={f.key} className="relative">
                                                                <f.icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                                                <input type="text" placeholder={f.placeholder} value={newOrg[f.key]}
                                                                    onChange={e => setNewOrg(p => ({ ...p, [f.key]: e.target.value }))}
                                                                    required={f.key === 'name'}
                                                                    className="glass-input w-full pl-10 pr-4 py-3 rounded-xl text-sm" />
                                                            </div>
                                                        ))}
                                                        <div className="md:col-span-3 flex gap-3">
                                                            <button type="submit" className="btn-primary px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest">Create Organization</button>
                                                            <button type="button" onClick={() => setShowCreateOrg(false)} className="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 text-xs font-bold uppercase tracking-widest transition-all">Cancel</button>
                                                        </div>
                                                    </form>
                                                </GlassCard>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Org Analytics Table */}
                                    <GlassCard className="overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="border-b border-white/5 bg-white/[0.02]">
                                                        {['Organization', 'Type', 'Privacy', 'Users', 'Doc/Toxic', 'Storage', 'Queries', 'Threats', 'Actions'].map(h => (
                                                            <th key={h} className="px-5 py-3.5 text-[10px] font-black text-gray-500 uppercase tracking-widest">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {orgAnalytics.length > 0 ? orgAnalytics.map(org => (
                                                        <tr key={org.id} className="group hover:bg-white/[0.03] transition-colors">
                                                            <td className="px-5 py-4">
                                                                <div className="font-bold text-white text-sm">{org.name}</div>
                                                                <div className="text-[10px] text-gray-600">ID #{org.id}</div>
                                                            </td>
                                                            <td className="px-5 py-4"><Badge color="blue">{org.type || 'N/A'}</Badge></td>
                                                            <td className="px-5 py-4">
                                                                <button
                                                                    onClick={() => handlePrivacyToggle(org.id, org.privacy_level || 'standard')}
                                                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-all border ${(org.privacy_level || 'standard') === 'strict'
                                                                        ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                                                                        : 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
                                                                        }`}
                                                                >
                                                                    {org.privacy_level === 'strict' ? <Shield className="w-2.5 h-2.5" /> : <Shield className="w-2.5 h-2.5 opacity-40" />}
                                                                    {org.privacy_level || 'standard'}
                                                                </button>
                                                            </td>
                                                            <td className="px-5 py-4">
                                                                <div className="flex items-center gap-1.5 text-xs text-white font-bold"><Users className="w-3 h-3 text-gray-500" /> {org.user_count}</div>
                                                            </td>
                                                            <td className="px-5 py-4">
                                                                <div className="flex items-center gap-1 text-sm text-white font-bold">{org.doc_count}</div>
                                                                {parseInt(org.toxic_doc_count) > 0 && (
                                                                    <div className="text-[10px] text-red-400 font-bold flex items-center gap-1 mt-0.5 animate-pulse">
                                                                        <AlertTriangle className="w-2.5 h-2.5" /> {org.toxic_doc_count} toxic
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-5 py-4 text-xs text-gray-400">{formatBytes(org.storage_bytes)}</td>
                                                            <td className="px-5 py-4 text-sm font-bold text-blue-400">{org.query_count}</td>
                                                            <td className="px-5 py-4 text-sm font-bold text-red-400">{org.threat_count}</td>
                                                            <td className="px-5 py-4">
                                                                <button onClick={() => handleDeleteOrg(org)} className="p-2 rounded-lg bg-red-500/5 hover:bg-red-500/20 text-red-500/50 hover:text-red-400 border border-red-500/10 transition-all">
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    )) : orgs.map(org => (
                                                        <tr key={org.id} className="group hover:bg-white/[0.03] transition-colors">
                                                            <td className="px-5 py-4">
                                                                <div className="font-bold text-white text-sm">{org.name}</div>
                                                                <div className="text-[10px] text-gray-600">{org.domain || 'no domain'}</div>
                                                            </td>
                                                            <td className="px-5 py-4"><Badge color="blue">{org.type || 'N/A'}</Badge></td>
                                                            <td colSpan="4" className="px-5 py-4 text-xs text-gray-600">—</td>
                                                            <td className="px-5 py-4"><Badge color="green">✓ Clean</Badge></td>
                                                            <td className="px-5 py-4">
                                                                <button onClick={() => handleDeleteOrg(org)}
                                                                    className="p-1.5 rounded-lg bg-red-500/5 hover:bg-red-500/20 border border-red-500/10 hover:border-red-500/40 text-red-500/50 hover:text-red-400 transition-all">
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {orgs.length === 0 && (
                                                        <tr><td colSpan="8" className="px-5 py-16 text-center text-gray-600 text-sm">No organizations found</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </GlassCard>
                                </div>
                            )}

                            {/* ════════════════════════════════
                                TAB: USER MANAGEMENT
                            ════════════════════════════════ */}
                            {tab === 'users' && (
                                <div className="space-y-5">
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                            <input type="text" placeholder="Search by name or email…" value={userSearch} onChange={e => setUserSearch(e.target.value)}
                                                className="glass-input w-full pl-10 pr-4 py-2.5 rounded-xl text-sm" />
                                        </div>
                                        <div className="relative">
                                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                            <select value={userOrgFilter} onChange={e => setUserOrgFilter(e.target.value)}
                                                className="glass-input pl-10 pr-8 py-2.5 rounded-xl text-sm appearance-none min-w-[180px]">
                                                <option value="">All Organizations</option>
                                                {orgs.map(o => <option key={o.id} value={String(o.id)}>{o.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="text-xs text-gray-500 flex items-center px-3 py-2 bg-white/5 rounded-xl border border-white/10">
                                            {filteredUsers.length} / {allUsers.length} users
                                        </div>
                                    </div>

                                    <GlassCard className="overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="border-b border-white/5 bg-white/[0.02]">
                                                        {['User', 'Organization', 'Role', 'Status', 'Department', 'Actions'].map(h => (
                                                            <th key={h} className="px-5 py-3.5 text-[10px] font-black text-gray-500 uppercase tracking-widest">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {filteredUsers.map(u => {
                                                        const org = orgs.find(o => o.id === u.org_id);
                                                        return (
                                                            <tr key={u.id} className="group hover:bg-white/[0.03] transition-colors">
                                                                <td className="px-5 py-4">
                                                                    <div className="font-bold text-sm text-white">{u.name || u.email?.split('@')[0]}</div>
                                                                    <div className="text-[10px] text-gray-500">{u.email}</div>
                                                                </td>
                                                                <td className="px-5 py-4 text-xs text-gray-400">{org?.name || `Org #${u.org_id}` || '—'}</td>
                                                                <td className="px-5 py-4">
                                                                    {pendingRoleChange?.userId === u.id ? (
                                                                        <select autoFocus defaultValue={u.role}
                                                                            onChange={e => handleRoleChange(u.id, e.target.value)}
                                                                            onBlur={() => setPendingRoleChange(null)}
                                                                            className="glass-input text-xs py-1 px-2 rounded-lg">
                                                                            {['user', 'student', 'faculty', 'researcher', 'admin', 'super_admin'].map(r => (
                                                                                <option key={r} value={r}>{r}</option>
                                                                            ))}
                                                                        </select>
                                                                    ) : (
                                                                        <button onClick={() => setPendingRoleChange({ userId: u.id })}
                                                                            className="hover:opacity-80 transition-opacity" title="Click to change role">
                                                                            <Badge color={roleColor(u.role)}>{u.role}</Badge>
                                                                        </button>
                                                                    )}
                                                                </td>
                                                                <td className="px-5 py-4"><Badge color={u.is_active ? 'green' : 'red'}>{u.is_active ? 'Active' : 'Suspended'}</Badge></td>
                                                                <td className="px-5 py-4 text-xs text-gray-500">{u.department || '—'}</td>
                                                                <td className="px-5 py-4">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <button onClick={() => handleStatusToggle(u)}
                                                                            title={u.is_active ? 'Suspend user' : 'Activate user'}
                                                                            className={`p-1.5 rounded-lg border transition-all ${u.is_active ? 'bg-amber-500/5 hover:bg-amber-500/20 border-amber-500/10 hover:border-amber-500/40 text-amber-500/50 hover:text-amber-400' : 'bg-green-500/5 hover:bg-green-500/20 border-green-500/10 hover:border-green-500/40 text-green-500/50 hover:text-green-400'}`}>
                                                                            {u.is_active ? <Ban className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                                                                        </button>
                                                                        {u.role !== 'super_admin' && (
                                                                            <button onClick={() => handleDeleteUser(u)}
                                                                                title="Permanently delete user"
                                                                                className="p-1.5 rounded-lg bg-red-500/5 hover:bg-red-500/20 border border-red-500/10 hover:border-red-500/40 text-red-500/50 hover:text-red-400 transition-all">
                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {filteredUsers.length === 0 && (
                                                        <tr><td colSpan="6" className="px-5 py-16 text-center text-gray-600 text-sm">No users match your filter</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </GlassCard>
                                </div>
                            )}

                            {/* ════════════════════════════════
                                TAB: THREAT INTELLIGENCE
                            ════════════════════════════════ */}
                            {tab === 'threats' && (
                                <div className="space-y-5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h2 className="text-lg font-black text-white">Threat Intelligence Center</h2>
                                            <p className="text-xs text-gray-500">All jailbreak & prompt injection attempts across all organizations</p>
                                        </div>
                                        <Badge color="red">⚠ {threats.length} events</Badge>
                                    </div>

                                    {threats.length === 0 ? (
                                        <GlassCard className="p-16 text-center">
                                            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                                            <p className="text-emerald-400 font-bold">Zero Threats Detected</p>
                                            <p className="text-gray-600 text-xs mt-1">All guardrails are active and no attacks have been logged.</p>
                                        </GlassCard>
                                    ) : (
                                        <div className="space-y-3">
                                            {threats.map((t, i) => {
                                                let pd = t.details;
                                                if (typeof pd === 'string') { try { pd = JSON.parse(pd); } catch { } }
                                                return (
                                                    <GlassCard key={t.id || i} className="p-4 border-red-500/10 hover:border-red-500/20 transition-all">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div className="flex items-start gap-3">
                                                                <div className="p-2 bg-red-500/10 rounded-lg shrink-0 mt-0.5">
                                                                    <ShieldAlert className="w-4 h-4 text-red-400" />
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <Badge color="red">Jailbreak Attempt</Badge>
                                                                        <span className="text-[10px] text-gray-600 font-mono">
                                                                            {new Date(t.time || t.created_at).toLocaleString()}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-sm font-bold text-white mb-1">
                                                                        {t.username || t.email || 'Unknown User'}
                                                                        {t.email && t.username && <span className="text-gray-500 font-normal ml-2 text-xs">({t.email})</span>}
                                                                    </p>
                                                                    <p className="text-xs text-gray-400 font-mono bg-black/20 px-3 py-2 rounded-lg">
                                                                        {pd?.query_redacted
                                                                            ? `"${pd.query_redacted}"`
                                                                            : pd?.error_message || 'Security violation detected'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="shrink-0 flex flex-col items-end gap-2">
                                                                <Badge color="red">BLOCKED</Badge>
                                                                {t.username && (
                                                                    <button
                                                                        onClick={() => { const u = allUsers.find(x => x.email === t.email); if (u) handleStatusToggle(u); }}
                                                                        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold uppercase transition-all">
                                                                        <Ban className="w-3 h-3" /> Suspend User
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </GlassCard>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ════════════════════════════════
                                TAB: SYSTEM ANALYTICS
                            ════════════════════════════════ */}
                            {tab === 'analytics' && (
                                <div className="space-y-6">
                                    {/* Futuristic Summary Row */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 relative overflow-hidden group">
                                            <div className="absolute -right-2 -bottom-2 w-16 h-16 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all" />
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="p-2 bg-blue-500/10 rounded-xl">
                                                    <BarChart3 className="w-4 h-4 text-blue-400" />
                                                </div>
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Events</span>
                                            </div>
                                            <div className="text-2xl font-black text-white">{auditTotal.toLocaleString()}</div>
                                            <div className="text-[9px] text-gray-600 mt-1 flex items-center gap-1">
                                                <div className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
                                                Aggregated across all services
                                            </div>
                                        </div>

                                        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 relative overflow-hidden group">
                                            <div className="absolute -right-2 -bottom-2 w-16 h-16 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all" />
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="p-2 bg-purple-500/10 rounded-xl">
                                                    <Zap className="w-4 h-4 text-purple-400" />
                                                </div>
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Active Velocity</span>
                                            </div>
                                            <div className="text-2xl font-black text-white">
                                                {liveActivity.length > 0 ? (liveActivity.length * 60).toLocaleString() : '—'}
                                            </div>
                                            <div className="text-[9px] text-gray-600 mt-1 flex items-center gap-1">
                                                <div className="w-1 h-1 rounded-full bg-purple-400 animate-pulse" />
                                                Est. events per hour (live)
                                            </div>
                                        </div>

                                        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 relative overflow-hidden group">
                                            <div className="absolute -right-2 -bottom-2 w-16 h-16 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-all" />
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="p-2 bg-red-500/10 rounded-xl">
                                                    <ShieldAlert className="w-4 h-4 text-red-400" />
                                                </div>
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Critical Anomalies</span>
                                            </div>
                                            <div className="text-2xl font-black text-white">{threats.length}</div>
                                            <div className="text-[9px] text-gray-600 mt-1 flex items-center gap-1">
                                                <div className="w-1 h-1 rounded-full bg-red-400 animate-pulse" />
                                                Detected jailbreak attempts
                                            </div>
                                        </div>

                                        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 relative overflow-hidden group">
                                            <div className="absolute -right-2 -bottom-2 w-16 h-16 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="p-2 bg-emerald-500/10 rounded-xl">
                                                    <Globe className="w-4 h-4 text-emerald-400" />
                                                </div>
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Unique IPs</span>
                                            </div>
                                            <div className="text-2xl font-black text-white">
                                                {new Set(auditLogs.map(l => l.ip_address)).size}
                                            </div>
                                            <div className="text-[9px] text-gray-600 mt-1 flex items-center gap-1">
                                                <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                                                Distributions in current page
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Bar */}
                                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-1 bg-white/[0.02] rounded-2xl border border-white/5 pr-4">
                                        <div className="flex items-center gap-2 pl-4">
                                            <div className="p-1.5 bg-yellow-500/10 rounded-lg">
                                                <Search className="w-3.5 h-3.5 text-yellow-400" />
                                            </div>
                                            <h2 className="text-xs font-black text-white uppercase tracking-widest">Audit Explorer</h2>
                                        </div>
                                        <div className="flex gap-2 flex-wrap items-center">
                                            <div className="relative">
                                                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
                                                <select
                                                    value={auditAction}
                                                    onChange={e => { setAuditAction(e.target.value); setAuditPage(1); }}
                                                    className="bg-white/5 border border-white/10 text-white text-[11px] rounded-xl pl-8 pr-4 py-2 hover:bg-white/10 transition-all appearance-none min-w-[140px] focus:outline-none focus:border-yellow-500/50"
                                                >
                                                    <option value="">All Streams</option>
                                                    {['chat', 'search', 'upload', 'login', 'logout', 'jailbreak_attempt', 'admin_role_change', 'admin_suspend_user', 'register'].map(a => (
                                                        <option key={a} value={a}>{a.replace(/_/g, ' ').toUpperCase()}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
                                            </div>
                                            
                                            <button onClick={fetchAuditLogs} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-gray-300 text-[11px] transition-all font-bold">
                                                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-yellow-500' : ''}`} /> Sync
                                            </button>
                                            
                                            <div className="h-6 w-px bg-white/10 mx-1" />
                                            
                                            <button onClick={exportAuditCSV} className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 rounded-xl border border-yellow-500/20 text-yellow-400 text-[11px] font-black uppercase tracking-widest transition-all">
                                                <Download className="w-3 h-3" /> Export .csv
                                            </button>
                                        </div>
                                    </div>

                                    {/* Main Explorer Table */}
                                    <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden shadow-2xl">
                                        <div className="overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="sticky top-0 z-20">
                                                    <tr className="bg-white/[0.04] border-b border-white/10 backdrop-blur-md">
                                                        {['Timestamp', 'Signal', 'Entity', 'Context', 'Source IP'].map(h => (
                                                            <th key={h} className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/[0.04]">
                                                    {auditLogs.map((log, i) => (
                                                        <motion.tr
                                                            key={log.id || i}
                                                            initial={{ opacity: 0, x: -4 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            transition={{ delay: i * 0.02 }}
                                                            className="group hover:bg-white/[0.02] transition-colors relative"
                                                        >
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-1 h-3 rounded-full bg-white/10 group-hover:bg-yellow-500/50 transition-all" />
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[10px] font-mono text-white font-black tracking-tighter">
                                                                            {new Date(log.created_at).toLocaleTimeString()}
                                                                        </span>
                                                                        <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">
                                                                            {new Date(log.created_at).toLocaleDateString()}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className={`px-2 py-0.5 rounded border inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest shadow-sm ${
                                                                    log.action?.includes('jailbreak') ? 'bg-red-500/10 text-red-500 border-red-500/20 shadow-red-500/5' :
                                                                    log.action?.includes('fail') || log.action?.includes('suspend') ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                                    log.action?.includes('chat') || log.action?.includes('search') ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-cyan-500/5' :
                                                                    log.action?.includes('login') || log.action?.includes('register') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                                                                    'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                                }`}>
                                                                    <div className={`w-1 h-1 rounded-full animate-pulse ${
                                                                        log.action?.includes('jailbreak') ? 'bg-red-500' :
                                                                        log.action?.includes('chat') ? 'bg-cyan-400' : 'bg-current'
                                                                    }`} />
                                                                    {log.action?.replace(/_/g, ' ')}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center shrink-0 border border-white/5 group-hover:border-white/20 transition-all">
                                                                        <Users className="w-3 h-3 text-gray-400" />
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs font-bold text-white tracking-tight">{log.username || 'System'}</span>
                                                                        <span className="text-[9px] text-gray-600 font-mono tracking-tighter">{log.email || 'INTERNAL_PROC'}</span>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="text-[10px] text-gray-400 font-black uppercase tracking-[0.1em]">{log.org_name || 'Global'}</span>
                                                                    <span className="text-[9px] text-gray-600 flex items-center gap-1">
                                                                        <div className="w-1.5 h-px bg-yellow-500/30" />
                                                                        {log.resource_type || 'unlinked'}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="inline-flex items-center gap-2 px-2 py-1 bg-white/[0.03] border border-white/5 rounded-lg">
                                                                    <Globe className="w-2.5 h-2.5 text-gray-600" />
                                                                    <span className="text-[10px] font-mono text-gray-400">{log.ip_address || '0.0.0.0'}</span>
                                                                </div>
                                                            </td>
                                                        </motion.tr>
                                                    ))}
                                                    {auditLogs.length === 0 && (
                                                        <tr><td colSpan="5" className="px-6 py-20 text-center">
                                                            <div className="flex flex-col items-center gap-3 opacity-30">
                                                                <Database className="w-8 h-8 text-gray-400" />
                                                                <p className="text-xs font-black uppercase tracking-widest text-gray-500">No signals intercepted</p>
                                                            </div>
                                                        </td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                        
                                        {/* Pagination Footer */}
                                        <div className="flex items-center justify-between px-6 py-5 bg-white/[0.02] border-t border-white/10">
                                            <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                                <span className="text-white">Page {auditPage}</span> of {Math.ceil(auditTotal / 50)}
                                                <div className="h-3 w-px bg-white/10 mx-1" />
                                                Viewing <span className="text-yellow-500">{auditLogs.length}</span> of {auditTotal} segments
                                            </div>
                                            <div className="flex gap-2">
                                                <button 
                                                    disabled={auditPage === 1} 
                                                    onClick={() => { setAuditPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 text-[10px] font-black uppercase tracking-widest disabled:opacity-20 transition-all flex items-center gap-2"
                                                >
                                                    ← Backtrack
                                                </button>
                                                <button 
                                                    disabled={auditPage >= Math.ceil(auditTotal / 50)} 
                                                    onClick={() => { setAuditPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 text-[10px] font-black uppercase tracking-widest disabled:opacity-20 transition-all flex items-center gap-2"
                                                >
                                                    Advance →
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </>
    );
}
