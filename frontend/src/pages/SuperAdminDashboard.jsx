import React, { useState, useEffect } from 'react';
import client from '../api/index';
import { useAuth } from '../contexts/AuthContext';
import { Building, Plus, Trash2, Globe, Shield, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SuperAdminDashboard() {
    const { user, logout } = useAuth();
    const [orgs, setOrgs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newOrg, setNewOrg] = useState({ name: '', type: '', domain: '' });

    useEffect(() => {
        fetchOrgs();
    }, []);

    const fetchOrgs = async () => {
        try {
            const res = await client.get('/orgs');
            if (res.data.success) {
                setOrgs(res.data.organizations);
            }
        } catch (err) {
            toast.error('Failed to fetch organizations');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateOrg = async (e) => {
        e.preventDefault();
        try {
            const res = await client.post('/orgs/create', newOrg);
            if (res.data.success) {
                toast.success('Organization created successfully');
                setNewOrg({ name: '', type: '', domain: '' });
                fetchOrgs();
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create organization');
        }
    };

    const handleDeleteOrg = async (id) => {
        if (!window.confirm('Are you sure? This action cannot be undone.')) return;
        try {
            await client.post(`/orgs/delete/${id}`);
            toast.success('Organization deleted');
            fetchOrgs();
        } catch (err) {
            toast.error('Failed to delete organization');
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
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-white mb-1">Super Admin Dashboard</h1>
                    <p className="text-gray-400">System-wide control center</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Create Org Form */}
                    <div className="glass-panel p-6 rounded-2xl h-fit">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-premium-gold/10 rounded-lg">
                                <Plus className="w-6 h-6 text-premium-gold" />
                            </div>
                            <h2 className="text-xl font-semibold text-white">New Organization</h2>
                        </div>

                        <form onSubmit={handleCreateOrg} className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-400 ml-1 mb-1 block">Name</label>
                                <div className="relative">
                                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input
                                        type="text"
                                        placeholder="Acme Corp"
                                        value={newOrg.name}
                                        onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
                                        className="glass-input w-full pl-10 pr-4 py-2 rounded-lg"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-400 ml-1 mb-1 block">Type</label>
                                <div className="relative">
                                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input
                                        type="text"
                                        placeholder="University, Hospital..."
                                        value={newOrg.type}
                                        onChange={(e) => setNewOrg({ ...newOrg, type: e.target.value })}
                                        className="glass-input w-full pl-10 pr-4 py-2 rounded-lg"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-400 ml-1 mb-1 block">Domain</label>
                                <div className="relative">
                                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input
                                        type="text"
                                        placeholder="acme.com"
                                        value={newOrg.domain}
                                        onChange={(e) => setNewOrg({ ...newOrg, domain: e.target.value })}
                                        className="glass-input w-full pl-10 pr-4 py-2 rounded-lg"
                                    />
                                </div>
                            </div>
                            <button type="submit" className="w-full btn-primary py-2 rounded-lg mt-2">
                                Create Organization
                            </button>
                        </form>
                    </div>

                    {/* Org List */}
                    <div className="lg:col-span-2 glass-panel p-6 rounded-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                                <Building className="w-6 h-6 text-blue-400" />
                            </div>
                            <h2 className="text-xl font-semibold text-white">Organizations</h2>
                        </div>

                        <div className="overflow-x-auto mb-8">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gray-800 text-gray-400 text-sm">
                                        <th className="p-3">ID</th>
                                        <th className="p-3">Name</th>
                                        <th className="p-3">Type</th>
                                        <th className="p-3">Domain</th>
                                        <th className="p-3">Created</th>
                                        <th className="p-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="text-gray-300">
                                    {orgs.map((org) => (
                                        <tr key={org.id} className="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                                            <td className="p-3 text-gray-500 text-sm">#{org.id}</td>
                                            <td className="p-3 font-medium text-white">{org.name}</td>
                                            <td className="p-3 text-sm text-gray-400">{org.type || '-'}</td>
                                            <td className="p-3 text-sm text-gray-400">{org.domain || '-'}</td>
                                            <td className="p-3 text-sm text-gray-500">{new Date(org.created_at).toLocaleDateString()}</td>
                                            <td className="p-3 text-right">
                                                <button
                                                    onClick={() => handleDeleteOrg(org.id)}
                                                    className="p-2 hover:bg-red-500/10 rounded-lg group transition-colors"
                                                    title="Delete Organization"
                                                >
                                                    <Trash2 className="w-4 h-4 text-gray-500 group-hover:text-red-500 transition-colors" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {orgs.length === 0 && (
                                        <tr>
                                            <td colSpan="6" className="p-8 text-center text-gray-500">
                                                No organizations found. Create one to get started.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Manage Org Admins Placeholder */}
                        <div className="border-t border-white/5 pt-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-white">Manage Organization Admins</h3>
                                <button className="btn-secondary px-3 py-1.5 rounded-lg text-sm">View All Admins</button>
                            </div>
                            <p className="text-gray-400 text-sm">
                                Admin management interface coming soon. Use the database directly for now.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
