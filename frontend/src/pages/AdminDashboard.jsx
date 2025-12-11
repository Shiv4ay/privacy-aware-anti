import React, { useState, useEffect } from 'react';
import client from '../api/index';
import { useAuth } from '../contexts/AuthContext';
import { Users, UserPlus, Database, Globe, Activity, Search, RefreshCw, LogOut, FileText, Building2, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
    const { user, logout } = useAuth();
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState(null);
    const [uploads, setUploads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '', department: '', user_category: 'employee' });

    useEffect(() => {
        fetchUsers();
        fetchStats();
        fetchUploads();

        // Auto-refresh stats every 30 seconds
        const interval = setInterval(() => {
            fetchStats();
            fetchUploads();
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await client.get('/admin/users');
            if (res.data.success) {
                setUsers(res.data.users);
            }
        } catch (err) {
            toast.error('Failed to fetch users');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await client.get('/admin/stats');
            if (res.data.success) {
                setStats(res.data.stats);
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    };

    const fetchUploads = async () => {
        try {
            const res = await client.get('/admin/uploads');
            if (res.data.success) {
                setUploads(res.data.uploads);
            }
        } catch (err) {
            console.error('Failed to fetch uploads:', err);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            const res = await client.post('/admin/users/create', newUser);
            if (res.data.success) {
                toast.success('User created successfully');
                setNewUser({ name: '', email: '', password: '', department: '', user_category: 'employee' });
                fetchUsers();
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create user');
        }
    };

    const triggerIngestion = async (type, url = null) => {
        try {
            let res;
            if (type === 'web') {
                res = await client.post('/ingest/web', { url });
            } else {
                const dummyType = type.replace('dummy_', '');
                res = await client.post(`/ingest/dummy/${dummyType}`);
            }

            if (res.data.success) {
                toast.success(res.data.message);
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || 'Ingestion trigger failed');
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-premium-black">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-premium-gold"></div>
        </div>
    );

    return (
        <div className="space-y-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-1">Admin Dashboard</h1>
                        <p className="text-gray-400">Manage organization: <span className="text-premium-gold font-semibold">{stats?.organizationName || user?.organization}</span></p>
                    </div>
                </div>

                {/* Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <MetricCard
                        icon={FileText}
                        title="Total Documents"
                        value={stats?.totalDocuments?.toLocaleString() || '0'}
                        subtitle={stats?.recentUploads ? `+${stats.recentUploads} new today` : 'No recent uploads'}
                        iconColor="text-purple-400"
                        bgColor="bg-purple-500/10"
                    />
                    <MetricCard
                        icon={Database}
                        title="Data Sources"
                        value={stats?.dataSourcesCount || '0'}
                        subtitle={`${stats?.dataSources?.length || 0} files uploaded`}
                        iconColor="text-blue-400"
                        bgColor="bg-blue-500/10"
                    />
                    <MetricCard
                        icon={Users}
                        title="Organization Users"
                        value={stats?.totalUsers || '0'}
                        subtitle="Active members"
                        iconColor="text-green-400"
                        bgColor="bg-green-500/10"
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: User Management */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Create User */}
                        <div className="glass-panel p-6 rounded-2xl">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-premium-gold/10 rounded-lg">
                                    <UserPlus className="w-6 h-6 text-premium-gold" />
                                </div>
                                <h2 className="text-xl font-semibold text-white">Add New User</h2>
                            </div>

                            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input
                                    type="text"
                                    placeholder="Full Name"
                                    value={newUser.name}
                                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                                    className="glass-input px-4 py-2 rounded-lg"
                                    required
                                />
                                <input
                                    type="email"
                                    placeholder="Email Address"
                                    value={newUser.email}
                                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                    className="glass-input px-4 py-2 rounded-lg"
                                    required
                                />
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                    className="glass-input px-4 py-2 rounded-lg"
                                    required
                                />
                                <input
                                    type="text"
                                    placeholder="Department"
                                    value={newUser.department}
                                    onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                                    className="glass-input px-4 py-2 rounded-lg"
                                />
                                <select
                                    value={newUser.user_category}
                                    onChange={(e) => setNewUser({ ...newUser, user_category: e.target.value })}
                                    className="glass-input px-4 py-2 rounded-lg appearance-none md:col-span-2"
                                >
                                    <option value="employee" className="text-black">Employee</option>
                                    <option value="contractor" className="text-black">Contractor</option>
                                    <option value="guest" className="text-black">Guest</option>
                                </select>
                                <button type="submit" className="md:col-span-2 btn-primary py-2 rounded-lg">
                                    Create User
                                </button>
                            </form>
                        </div>

                        {/* User List */}
                        <div className="glass-panel p-6 rounded-2xl">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                    <Users className="w-6 h-6 text-blue-400" />
                                </div>
                                <h2 className="text-xl font-semibold text-white">Organization Users</h2>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-gray-800 text-gray-400 text-sm">
                                            <th className="p-3">Name</th>
                                            <th className="p-3">Email</th>
                                            <th className="p-3">Role</th>
                                            <th className="p-3">Dept</th>
                                            <th className="p-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-gray-300">
                                        {users.map((u) => (
                                            <tr key={u.id} className="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                                                <td className="p-3 font-medium text-white">{u.name}</td>
                                                <td className="p-3 text-sm text-gray-400">{u.email}</td>
                                                <td className="p-3 capitalize text-sm">{u.role}</td>
                                                <td className="p-3 text-sm">{u.department || '-'}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-1 rounded-full text-xs ${u.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                        {u.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Ingestion & Logs */}
                    <div className="space-y-8">
                        {/* Ingestion Controls */}
                        <div className="glass-panel p-6 rounded-2xl">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-purple-500/10 rounded-lg">
                                    <Database className="w-6 h-6 text-purple-400" />
                                </div>
                                <h2 className="text-xl font-semibold text-white">Data Ingestion</h2>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-400 mb-3">Data Sources Status</h3>
                                    <div className="space-y-2">
                                        {stats?.dataSources?.map((source, idx) => (
                                            <div key={idx} className="bg-white/5 p-3 rounded-lg border border-green-500/20">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                                        <span className="text-sm font-medium text-white">{source.filename}</span>
                                                    </div>
                                                    <span className="text-xs text-gray-400">{parseInt(source.count).toLocaleString()} docs</span>
                                                </div>
                                            </div>
                                        ))}
                                        {(!stats?.dataSources || stats.dataSources.length === 0) && (
                                            <div className="text-center text-gray-500 py-4 text-sm">
                                                No data sources uploaded yet
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-sm font-medium text-gray-400 mb-3">Upload New Data</h3>
                                    <div className="text-center py-4 bg-white/5 rounded-lg border border-dashed border-gray-700">
                                        <Database className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                                        <p className="text-xs text-gray-500">Use Documents page to upload</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Uploads Activity */}
                        <ActivityLogs uploads={uploads} />
                    </div>
                </div>
            </div>
        </div>
    );
}

// Metric Card Component
function MetricCard({ icon: Icon, title, value, subtitle, iconColor, bgColor }) {
    return (
        <div className="glass-panel p-6 rounded-2xl">
            <div className="flex items-center gap-4">
                <div className={`p-3 ${bgColor} rounded-xl`}>
                    <Icon className={`w-6 h-6 ${iconColor}`} />
                </div>
                <div className="flex-1">
                    <p className="text-sm text-gray-400 mb-1">{title}</p>
                    <p className="text-2xl font-bold text-white">{value}</p>
                    <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
                </div>
            </div>
        </div>
    );
}

// Activity Logs Component
function ActivityLogs({ uploads }) {
    const formatTimeAgo = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);

        if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="glass-panel p-6 rounded-2xl h-[400px] flex flex-col">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-500/10 rounded-lg">
                    <Activity className="w-6 h-6 text-green-400" />
                </div>
                <h2 className="text-xl font-semibold text-white">Activity Logs</h2>
            </div>

            <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar">
                <div className="space-y-3">
                    {uploads.map((upload, idx) => (
                        <div key={idx} className="bg-white/5 p-3 rounded-lg border border-white/5 text-sm hover:bg-white/10 transition-colors">
                            <div className="flex items-start gap-2">
                                <div className="w-2 h-2 bg-green-400 rounded-full mt-1.5"></div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-medium text-white">{upload.filename}</span>
                                        <span className="text-xs text-gray-500">{formatTimeAgo(upload.uploaded_at)}</span>
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        {parseInt(upload.document_count).toLocaleString()} documents uploaded
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {uploads.length === 0 && (
                        <div className="text-center text-gray-500 py-8">
                            <Database className="w-12 h-12 text-gray-700 mx-auto mb-2" />
                            <p>No activity recorded</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
