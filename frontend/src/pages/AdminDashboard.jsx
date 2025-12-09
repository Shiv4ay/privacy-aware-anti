import React, { useState, useEffect } from 'react';
import client from '../api/index';
import { useAuth } from '../contexts/AuthContext';
import { Users, UserPlus, Database, Globe, Activity, Search, RefreshCw, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
    const { user, logout } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '', department: '', user_category: 'employee' });

    useEffect(() => {
        fetchUsers();
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
                {/* Header - Removed as it's now in Navbar/Sidebar */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-1">Admin Dashboard</h1>
                        <p className="text-gray-400">Manage organization: <span className="text-premium-gold font-semibold">{user?.organization}</span></p>
                    </div>
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

                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-400 mb-3">Dummy Data Sources</h3>
                                    <div className="grid grid-cols-1 gap-2">
                                        <button onClick={() => triggerIngestion('dummy_university')} className="btn-secondary py-2 rounded-lg text-sm">
                                            Ingest University Data
                                        </button>
                                        <button onClick={() => triggerIngestion('dummy_hospital')} className="btn-secondary py-2 rounded-lg text-sm">
                                            Ingest Hospital Data
                                        </button>
                                        <button onClick={() => triggerIngestion('dummy_finance')} className="btn-secondary py-2 rounded-lg text-sm">
                                            Ingest Finance Data
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-sm font-medium text-gray-400 mb-3">Public Web Source</h3>
                                    <div className="flex gap-2">
                                        <input
                                            type="url"
                                            placeholder="https://example.com"
                                            className="glass-input flex-1 px-3 py-2 rounded-lg text-sm"
                                            id="web-ingest-url"
                                        />
                                        <button
                                            onClick={() => {
                                                const url = document.getElementById('web-ingest-url').value;
                                                if (url) triggerIngestion('web', url);
                                            }}
                                            className="btn-primary px-3 py-2 rounded-lg"
                                        >
                                            <Globe className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Ingestion Logs */}
                        <IngestionLogs />
                    </div>
                </div>
            </div>
        </div>
    );
}

function IngestionLogs() {
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchLogs = async () => {
        try {
            const res = await client.get('/ingest/logs');
            if (res.data.success) {
                setLogs(res.data.logs);
            }
        } catch (err) {
            console.error("Failed to fetch logs", err);
        }
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
                    {logs.map((log) => (
                        <div key={log.id} className="bg-white/5 p-3 rounded-lg border border-white/5 text-sm">
                            <div className="flex justify-between items-start mb-1">
                                <span className="font-medium text-premium-gold">{log.type}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${log.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                    log.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                        'bg-yellow-500/20 text-yellow-400'
                                    }`}>
                                    {log.status}
                                </span>
                            </div>
                            <div className="text-gray-400 text-xs mb-1 truncate">{log.url || 'Internal Source'}</div>
                            <div className="text-gray-500 text-[10px] flex justify-between">
                                <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                                <span>{log.details?.chunks ? `${log.details.chunks} chunks` : ''}</span>
                            </div>
                        </div>
                    ))}
                    {logs.length === 0 && (
                        <div className="text-center text-gray-500 py-4">No activity recorded</div>
                    )}
                </div>
            </div>
        </div>
    );
}
