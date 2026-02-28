import React, { useState } from 'react';
import client from '../api/index';
import { useAuth } from '../contexts/AuthContext';
import {
    Users, UserPlus, Database, Activity, FileText,
    Server, Shield, AlertTriangle, CheckCircle2, XCircle,
    RefreshCw, Lock, Trash2, Mail, Building2, Zap, Cpu,
    Loader2, ChevronRight, HardDrive, BarChart3
} from 'lucide-react';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import { Link } from 'react-router-dom';
import DataUpload from '../components/DataUpload';
import AmbientBackground from '../components/ui/AmbientBackground';
import AnimatedCard from '../components/ui/AnimatedCard';
import { motion } from 'framer-motion';
import { staggeredContainerVariants, staggeredItemVariants } from '../components/ui/StaggeredList';

export default function AdminDashboard() {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState(null);
    const [uploads, setUploads] = useState([]);
    const [systemHealth, setSystemHealth] = useState(null);
    const [loading, setLoading] = useState(true);
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '', department: '', user_category: 'employee' });

    React.useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);

        const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const socket = io(socketUrl, { withCredentials: true, transports: ['websocket', 'polling'] });

        socket.on('connect', () => socket.emit('subscribe:system'));
        socket.on('activity', (evt) => {
            setStats(prev => {
                if (!prev) return prev;
                const updated = { ...prev };
                if (evt.action === 'upload' || evt.action === 'document_added')
                    updated.totalDocuments = (updated.totalDocuments || 0) + 1;
                return updated;
            });
        });

        return () => { clearInterval(interval); socket.disconnect(); };
    }, []);

    const fetchData = async () => {
        try {
            const [usersRes, statsRes, uploadsRes, healthRes] = await Promise.all([
                client.get('/admin/users').catch(() => ({ data: { users: [] } })),
                client.get('/admin/stats').catch(() => ({ data: { stats: {} } })),
                client.get('/admin/uploads').catch(() => ({ data: { uploads: [] } })),
                client.get('/health').catch(() => ({ data: { services: {} } }))
            ]);
            if (usersRes?.data?.success) setUsers(usersRes.data.users || []);
            if (statsRes?.data?.success) setStats(statsRes.data.stats || {});
            if (uploadsRes?.data?.success) setUploads(uploadsRes.data.uploads || []);
            setSystemHealth(healthRes?.data?.services || {});
            setLoading(false);
        } catch (err) { console.error(err); setLoading(false); }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            const res = await client.post('/admin/users/create', newUser);
            if (res.data.success) {
                toast.success('User created successfully');
                setNewUser({ name: '', email: '', password: '', department: '', user_category: 'employee' });
                fetchData();
            }
        } catch (err) { toast.error(err.response?.data?.error || 'Failed to create user'); }
    };

    const handleDeleteDocument = async (docId, filename) => {
        if (!window.confirm(`Delete "${filename}"? This cannot be undone.`)) return;
        try {
            const res = await client.delete(`/documents/${docId}`);
            if (res.data.success) { toast.success('Document deleted'); fetchData(); }
        } catch (err) { toast.error(err.response?.data?.error || 'Failed to delete document'); }
    };

    const handleSuspendUser = async (userId, username) => {
        if (!window.confirm(`Suspend "${username}"?`)) return;
        try {
            const res = await client.put(`/admin/users/${userId}/suspend`);
            if (res.data.success) { toast.success(`${username} suspended`); fetchData(); }
        } catch (err) { toast.error(err.response?.data?.error || 'Failed to suspend user'); }
    };

    const handleReactivateUser = async (userId, username) => {
        if (!window.confirm(`Reactivate "${username}"?`)) return;
        try {
            const res = await client.put(`/admin/users/${userId}/reactivate`);
            if (res.data.success) { toast.success(`${username} reactivated`); fetchData(); }
        } catch (err) { toast.error(err.response?.data?.error || 'Failed to reactivate user'); }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen animated-gradient-bg">
            <div className="w-16 h-16 border-4 border-premium-gold/30 rounded-full animate-spin border-t-premium-gold" />
        </div>
    );

    const indexedPct = Math.round(((stats?.processedDocuments || 0) / (stats?.totalDocuments || 1)) * 100);

    return (
        <>
            <AmbientBackground />
            <div className="min-h-screen relative z-10 p-6 w-full">
                <div className="max-w-7xl mx-auto space-y-6">

                    {/* ── Header ──────────────────────────────────── */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <div className="p-2 bg-premium-gold/10 rounded-lg border border-premium-gold/20">
                                    <Shield className="w-5 h-5 text-premium-gold" />
                                </div>
                                <h1 className="text-2xl font-bold text-white">Admin Command Center</h1>
                            </div>
                            <p className="text-gray-400 text-sm pl-1">
                                Managing <span className="text-premium-gold font-semibold">{stats?.organizationName || 'Global System'}</span>
                            </p>
                        </div>
                        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors text-sm text-gray-300">
                            <RefreshCw className="w-4 h-4" /> Refresh Data
                        </button>
                    </div>

                    {/* ── Infrastructure Telemetry ─────────────────── */}
                    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-sm p-6 animate-fade-in">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                                    <Activity className="w-5 h-5 text-green-400" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-white">Infrastructure Telemetry</h2>
                                    <p className="text-xs text-gray-500">Real-time service health monitoring</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_#4ade80]" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-green-400">Live Stream</span>
                            </div>
                        </div>

                        {/* Service Health Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <ServiceCard name="Postgres Core" label="Primary Database" status={systemHealth?.postgres} icon={Database} />
                            <ServiceCard name="Redis Stream" label="Cache & Queue" status={systemHealth?.redis} icon={Zap} />
                            <ServiceCard name="AI Sentinel" label="Vector Worker" status={systemHealth?.worker} icon={Cpu} />
                            <ServiceCard name="Vault (MinIO)" label="Object Storage" status={systemHealth?.minio} icon={HardDrive} />
                        </div>
                    </div>

                    {/* ── 4 Metric Cards ───────────────────────────── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
                        <MetricCard icon={FileText} label="Total Documents" value={stats?.totalDocuments || 0} subtext={stats?.recentUploads ? `+${stats.recentUploads} in last 24h` : 'No recent uploads'} color="text-purple-400" accent="from-purple-500/20 to-purple-600/5" border="border-purple-500/20" />
                        <MetricCard icon={Users} label="Active Users" value={stats?.totalUsers || 0} subtext="Organization members" color="text-blue-400" accent="from-blue-500/20 to-blue-600/5" border="border-blue-500/20" />
                        <MetricCard icon={Database} label="Data Sources" value={stats?.dataSourcesCount || 0} subtext="Indexed files" color="text-amber-400" accent="from-amber-500/20 to-amber-600/5" border="border-amber-500/20" />
                        {/* Processing progress card */}
                        <div className="rounded-xl bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 border border-emerald-500/20 p-5 flex flex-col justify-between">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Processing</span>
                                </div>
                                {stats?.pendingDocuments > 0 ? (
                                    <span className="flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">
                                        <Loader2 className="w-2 h-2 animate-spin" /> In Progress
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                        <CheckCircle2 className="w-2 h-2" /> Synced
                                    </span>
                                )}
                            </div>
                            <div className="flex justify-between items-baseline mb-2">
                                <span className="text-2xl font-black text-white">{stats?.totalDocuments || 0}</span>
                                <span className="text-emerald-400 font-bold text-lg">{stats?.processedDocuments || 0} <span className="text-xs text-gray-500">indexed</span></span>
                            </div>
                            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-3">
                                <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${indexedPct}%` }} />
                            </div>
                            <Link to="/data" className="text-[10px] text-premium-gold hover:text-white transition-colors flex items-center gap-1 uppercase font-black tracking-widest">
                                Manage Processing <ChevronRight className="w-3 h-3" />
                            </Link>
                        </div>
                    </div>

                    {/* ── Main Content: 2/3 + 1/3 ─────────────────── */}
                    <motion.div
                        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
                        variants={staggeredContainerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {/* Left 2/3 column */}
                        <motion.div variants={staggeredItemVariants} className="lg:col-span-2 space-y-5">

                            {/* Provision User */}
                            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-6 relative overflow-hidden">
                                <div className="absolute -right-16 -top-16 w-48 h-48 bg-premium-gold/5 rounded-full blur-3xl pointer-events-none" />
                                <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-3">
                                    <span className="p-2 bg-premium-gold/10 rounded-lg border border-premium-gold/20">
                                        <UserPlus className="w-4 h-4 text-premium-gold" />
                                    </span>
                                    Provision Identity
                                </h3>
                                <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                                    <FormField label="Full Name" icon={Users} placeholder="John Doe" type="text" value={newUser.name} onChange={v => setNewUser({ ...newUser, name: v })} required />
                                    <FormField label="Email Address" icon={Mail} placeholder="john@organization.com" type="email" value={newUser.email} onChange={v => setNewUser({ ...newUser, email: v })} required />
                                    <FormField label="Secure Password" icon={Lock} placeholder="••••••••" type="password" value={newUser.password} onChange={v => setNewUser({ ...newUser, password: v })} required />
                                    <FormField label="Department" icon={Building2} placeholder="e.g. Finance, IT" type="text" value={newUser.department} onChange={v => setNewUser({ ...newUser, department: v })} />
                                    <div className="space-y-1 md:col-span-2">
                                        <label className="text-[10px] uppercase tracking-widest font-black text-gray-500 ml-1">Access Tier</label>
                                        <div className="relative">
                                            <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                            <select
                                                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-premium-gold/50 focus:ring-1 focus:ring-premium-gold/50 transition-all appearance-none"
                                                value={newUser.user_category}
                                                onChange={e => setNewUser({ ...newUser, user_category: e.target.value })}
                                            >
                                                <option value="employee" className="bg-gray-900">Standard Employee Access</option>
                                                <option value="contractor" className="bg-gray-900">Contractor / Limited</option>
                                                <option value="guest" className="bg-gray-900">Guest Reviewer</option>
                                            </select>
                                        </div>
                                    </div>
                                    <button type="submit" className="md:col-span-2 btn-primary py-3.5 rounded-xl font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-all hover:shadow-[0_0_20px_rgba(234,179,8,0.35)] mt-1">
                                        <UserPlus className="w-4 h-4" /> Initialize Identity
                                    </button>
                                </form>
                            </div>

                            {/* Users Directory */}
                            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent overflow-hidden">
                                <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
                                    <Users className="w-4 h-4 text-blue-400" />
                                    <h3 className="text-base font-bold text-white">Users Directory</h3>
                                    <span className="ml-auto px-2 py-0.5 text-[10px] rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">{users.length} members</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-white/[0.03] text-[11px] font-bold uppercase tracking-wider text-gray-500">
                                                <th className="px-6 py-3">Member</th>
                                                <th className="px-4 py-3">Role</th>
                                                <th className="px-4 py-3">Status</th>
                                                <th className="px-4 py-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/[0.04]">
                                            {users.map((u) => (
                                                <tr key={u.id} className="hover:bg-white/[0.03] transition-colors group">
                                                    <td className="px-6 py-3.5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-xs font-black border border-white/10 text-gray-300">
                                                                {(u.name || u.username || 'U')[0].toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-semibold text-white group-hover:text-premium-gold transition-colors">
                                                                    {u.name || u.username}
                                                                </div>
                                                                <div className="text-xs text-gray-500 font-mono">{u.email}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <span className="px-2 py-1 rounded-md text-[10px] bg-white/5 text-gray-300 border border-white/10 font-bold uppercase tracking-wider">
                                                            {u.role}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        {u.is_active ? (
                                                            <span className="flex items-center gap-1.5 text-xs font-bold text-green-400">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_#4ade80]" /> Active
                                                            </span>
                                                        ) : (
                                                            <span className="flex items-center gap-1.5 text-xs font-bold text-red-400">
                                                                <XCircle className="w-3.5 h-3.5" /> Suspended
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right">
                                                        {u.id !== user.id && (
                                                            u.is_active ? (
                                                                <button onClick={() => handleSuspendUser(u.id, u.name || u.username)}
                                                                    className="text-xs px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-all">
                                                                    Suspend
                                                                </button>
                                                            ) : (
                                                                <button onClick={() => handleReactivateUser(u.id, u.name || u.username)}
                                                                    className="text-xs px-3 py-1.5 bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 rounded-lg transition-all flex items-center gap-1 ml-auto">
                                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Reactivate
                                                                </button>
                                                            )
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Data Upload */}
                            {user?.role !== 'student' && (
                                <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-6">
                                    <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                                        <Database className="w-4 h-4 text-premium-gold" /> Upload New Data
                                    </h3>
                                    <DataUpload onUploadComplete={fetchData} />
                                </div>
                            )}

                        </motion.div>

                        {/* Right 1/3 column */}
                        <motion.div variants={staggeredItemVariants} className="space-y-5">

                            {/* Data Ingestion Log */}
                            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent overflow-hidden">
                                <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
                                    <Database className="w-4 h-4 text-amber-400" />
                                    <h3 className="text-base font-bold text-white">Data Ingestion Log</h3>
                                </div>
                                <div className="p-4 space-y-2 max-h-[520px] overflow-y-auto custom-scrollbar">
                                    {uploads.length === 0 ? (
                                        <div className="text-center py-10 text-gray-500 text-sm">No uploads found.</div>
                                    ) : uploads.map((up, i) => (
                                        <div key={up.id || i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] transition-colors group">
                                            <div className="flex-1 min-w-0 mr-3">
                                                <div className="text-sm font-semibold text-gray-200 truncate group-hover:text-white transition-colors">{up.filename}</div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <FileText className="w-3 h-3 text-gray-600" />
                                                    <span className="text-[11px] text-gray-500">{up.document_count || 'Processing...'} records</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className="text-[11px] text-gray-600">
                                                    {new Date(up.uploaded_at || up.created_at).toLocaleDateString()}
                                                </span>
                                                <button
                                                    onClick={() => handleDeleteDocument(up.id, up.filename)}
                                                    className="p-1.5 text-red-500/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Delete">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </motion.div>
                    </motion.div>

                </div>
            </div>
        </>
    );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ServiceCard({ name, label, status, icon: Icon }) {
    const online = !!status;
    return (
        <div className={`rounded-xl border p-4 flex items-center gap-4 transition-colors ${online ? 'bg-green-500/5 border-green-500/15 hover:border-green-500/30' : 'bg-red-500/5 border-red-500/15 hover:border-red-500/30'
            }`}>
            <div className={`p-2.5 rounded-lg flex-shrink-0 ${online ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                <Icon className={`w-5 h-5 ${online ? 'text-green-400' : 'text-red-400'}`} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate">{name}</div>
                <div className="text-[11px] text-gray-500 truncate">{label}</div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className={`w-2 h-2 rounded-full ${online ? 'bg-green-400 shadow-[0_0_8px_#4ade80] animate-pulse' : 'bg-red-500'}`} />
                <span className={`text-[10px] font-black uppercase tracking-widest ${online ? 'text-green-400' : 'text-red-400'}`}>
                    {online ? 'Online' : 'Offline'}
                </span>
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, label, value, subtext, color, accent, border }) {
    return (
        <div className={`rounded-xl bg-gradient-to-br ${accent} border ${border} p-5 flex flex-col gap-3`}>
            <div className="flex items-center justify-between">
                <Icon className={`w-5 h-5 ${color}`} />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-600 bg-black/20 px-2 py-0.5 rounded border border-white/5">Live</span>
            </div>
            <div>
                <div className={`text-3xl font-black text-white`}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
                <div className={`text-xs font-bold uppercase tracking-wider mt-0.5 ${color}`}>{label}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">{subtext}</div>
            </div>
        </div>
    );
}

function FormField({ label, icon: Icon, placeholder, type, value, onChange, required }) {
    return (
        <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest font-black text-gray-500 ml-1">{label}</label>
            <div className="relative">
                <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-600 focus:border-premium-gold/50 focus:ring-1 focus:ring-premium-gold/50 transition-all text-sm"
                    placeholder={placeholder}
                    type={type}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    required={required}
                />
            </div>
        </div>
    );
}
