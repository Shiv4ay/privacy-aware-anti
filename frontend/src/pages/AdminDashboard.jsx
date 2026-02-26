import React, { useState } from 'react';
import client from '../api/index';
import { useAuth } from '../contexts/AuthContext';
import {
    Users, UserPlus, Database, Activity, FileText,
    Server, Shield, AlertTriangle, CheckCircle2, XCircle,
    RefreshCw, Lock, Trash2, Mail, Building2, Zap, LayoutDashboard
} from 'lucide-react';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
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
        const interval = setInterval(fetchData, 30000); // Fallback sweep

        // Real-time integration
        const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const socket = io(socketUrl, {
            withCredentials: true,
            transports: ['websocket', 'polling']
        });

        socket.on('connect', () => {
            console.log('🔌 Admin Dashboard connected to real-time gateway');
            socket.emit('subscribe:system');
        });

        socket.on('activity', (newActivity) => {
            // Live counters
            setStats(prev => {
                if (!prev) return prev;
                const updated = { ...prev };
                if (newActivity.action === 'upload' || newActivity.action === 'document_added') {
                    updated.totalDocuments = (updated.totalDocuments || 0) + 1;
                }
                return updated;
            });
        });

        // Backend health updates
        socket.on('stats_update', (newStats) => {
            // For true advanced UI, we might trigger a brief flash to show data arriving
        });

        return () => {
            clearInterval(interval);
            socket.disconnect();
        };
    }, []);

    const fetchData = async () => {
        try {
            const [usersRes, statsRes, uploadsRes, healthRes] = await Promise.all([
                client.get('/admin/users').catch(e => ({ data: { users: [] } })),
                client.get('/admin/stats').catch(e => ({ data: { stats: {} } })),
                client.get('/admin/uploads').catch(e => ({ data: { uploads: [] } })),
                client.get('/health').catch(e => ({ data: { services: {} } }))
            ]);

            if (usersRes?.data?.success) setUsers(usersRes.data.users || []);
            if (statsRes?.data?.success) setStats(statsRes.data.stats || {});
            if (uploadsRes?.data?.success) setUploads(uploadsRes.data.uploads || []);
            setSystemHealth(healthRes?.data?.services || {});

            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
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
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create user');
        }
    };

    const handleDeleteDocument = async (docId, filename) => {
        if (!window.confirm(`Are you sure you want to delete "${filename}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const res = await client.delete(`/documents/${docId}`);
            if (res.data.success) {
                toast.success(res.data.message || 'Document deleted successfully');
                // Refresh data
                fetchData();
            }
        } catch (err) {
            console.error('Delete error:', err);
            toast.error(err.response?.data?.error || 'Failed to delete document');
        }
    };

    const handleSuspendUser = async (userId, username) => {
        if (!window.confirm(`Are you sure you want to suspend user "${username}"? They will be immediately disconnected and locked out.`)) return;
        try {
            const res = await client.put(`/admin/users/${userId}/suspend`);
            if (res.data.success) {
                toast.success(`User ${username} suspended successfully`);
                fetchData();
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to suspend user');
        }
    };

    const handleReactivateUser = async (userId, username) => {
        if (!window.confirm(`Reactivate user "${username}"? They will regain access to the system.`)) return;
        try {
            const res = await client.put(`/admin/users/${userId}/reactivate`);
            if (res.data.success) {
                toast.success(`User ${username} reactivated successfully`);
                fetchData();
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to reactivate user');
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen animated-gradient-bg">
            <div className="relative">
                <div className="w-16 h-16 border-4 border-premium-gold/30 rounded-full animate-spin border-t-premium-gold"></div>
            </div>
        </div>
    );

    return (
        <>
            <AmbientBackground />
            <div className="min-h-screen relative z-10 p-6 w-full overflow-hidden">
                <div className="max-w-7xl mx-auto space-y-6">

                    {/* Header Section */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 animate-fade-in">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-premium-gold/10 rounded-lg border border-premium-gold/20">
                                    <Shield className="w-6 h-6 text-premium-gold" />
                                </div>
                                <h1 className="text-3xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                                    Admin Command Center
                                </h1>
                            </div>
                            <p className="text-gray-400 font-light">
                                Managing <span className="text-premium-gold font-semibold">{stats?.organizationName || 'Global System'}</span>
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={fetchData} className="glass-panel px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-white/10 transition-colors">
                                <RefreshCw className="w-4 h-4 text-gray-300" />
                                <span className="text-sm text-gray-300">Refresh Data</span>
                            </button>
                        </div>
                    </div>

                    {/* System Health Panel */}
                    <AnimatedCard className="glass-panel-strong p-6 rounded-2xl animate-fade-in border border-white/10 relative overflow-hidden bg-gradient-to-br from-white/[0.02] to-transparent shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                            <Server className="w-48 h-48 text-premium-gold" />
                        </div>

                        <div className="flex items-center justify-between mb-6 relative z-10">
                            <h2 className="text-xl font-bold text-white flex items-center gap-3 tracking-wide">
                                <Activity className="w-5 h-5 text-green-400 animate-pulse" />
                                Infrastructure Telemetry
                            </h2>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e] animate-pulse"></div>
                                <span className="text-[10px] uppercase tracking-widest text-green-400 font-bold">Live Stream</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
                            <HealthIndicator name="Postgres Core" status={systemHealth?.postgres} icon={Database} />
                            <HealthIndicator name="Redis Stream" status={systemHealth?.redis} icon={Zap} />
                            <HealthIndicator name="AI Sentinel" status={systemHealth?.worker} icon={Shield} />
                            <HealthIndicator name="Vault (MinIO)" status={systemHealth?.minio} icon={Lock} />
                        </div>
                    </AnimatedCard>

                    {/* Core Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in" style={{ animationDelay: '100ms' }}>
                        <MetricCard
                            icon={FileText}
                            label="Total Documents"
                            value={stats?.totalDocuments || 0}
                            subtext={stats?.recentUploads ? `+${stats.recentUploads} in last 24h` : "No recent uploads"}
                            color="text-purple-400"
                            bg="bg-purple-500/10"
                        />
                        <MetricCard
                            icon={Users}
                            label="Active Users"
                            value={stats?.totalUsers || 0}
                            subtext="Organization members"
                            color="text-blue-400"
                            bg="bg-blue-500/10"
                        />
                        <MetricCard
                            icon={Database}
                            label="Data Sources"
                            value={stats?.dataSourcesCount || 0}
                            subtext="Indexed files"
                            color="text-premium-gold"
                            bg="bg-premium-gold/10"
                        />
                    </div>

                    <motion.div
                        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
                        variants={staggeredContainerVariants}
                        initial="hidden"
                        animate="visible"
                    >

                        {/* Left Col: User Management */}
                        <motion.div variants={staggeredItemVariants} className="lg:col-span-2 space-y-4">

                            {/* Add User Form */}
                            <div className="glass-panel p-6 rounded-2xl border border-white/5 hover:border-premium-gold/30 transition-all shadow-xl relative overflow-hidden group">
                                <div className="absolute -right-20 -top-20 w-40 h-40 bg-premium-gold/10 rounded-full blur-3xl group-hover:bg-premium-gold/20 transition-all pointer-events-none"></div>
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                                    <span className="p-2 bg-gradient-to-br from-premium-gold/20 to-transparent rounded-lg border border-premium-gold/30">
                                        <UserPlus className="w-5 h-5 text-premium-gold" />
                                    </span>
                                    Provision Identity
                                </h3>
                                <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase tracking-widest font-black text-gray-500 ml-1">Full Name</label>
                                        <div className="relative group/input">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 group-focus-within/input:text-premium-gold transition-colors">
                                                <Users className="w-4 h-4" />
                                            </div>
                                            <input
                                                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-600 focus:border-premium-gold/50 focus:ring-1 focus:ring-premium-gold/50 transition-all"
                                                placeholder="John Doe"
                                                value={newUser.name}
                                                onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase tracking-widest font-black text-gray-500 ml-1">Email Address</label>
                                        <div className="relative group/input">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 group-focus-within/input:text-premium-gold transition-colors">
                                                <Mail className="w-4 h-4" />
                                            </div>
                                            <input
                                                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-600 focus:border-premium-gold/50 focus:ring-1 focus:ring-premium-gold/50 transition-all"
                                                placeholder="john@organization.com"
                                                type="email"
                                                value={newUser.email}
                                                onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase tracking-widest font-black text-gray-500 ml-1">Secure Password</label>
                                        <div className="relative group/input">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 group-focus-within/input:text-premium-gold transition-colors">
                                                <Lock className="w-4 h-4" />
                                            </div>
                                            <input
                                                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-600 focus:border-premium-gold/50 focus:ring-1 focus:ring-premium-gold/50 transition-all"
                                                placeholder="••••••••"
                                                type="password"
                                                value={newUser.password}
                                                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase tracking-widest font-black text-gray-500 ml-1">Department Cluster</label>
                                        <div className="relative group/input">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 group-focus-within/input:text-premium-gold transition-colors">
                                                <Building2 className="w-4 h-4" />
                                            </div>
                                            <input
                                                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-600 focus:border-premium-gold/50 focus:ring-1 focus:ring-premium-gold/50 transition-all"
                                                placeholder="e.g. Finance, IT"
                                                value={newUser.department}
                                                onChange={e => setNewUser({ ...newUser, department: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1 md:col-span-2">
                                        <label className="text-[10px] uppercase tracking-widest font-black text-gray-500 ml-1">Access Tier</label>
                                        <div className="relative group/input">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 group-focus-within/input:text-premium-gold transition-colors">
                                                <Shield className="w-4 h-4" />
                                            </div>
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

                                    <button type="submit" className="md:col-span-2 btn-primary py-4 rounded-xl font-bold uppercase tracking-widest text-sm shadow-[0_0_15px_rgba(234,179,8,0.2)] hover:shadow-[0_0_25px_rgba(234,179,8,0.4)] transition-all flex items-center justify-center gap-2 group/btn mt-2">
                                        <UserPlus className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                                        Initialize Identity
                                    </button>
                                </form>
                            </div>

                            {/* User List */}
                            <div className="glass-panel p-6 rounded-2xl overflow-hidden">
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Users className="w-5 h-5 text-blue-400" />
                                    Users Directory
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="text-gray-500 text-sm border-b border-white/5">
                                                <th className="pb-3 pl-2">Name</th>
                                                <th className="pb-3">Email</th>
                                                <th className="pb-3">Role</th>
                                                <th className="pb-3">Status</th>
                                                <th className="pb-3 text-right pr-4">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm">
                                            {users.map((u, i) => (
                                                <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.04] transition-colors group cursor-default">
                                                    <td className="py-4 pl-2 font-medium text-gray-200 group-hover:text-premium-gold transition-colors flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-[10px] uppercase font-black border border-white/10">{(u.name || u.username || 'U')[0]}</div>
                                                        {u.name || u.username}
                                                    </td>
                                                    <td className="py-4 text-gray-400 text-xs font-mono">{u.email}</td>
                                                    <td className="py-4">
                                                        <span className="px-2 py-1 rounded text-[10px] bg-white/5 text-gray-300 border border-white/10 uppercase font-black tracking-widest text-shadow-sm">
                                                            {u.role}
                                                        </span>
                                                    </td>
                                                    <td className="py-4">
                                                        {u.is_active ?
                                                            <span className="text-green-400 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"><div className="w-1.5 h-1.5 rounded-full bg-green-500 glow-green" /> Active</span> :
                                                            <span className="text-red-400 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"><XCircle className="w-3.5 h-3.5" /> Suspended</span>
                                                        }
                                                    </td>
                                                    <td className="py-4 text-right pr-4">
                                                        {u.id !== user.id && (
                                                            u.is_active ? (
                                                                <button
                                                                    onClick={() => handleSuspendUser(u.id, u.name || u.username)}
                                                                    className="text-xs px-3 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/50 rounded transition-all"
                                                                >
                                                                    Suspend
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleReactivateUser(u.id, u.name || u.username)}
                                                                    className="text-xs px-3 py-1 bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 hover:border-green-500/50 rounded transition-all flex items-center gap-1 ml-auto"
                                                                >
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

                            {/* Data Upload Section - Hidden for Students */}
                            {user?.role !== 'student' && (
                                <div className="glass-panel p-6 rounded-2xl">
                                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                        <Database className="w-5 h-5 text-premium-gold" />
                                        Upload New Data
                                    </h3>
                                    <DataUpload onUploadComplete={fetchData} />
                                </div>
                            )}

                        </motion.div>

                        {/* Right Col: Activity Log */}
                        <motion.div variants={staggeredItemVariants} className="space-y-4">
                            <AnimatedCard className="glass-panel p-6 rounded-2xl h-full border border-white/5 hover:border-premium-gold/30">
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Database className="w-5 h-5 text-gray-400" />
                                    Data Ingestion Log
                                </h3>
                                <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                                    {uploads.map((up, i) => (
                                        <div key={up.id || i} className="p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                            <div className="flex items-start justify-between mb-1">
                                                <span className="text-gray-200 font-medium text-sm truncate max-w-[150px]">{up.filename}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-500">{new Date(up.uploaded_at || up.created_at).toLocaleDateString()}</span>
                                                    <button
                                                        onClick={() => handleDeleteDocument(up.id, up.filename)}
                                                        className="p-1 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                                        title="Delete document"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                                <FileText className="w-3 h-3" />
                                                {up.document_count || 'Processing...'}
                                            </div>
                                        </div>
                                    ))}
                                    {uploads.length === 0 && (
                                        <div className="text-center py-8 text-gray-500 text-sm">
                                            No recent uploads found.
                                        </div>
                                    )}
                                </div>
                            </AnimatedCard>
                        </motion.div>

                    </motion.div>
                </div>
            </div>
        </>
    );
}

function MetricCard({ icon: Icon, label, value, subtext, color, bg }) {
    return (
        <AnimatedCard className="glass-panel p-6 rounded-2xl relative overflow-hidden group border border-white/5 hover:border-premium-gold/30 h-full">
            <div className={`absolute -right-6 -top-6 w-32 h-32 rounded-full ${bg} opacity-20 blur-2xl group-hover:scale-150 transition-transform duration-700 pointer-events-none`} />
            <div className="flex items-start justify-between mb-4 relative z-10">
                <div className={`p-3.5 rounded-xl bg-gradient-to-br ${bg} border border-white/5 shadow-black/50 shadow-lg`}>
                    <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 bg-black/30 px-2 py-1 rounded border border-white/5">Local View</div>
            </div>
            <div className="text-4xl font-black text-white mb-1 tracking-tight relative z-10">{value.toLocaleString()}</div>
            <div className="text-sm text-gray-400 font-bold uppercase tracking-wider mb-1 relative z-10">{label}</div>
            <div className="text-xs text-gray-500 font-medium relative z-10">{subtext}</div>
        </AnimatedCard>
    );
}

function HealthIndicator({ name, status, icon: Icon = Database }) {
    return (
        <div className="bg-black/30 rounded-xl p-4 flex flex-col justify-between border border-white/5 hover:border-premium-gold/20 transition-colors group">
            <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${status ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-500'}`}>
                    <Icon className="w-5 h-5" />
                </div>
                <span className="text-sm text-gray-300 font-bold tracking-wide">{name}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 w-fit border border-white/5">
                <div className={`w-2 h-2 rounded-full ${status ? 'bg-green-500 glow-green' : 'bg-red-500 glow-red'}`}></div>
                <span className={`text-[10px] font-black uppercase tracking-widest ${status ? 'text-green-400' : 'text-red-400'}`}>
                    {status ? 'Online' : 'Offline'}
                </span>
            </div>
        </div>
    );
}
