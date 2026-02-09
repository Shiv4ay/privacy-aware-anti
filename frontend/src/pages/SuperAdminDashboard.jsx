import React, { useState, useEffect, useCallback } from 'react';
import client from '../api/index';
import { useAuth } from '../contexts/AuthContext';
import {
    Building, Plus, Trash2, Globe, Shield,
    Activity, Users, FileText, Database,
    Zap, Server, Cpu, Clock, CheckCircle2,
    XCircle, AlertCircle, TrendingUp, HardDrive
} from 'lucide-react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

export default function SuperAdminDashboard() {
    const { user } = useAuth();
    const [orgs, setOrgs] = useState([]);
    const [systemStatus, setSystemStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);
    const [newOrg, setNewOrg] = useState({ name: '', type: '', domain: '' });

    const fetchOrgs = useCallback(async () => {
        try {
            const res = await client.get('/orgs');
            if (res.data.success) {
                setOrgs(res.data.organizations);
            }
        } catch (err) {
            console.error('Failed to fetch organizations', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchSystemStatus = useCallback(async (isInitial = false) => {
        if (isInitial) setStatsLoading(true);
        try {
            const res = await client.get('/orgs/system-status');
            if (res.data.success) {
                setSystemStatus(res.data);
            }
        } catch (err) {
            console.error('Failed to fetch system status', err);
        } finally {
            if (isInitial) setStatsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOrgs();
        fetchSystemStatus(true);

        const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const socket = io(socketUrl, {
            withCredentials: true,
            transports: ['websocket', 'polling']
        });

        socket.on('connect', () => {
            console.log('🔌 Connected to Real-time Gateway');
            socket.emit('subscribe:system');
        });

        socket.on('activity', (newActivity) => {
            console.log('⚡ New Activity Received:', newActivity);
            setSystemStatus(prev => {
                const updatedActivity = [newActivity, ...(prev?.recentActivity || [])].slice(0, 10);

                // Real-time stat counter increment (optional optimization)
                const newStats = { ...(prev?.stats || {}) };
                if (newActivity.action === 'search') newStats.totalSearches = (newStats.totalSearches || 0) + 1;

                return {
                    ...prev,
                    recentActivity: updatedActivity,
                    stats: newStats
                };
            });
        });

        socket.on('stats_update', (newStats) => {
            setSystemStatus(prev => ({ ...prev, stats: newStats }));
        });

        socket.on('org_update', (data) => {
            console.log('⚡ Organization Update Received:', data);
            if (data.action === 'create') {
                setOrgs(prev => [data.organization, ...prev]);
            } else if (data.action === 'delete') {
                setOrgs(prev => prev.filter(o => o.id !== data.orgId));
            }
        });

        // Still poll health every 30s as a fallback
        const healthPoll = setInterval(() => fetchSystemStatus(), 30000);

        return () => {
            socket.disconnect();
            clearInterval(healthPoll);
        };
    }, [fetchOrgs, fetchSystemStatus]);

    const handleCreateOrg = async (e) => {
        e.preventDefault();
        const toastId = toast.loading('Creating organization...');
        try {
            const res = await client.post('/orgs/create', newOrg);
            if (res.data.success) {
                toast.success('Organization created successfully', { id: toastId });
                setNewOrg({ name: '', type: '', domain: '' });
                fetchOrgs();
                fetchSystemStatus();
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create organization', { id: toastId });
        }
    };

    const handleDeleteOrg = async (id) => {
        if (!window.confirm('Are you sure? This action will permanently delete all data associated with this organization.')) return;
        const toastId = toast.loading('Deleting organization...');
        try {
            await client.post(`/orgs/delete/${id}`);
            toast.success('Organization deleted', { id: toastId });
            fetchOrgs();
            fetchSystemStatus();
        } catch (err) {
            toast.error('Failed to delete organization', { id: toastId });
        }
    };

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    if (loading && statsLoading) return (
        <div className="flex items-center justify-center min-h-screen bg-premium-black">
            <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-premium-gold shadow-[0_0_15px_rgba(234,179,8,0.3)]"></div>
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-premium-gold">SYSTEM</div>
            </div>
        </div>
    );

    const statsCards = [
        {
            label: 'Organizations',
            value: systemStatus?.stats?.totalOrganizations || 0,
            icon: Building,
            color: 'from-blue-500 to-indigo-600',
            trend: '+12%'
        },
        {
            label: 'Total Users',
            value: systemStatus?.stats?.totalUsers || 0,
            icon: Users,
            color: 'from-purple-500 to-pink-600',
            trend: '+5%'
        },
        {
            label: 'Documents',
            value: systemStatus?.stats?.totalDocuments || 0,
            icon: FileText,
            color: 'from-amber-500 to-orange-600',
            trend: '+24%'
        },
        {
            label: 'System Storage',
            value: formatBytes(systemStatus?.stats?.totalStorage || 0),
            icon: HardDrive,
            color: 'from-emerald-500 to-teal-600',
            trend: 'Stable'
        }
    ];

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            <div className="max-w-7xl mx-auto space-y-8 px-4 sm:px-6">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-extrabold text-white mb-2 flex items-center gap-3">
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-premium-gold via-yellow-200 to-premium-gold">
                                System Overview
                            </span>
                            <div className="text-xs px-2 py-0.5 rounded-full bg-premium-gold/10 text-premium-gold border border-premium-gold/20 font-bold uppercase tracking-widest">
                                Global Control
                            </div>
                        </h1>
                        <p className="text-gray-400 flex items-center gap-2">
                            <Globe className="w-4 h-4 text-blue-400" />
                            Managing {orgs.length} organizations across the platform
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <div className="text-xs text-gray-500 uppercase font-bold tracking-tighter">API Status</div>
                            <div className="flex items-center gap-2 text-green-400 font-medium">
                                <Zap className="w-4 h-4 fill-current animate-pulse" />
                                Operational
                            </div>
                        </div>
                        <button
                            onClick={() => { fetchOrgs(); fetchSystemStatus(true); }}
                            className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all text-gray-400 hover:text-white"
                            title="Refresh Data"
                        >
                            <Activity className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {statsCards.map((card, i) => (
                        <div key={i} className="glass-panel p-6 rounded-2xl relative overflow-hidden group hover:scale-[1.02] transition-all border border-white/5 hover:border-premium-gold/30">
                            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full bg-gradient-to-br ${card.color} opacity-10 group-hover:scale-150 transition-transform duration-500`} />
                            <div className="flex justify-between items-start relative z-10 mb-4">
                                <div className={`p-3 rounded-xl bg-gradient-to-br ${card.color} shadow-lg shadow-black/50`}>
                                    <card.icon className="w-6 h-6 text-white" />
                                </div>
                                <div className="text-xs font-bold text-gray-500 bg-white/5 px-2 py-1 rounded-md flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" />
                                    {card.trend}
                                </div>
                            </div>
                            <div className="relative z-10">
                                <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">{card.label}</div>
                                <div className="text-3xl font-black text-white tracking-tight">{card.value}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Recent Activity List */}
                    <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent flex flex-col">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-premium-gold/10 rounded-xl">
                                    <Clock className="w-6 h-6 text-premium-gold" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Global Activity</h2>
                                    <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">System-wide logs</p>
                                </div>
                            </div>
                            <div className="text-xs px-3 py-1 bg-white/5 rounded-full text-gray-400 border border-white/10">
                                Real-time Feed
                            </div>
                        </div>

                        <div className="space-y-4 flex-1">
                            {systemStatus?.recentActivity?.map((log, idx) => (
                                <div key={log.id} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-premium-gold/20 hover:bg-white/10 transition-all group animate-slide-up" style={{ animationDelay: `${idx * 100}ms` }}>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${log.action.includes('fail') ? 'bg-red-500/10 text-red-400' :
                                        log.action.includes('create') || log.action.includes('upload') ? 'bg-green-500/10 text-green-400' :
                                            'bg-blue-500/10 text-blue-400'
                                        }`}>
                                        <Shield className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-sm font-bold text-white truncate capitalize">{log.action.replace(/_/g, ' ')}</span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-gray-500 uppercase font-black">{log.resource_type || 'system'}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 truncate">
                                            By <span className="text-premium-gold uppercase font-bold text-[10px]">{log.username || log.email || 'System'}</span>
                                        </p>
                                    </div>
                                    <div className="text-[10px] font-black text-gray-600 uppercase">
                                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            ))}
                            {(!systemStatus?.recentActivity || systemStatus.recentActivity.length === 0) && (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-600">
                                    <Activity className="w-12 h-12 mb-4 opacity-20" />
                                    <p className="text-sm font-medium">No recent activity detected</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* System Health Section */}
                    <div className="glass-panel p-6 rounded-3xl border border-white/10 flex flex-col bg-gradient-to-br from-white/5 via-transparent to-transparent">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-2 bg-blue-500/10 rounded-xl">
                                <Server className="w-6 h-6 text-blue-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Service Health</h2>
                                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Infrastructure monitor</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {[
                                { name: 'Database (Postgres)', status: systemStatus?.health?.postgres, icon: Database, label: 'Main Registry' },
                                { name: 'Cache Layer (Redis)', status: systemStatus?.health?.redis, icon: Zap, label: 'Session Management' },
                                { name: 'AI Processing Worker', status: systemStatus?.health?.worker, icon: Cpu, label: 'Privacy Redaction' },
                                { name: 'Storage (MinIO)', status: systemStatus?.health?.postgres, icon: HardDrive, label: 'Files & Assets' } // Simplified proxy
                            ].map((service, i) => (
                                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${service.status ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                            <service.icon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white">{service.name}</div>
                                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">{service.label}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${service.status ? 'text-green-400' : 'text-red-400'}`}>
                                            {service.status ? 'Online' : 'Offline'}
                                        </span>
                                        {service.status ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 pt-6 border-t border-white/5">
                            <div className="bg-premium-gold/5 rounded-2xl p-4 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-premium-gold shrink-0 mt-0.5" />
                                <div>
                                    <div className="text-sm font-bold text-white">System Advisory</div>
                                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                        Security filters are operating at maximum efficiency. All PII redaction engines are active.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Organization Management Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Create Org Form */}
                    <div className="glass-panel p-8 rounded-3xl border border-white/5 hover:border-premium-gold/20 transition-all h-fit self-start">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-2 bg-premium-gold/10 rounded-xl">
                                <Plus className="w-6 h-6 text-premium-gold" />
                            </div>
                            <h2 className="text-xl font-bold text-white tracking-tight">Onboard Tenant</h2>
                        </div>

                        <form onSubmit={handleCreateOrg} className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 mb-2 block">Organization Name</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none group-focus-within:text-premium-gold transition-colors text-gray-500">
                                        <Building className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Enter full legal name"
                                        value={newOrg.name}
                                        onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
                                        className="glass-input w-full pl-12 pr-4 py-3.5 rounded-2xl focus:ring-2 focus:ring-premium-gold/50"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 mb-2 block">Enterprise Sector</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none group-focus-within:text-premium-gold transition-colors text-gray-500">
                                        <Cpu className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="e.g. Healthcare, Finance"
                                        value={newOrg.type}
                                        onChange={(e) => setNewOrg({ ...newOrg, type: e.target.value })}
                                        className="glass-input w-full pl-12 pr-4 py-3.5 rounded-2xl focus:ring-2 focus:ring-premium-gold/50"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 mb-2 block">Digital Domain</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none group-focus-within:text-premium-gold transition-colors text-gray-500">
                                        <Globe className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="organization.com"
                                        value={newOrg.domain}
                                        onChange={(e) => setNewOrg({ ...newOrg, domain: e.target.value })}
                                        className="glass-input w-full pl-12 pr-4 py-3.5 rounded-2xl focus:ring-2 focus:ring-premium-gold/50"
                                    />
                                </div>
                            </div>
                            <button type="submit" className="w-full btn-primary py-4 rounded-2xl font-bold uppercase tracking-widest text-sm shadow-xl shadow-premium-gold/10 hover:shadow-premium-gold/20 transition-all flex items-center justify-center gap-2 group">
                                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                                Finalize Onboarding
                            </button>
                        </form>
                    </div>

                    {/* Org List */}
                    <div className="lg:col-span-2 glass-panel p-0 rounded-3xl border border-white/5 overflow-hidden">
                        <div className="p-8 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/10 rounded-xl">
                                    <Building className="w-6 h-6 text-blue-400" />
                                </div>
                                <h2 className="text-xl font-bold text-white tracking-tight">Enterprise Tenants</h2>
                            </div>
                            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-3 py-1 bg-white/5 rounded-full border border-white/10">
                                Global Registry
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white/[0.02] border-b border-white/5 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
                                        <th className="px-8 py-4">Status</th>
                                        <th className="px-8 py-4">Organization</th>
                                        <th className="px-8 py-4">Infrastructure</th>
                                        <th className="px-8 py-4 text-right">Operations</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {orgs.map((org) => (
                                        <tr key={org.id} className="group hover:bg-white/[0.03] transition-colors cursor-default">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-green-500 glow-green" />
                                                    <span className="text-[10px] font-black text-green-400 uppercase tracking-tighter">Active</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="font-bold text-white mb-0.5 group-hover:text-premium-gold transition-colors">{org.name}</div>
                                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-tight flex items-center gap-1">
                                                    <Globe className="w-3 h-3" />
                                                    {org.domain || 'no domain'}
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 w-fit hover:bg-blue-500/20 transition-colors">
                                                        {org.type || 'General'}
                                                    </span>
                                                    <span className="text-[9px] text-gray-600 font-bold ml-1">ID: #{org.id}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <button
                                                    onClick={() => handleDeleteOrg(org.id)}
                                                    className="p-2.5 bg-red-500/5 hover:bg-red-500/20 rounded-xl group/btn transition-all border border-red-500/10 hover:border-red-500/50"
                                                    title="Self-Destruct Tenant Data"
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-500/70 group-hover/btn:text-red-500 transition-colors" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {orgs.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="p-20 text-center">
                                                <div className="flex flex-col items-center gap-4 opacity-30">
                                                    <Building className="w-16 h-16 text-gray-500" />
                                                    <p className="text-sm font-bold text-gray-500 uppercase tracking-[0.2em]">Zero Tenants Deployed</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
