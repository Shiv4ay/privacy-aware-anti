import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Database, BarChart, Play, Loader2, CheckCircle, AlertCircle, Cpu, Zap, RefreshCw } from 'lucide-react';
import client from '../api/index';

export default function DataDashboard() {
    const { token } = useAuth();
    const [stats, setStats] = useState({
        total_documents: 0,
        processed: 0,
        pending: 0,
        total_storage: 0
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(null);

    const fetchStats = async () => {
        try {
            // Use the configured client instead of raw axios to hit the correct endpoint
            const res = await client.get('/documents/stats');
            if (res.data.success) {
                // Documents.jsx expects res.data.overallStats, but maybe documents.js returns res.data
                // Let's handle both in case client routes differently
                const data = res.data.overallStats || res.data;
                setStats({
                    total_documents: parseInt(data.total_documents || 0),
                    processed: parseInt(data.processed || 0),
                    pending: parseInt(data.pending || 0),
                    total_storage: parseInt(data.total_storage || 0)
                });
            }
        } catch (err) {
            console.error('Failed to fetch doc stats:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 5000); // Poll every 5s for progress
        return () => clearInterval(interval);
    }, [token]);

    const handleProcessAll = async (force = false) => {
        setIsProcessing(true);
        setMessage(null);
        try {
            const res = await client.post('/documents/process-all', { force });
            if (res.data.success) {
                setMessage({
                    type: 'success',
                    text: force
                        ? 'Force reprocessing triggered! All documents will be re-extracted and re-indexed.'
                        : 'Background processing triggered successfully!'
                });
                // Refresh stats after a short delay to show new pending count
                setTimeout(fetchStats, 2000);
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to trigger processing: ' + (err.response?.data?.error || err.message) });
        } finally {
            setIsProcessing(false);
        }
    };

    const progress = stats.total_documents > 0
        ? Math.round((stats.processed / stats.total_documents) * 100)
        : 0;

    return (
        <>
            <div className="space-y-8 relative z-10 w-full overflow-hidden p-6 mx-auto bg-black min-h-screen">
                <div className="max-w-7xl mx-auto space-y-8">
                    <div className="flex justify-between items-end mb-6">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-1">Data Steward Dashboard</h1>
                            <p className="text-gray-400">Data Governance and Processing Control Center</p>
                        </div>
                        <div className="bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-full flex items-center gap-2">
                            <Zap className="w-4 h-4 text-blue-400" />
                            <span className="text-blue-400 text-sm font-medium">Real-time Sync Active</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-gray-900/50">
                                <p className="text-gray-400 text-sm mb-1 uppercase tracking-wider">Total Documents</p>
                                <h3 className="text-3xl font-bold text-white">{stats.total_documents.toLocaleString()}</h3>
                                <div className="mt-4 flex items-center gap-2 text-xs text-blue-400">
                                    <Database className="w-3 h-3" />
                                    <span>Primary Knowledge Base</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div className="glass-panel p-6 rounded-2xl border border-white/5 text-emerald-400 bg-gray-900/50">
                                <p className="text-gray-400 text-sm mb-1 uppercase tracking-wider">Processed & Indexed</p>
                                <h3 className="text-3xl font-bold">{stats.processed.toLocaleString()}</h3>
                                <div className="mt-4 flex items-center gap-2 text-xs">
                                    <CheckCircle className="w-3 h-3" />
                                    <span>Ready for AI Retrieval</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div className="glass-panel p-6 rounded-2xl border border-white/5 text-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.1)] bg-gray-900/50">
                                <p className="text-gray-400 text-sm mb-1 uppercase tracking-wider">Pending Processing</p>
                                <h3 className="text-3xl font-bold">{stats.pending.toLocaleString()}</h3>
                                <div className="mt-4 flex items-center gap-2 text-xs">
                                    <Loader2 className="w-3 h-3" />
                                    <span>Waiting for Embedding Engine</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="glass-panel p-8 rounded-2xl border border-white/5 bg-gray-900/50">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                                        <Cpu className="w-8 h-8 text-purple-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white">Knowledge Extraction Engine</h2>
                                        <p className="text-gray-400 text-sm">Automated Chunking & Deep Indexing Layer: nomic-embed-text</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleProcessAll(false)}
                                        disabled={isProcessing || stats.pending === 0}
                                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${isProcessing || stats.pending === 0
                                            ? 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed'
                                            : 'bg-blue-600 text-white shadow-lg border border-blue-400/30'
                                            }`}
                                    >
                                        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                                        {stats.pending === 0 ? 'All Processed' : 'Process Pending'}
                                    </button>
                                    <button
                                        onClick={() => handleProcessAll(true)}
                                        disabled={isProcessing || stats.processed === 0}
                                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${isProcessing || stats.processed === 0
                                            ? 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed'
                                            : 'bg-amber-600 text-white shadow-lg border border-amber-400/30'
                                            }`}
                                        title="Re-extract and re-index all documents with deep content extraction"
                                    >
                                        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                                        Force Reprocess All
                                    </button>
                                </div>
                            </div>

                            {message && (
                                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 border ${message.type === 'success'
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                    }`}>
                                    {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                    <span className="text-sm font-medium">{message.text}</span>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="flex justify-between text-sm font-medium">
                                    <span className="text-gray-300">Overall Indexing Progress</span>
                                    <span className="text-blue-400">{progress}%</span>
                                </div>
                                <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden border border-white/5">
                                    <div
                                        className="h-full bg-blue-500 transition-all duration-1000 ease-out"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-[10px] text-gray-500 uppercase tracking-tighter pt-2">
                                    <span>0 - System Idle</span>
                                    <span>50 - Processing In-Flight</span>
                                    <span>100 - Database Optimized</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
