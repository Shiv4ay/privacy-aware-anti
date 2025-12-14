import React, { useState, useEffect } from 'react';
import client from '../api/index';
import { useAuth } from '../contexts/AuthContext';
import {
    Users, UserPlus, Database, Activity, FileText,
    Server, Shield, AlertTriangle, CheckCircle2, XCircle,
    RefreshCw, Lock
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState(null);
    const [uploads, setUploads] = useState([]);
    const [systemHealth, setSystemHealth] = useState(null);
    const [loading, setLoading] = useState(true);
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '', department: '', user_category: 'employee' });

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // Refresh every 30s
        return () => clearInterval(interval);
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

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen animated-gradient-bg">
            <div className="relative">
                <div className="w-16 h-16 border-4 border-premium-gold/30 rounded-full animate-spin border-t-premium-gold"></div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen animated-gradient-bg p-6 lg:p-12">
            <div className="max-w-7xl mx-auto space-y-8 relative z-10">

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
                <div className="glass-panel-strong p-6 rounded-2xl animate-fade-in border-t border-white/10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Server className="w-24 h-24 text-white" />
                    </div>

                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-green-400" />
                        System Health Status
                    </h2>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <HealthIndicator name="Database" status={systemHealth?.postgres} />
                        <HealthIndicator name="Redis Cache" status={systemHealth?.redis} />
                        <HealthIndicator name="AI Worker" status={systemHealth?.worker} />
                        <HealthIndicator name="Storage" status={systemHealth?.minio} />
                    </div>
                </div>

                {/* Core Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
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

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Col: User Management */}
                    <div className="lg:col-span-2 space-y-6 animate-fade-in" style={{ animationDelay: '200ms' }}>

                        {/* Add User Form */}
                        <div className="glass-panel p-6 rounded-2xl">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <UserPlus className="w-5 h-5 text-premium-gold" />
                                Provision New User
                            </h3>
                            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input
                                    className="glass-input px-4 py-3 rounded-xl"
                                    placeholder="Full Name"
                                    value={newUser.name}
                                    onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                                    required
                                />
                                <input
                                    className="glass-input px-4 py-3 rounded-xl"
                                    placeholder="Email Address"
                                    type="email"
                                    value={newUser.email}
                                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                    required
                                />
                                <input
                                    className="glass-input px-4 py-3 rounded-xl"
                                    placeholder="Password"
                                    type="password"
                                    value={newUser.password}
                                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                    required
                                />
                                <input
                                    className="glass-input px-4 py-3 rounded-xl"
                                    placeholder="Department"
                                    value={newUser.department}
                                    onChange={e => setNewUser({ ...newUser, department: e.target.value })}
                                />
                                <select
                                    className="glass-input px-4 py-3 rounded-xl md:col-span-2 text-gray-300"
                                    value={newUser.user_category}
                                    onChange={e => setNewUser({ ...newUser, user_category: e.target.value })}
                                >
                                    <option value="employee" className="bg-gray-900">Employee</option>
                                    <option value="contractor" className="bg-gray-900">Contractor</option>
                                    <option value="guest" className="bg-gray-900">Guest</option>
                                </select>
                                <button type="submit" className="md:col-span-2 btn-primary py-3 rounded-xl font-semibold shadow-lg hover:shadow-premium-gold/20 transition-all">
                                    Create User Account
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
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {users.map((u, i) => (
                                            <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                                                <td className="py-3 pl-2 font-medium text-gray-200 group-hover:text-white">{u.name || u.username}</td>
                                                <td className="py-3 text-gray-400">{u.email}</td>
                                                <td className="py-3">
                                                    <span className="px-2 py-0.5 rounded text-xs bg-white/5 text-gray-300 border border-white/10 capitalize">
                                                        {u.role}
                                                    </span>
                                                </td>
                                                <td className="py-3">
                                                    {u.is_active ?
                                                        <span className="text-green-400 flex items-center gap-1 text-xs"><CheckCircle2 className="w-3 h-3" /> Active</span> :
                                                        <span className="text-red-400 flex items-center gap-1 text-xs"><XCircle className="w-3 h-3" /> Inactive</span>
                                                    }
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>

                    {/* Right Col: Activity Log */}
                    <div className="space-y-6 animate-fade-in" style={{ animationDelay: '300ms' }}>
                        <div className="glass-panel p-6 rounded-2xl h-full">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <Database className="w-5 h-5 text-gray-400" />
                                Data Ingestion Log
                            </h3>
                            <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                                {uploads.map((up, i) => (
                                    <div key={i} className="p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                        <div className="flex items-start justify-between mb-1">
                                            <span className="text-gray-200 font-medium text-sm truncate max-w-[150px]">{up.filename}</span>
                                            <span className="text-xs text-gray-500">{new Date(up.uploaded_at).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-400">
                                            <FileText className="w-3 h-3" />
                                            {up.document_count} chunks processed
                                        </div>
                                    </div>
                                ))}
                                {uploads.length === 0 && (
                                    <div className="text-center py-8 text-gray-500 text-sm">
                                        No recent uploads found.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, label, value, subtext, color, bg }) {
    return (
        <div className="glass-panel p-6 rounded-2xl hover:scale-[1.02] transition-transform duration-300">
            <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl ${bg}`}>
                    <Icon className={`w-6 h-6 ${color}`} />
                </div>
                {/* <div className="text-xs font-mono text-gray-500 bg-black/20 px-2 py-1 rounded">Global</div> */}
            </div>
            <div className="text-3xl font-bold text-white mb-1">{value.toLocaleString()}</div>
            <div className="text-sm text-gray-400 font-medium mb-1">{label}</div>
            <div className="text-xs text-gray-500">{subtext}</div>
        </div>
    );
}

function HealthIndicator({ name, status }) {
    return (
        <div className="bg-black/20 rounded-xl p-3 flex items-center justify-between border border-white/5">
            <span className="text-sm text-gray-300 font-medium">{name}</span>
            <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${status ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className={`text-xs font-bold ${status ? 'text-green-500' : 'text-red-500'}`}>
                    {status ? 'OK' : 'DOWN'}
                </span>
            </div>
        </div>
    );
}
