import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import client from '../api/index';
import { UploadCloud, Search, MessageSquare, FileText, Activity, Shield, LogOut, User } from 'lucide-react';

export default function Dashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const [stats, setStats] = useState({ documents: 0, searches: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const docsRes = await client.get('/documents').catch(() => null);
        if (docsRes?.data) {
          setStats(prev => ({
            ...prev,
            documents: Array.isArray(docsRes.data) ? docsRes.data.length : 0
          }));
        }
      } catch (err) {
        console.error('Failed to load stats', err);
      } finally {
        setLoading(false);
      }
    }
    if (!authLoading) {
      loadStats();
    }
  }, [authLoading]);

  if (authLoading) return (
    <div className="flex items-center justify-center min-h-screen bg-premium-black">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-premium-gold"></div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header - Removed as it's now in Navbar/Sidebar */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Welcome back, {user?.name || 'User'}</h1>
          <p className="text-gray-400 text-sm">
            {user?.organization} • {user?.role}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link to="/documents/upload" className="glass-panel p-6 rounded-2xl hover:bg-white/5 transition-all group border border-white/5 hover:border-premium-gold/30">
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <UploadCloud className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">Upload Document</h3>
            <p className="text-sm text-gray-400">Securely upload and process new files</p>
          </Link>

          <Link to="/search" className="glass-panel p-6 rounded-2xl hover:bg-white/5 transition-all group border border-white/5 hover:border-premium-gold/30">
            <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Search className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">Semantic Search</h3>
            <p className="text-sm text-gray-400">Find information across all documents</p>
          </Link>

          <Link to="/chat" className="glass-panel p-6 rounded-2xl hover:bg-white/5 transition-all group border border-white/5 hover:border-premium-gold/30">
            <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <MessageSquare className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">AI Chat Assistant</h3>
            <p className="text-sm text-gray-400">Ask questions and get instant answers</p>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Stats */}
          <div className="lg:col-span-2 glass-panel p-6 rounded-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-premium-gold/10 rounded-lg">
                <Activity className="w-6 h-6 text-premium-gold" />
              </div>
              <h2 className="text-xl font-semibold text-white">Overview</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <div className="text-3xl font-bold text-white mb-1">{stats.documents}</div>
                <div className="text-sm text-gray-400 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Total Documents
                </div>
              </div>
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <div className="text-3xl font-bold text-white mb-1">{stats.searches}</div>
                <div className="text-sm text-gray-400 flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Total Searches
                </div>
              </div>
            </div>
          </div>

          {/* Security Info */}
          <div className="glass-panel p-6 rounded-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Shield className="w-6 h-6 text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Security Status</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                <div className="w-2 h-2 mt-2 rounded-full bg-green-500 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-white">PII Redaction Active</div>
                  <div className="text-xs text-gray-500">Sensitive data is automatically masked</div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                <div className="w-2 h-2 mt-2 rounded-full bg-green-500 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-white">RBAC Enforced</div>
                  <div className="text-xs text-gray-500">Access limited by role & organization</div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                <div className="w-2 h-2 mt-2 rounded-full bg-green-500 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-white">Audit Logging On</div>
                  <div className="text-xs text-gray-500">All activities are securely recorded</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
