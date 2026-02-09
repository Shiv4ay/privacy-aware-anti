import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import client from '../api/index';
import { UploadCloud, Search, MessageSquare, FileText, Activity, Shield, Eye, Lock, Zap } from 'lucide-react';

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({ documents: 0, searches: 0 });
  const [securityStats, setSecurityStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [docRes, secRes] = await Promise.all([
          client.get('/documents/stats').catch(() => ({ data: {} })),
          client.get('/audit/stats').catch(() => ({ data: {} }))
        ]);

        if (docRes?.data?.success) {
          setStats({
            documents: docRes.data.total_documents || 0,
            searches: secRes?.data?.stats?.totalQueries || 0
          });
        }

        if (secRes?.data?.stats) {
          setSecurityStats(secRes.data.stats);
        }
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      loadData();
      // Real-time polling every 30s
      const interval = setInterval(loadData, 30000);
      return () => clearInterval(interval);
    }
  }, [authLoading]);

  if (authLoading || loading) return (
    <div className="flex items-center justify-center min-h-screen bg-premium-black">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-premium-gold"></div>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Stylish Header */}
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-premium-gold via-yellow-200 to-premium-gold animate-gradient-x">
                Welcome Back, {user?.email ? user.email.split('@')[0] : (user?.username || 'User')}
              </span>
            </h1>
            <p className="text-gray-400 flex items-center gap-2">
              <span className="px-3 py-1 bg-white/5 rounded-full text-xs uppercase tracking-wider font-semibold text-premium-gold border border-premium-gold/20 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                {user?.role || 'Guest'}
              </span>
              <span className="text-gray-600">•</span>
              <span>{user?.role === 'super_admin' ? 'Global System' : (user?.organization || 'Personal Workspace')}</span>
            </p>
          </div>
          <div className="text-right hidden md:block">
            <div className="text-sm text-gray-400 mb-1">System Status</div>
            <div className="flex items-center gap-2 text-green-400 font-medium">
              <Zap className="w-4 h-4 fill-current" />
              All Systems Operational
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {((user?.role !== 'student' && user?.role !== 'guest') || user?.organization_type === 'Personal') && (
            <Link to="/documents/upload" className="glass-panel p-6 rounded-2xl hover:bg-white/5 transition-all group border border-white/5 hover:border-premium-gold/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <UploadCloud className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">Upload Document</h3>
                <p className="text-sm text-gray-400">Securely upload and process new files</p>
              </div>
            </Link>
          )}

          <Link to="/search" className="glass-panel p-6 rounded-2xl hover:bg-white/5 transition-all group border border-white/5 hover:border-premium-gold/30 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <Search className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">Semantic Search</h3>
              <p className="text-sm text-gray-400">Find information across all documents</p>
            </div>
          </Link>

          <Link to="/chat" className="glass-panel p-6 rounded-2xl hover:bg-white/5 transition-all group border border-white/5 hover:border-premium-gold/30 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <MessageSquare className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">AI Chat Assistant</h3>
              <p className="text-sm text-gray-400">Ask questions and get instant answers</p>
            </div>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Stats */}
          <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-white/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-premium-gold/10 rounded-lg">
                <Activity className="w-6 h-6 text-premium-gold" />
              </div>
              <h2 className="text-xl font-semibold text-white">Live Overview</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                <div className="text-3xl font-bold text-white mb-1">{stats.documents}</div>
                <div className="text-sm text-gray-400 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Total Documents
                </div>
              </div>
              <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                <div className="text-3xl font-bold text-white mb-1">{stats.searches}</div>
                <div className="text-sm text-gray-400 flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Total Searches
                </div>
              </div>
              {/* New Live Stats from Audit */}
              <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                <div className="text-3xl font-bold text-white mb-1">
                  {securityStats?.piiRedacted || 0}
                </div>
                <div className="text-sm text-gray-400 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-yellow-400" />
                  PII Elements Redacted
                </div>
              </div>
              <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                <div className="text-3xl font-bold text-white mb-1">
                  {securityStats?.blockedQueries || 0}
                </div>
                <div className="text-sm text-gray-400 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-red-400" />
                  Threats Blocked
                </div>
              </div>
            </div>
          </div>

          {/* Security Info */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Shield className="w-6 h-6 text-blue-400" />
                </div>
                <h2 className="text-xl font-semibold text-white">Security Status</h2>
              </div>
              {securityStats && (
                <div className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-bold border border-green-500/30">
                  {securityStats.privacyScore}% SCORE
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                <div className="w-2 h-2 mt-2.5 rounded-full bg-green-500 flex-shrink-0 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                <div>
                  <div className="text-sm font-medium text-white flex items-center gap-2">
                    PII Redaction Engine
                    <Eye className="w-3 h-3 text-gray-500" />
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Scanning for emails, phones, SSNs...
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                <div className="w-2 h-2 mt-2.5 rounded-full bg-blue-500 flex-shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                <div>
                  <div className="text-sm font-medium text-white flex items-center gap-2">
                    Envelope Encryption
                    <Lock className="w-3 h-3 text-gray-500" />
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Data encrypted at rest & in transit
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                <div className="w-2 h-2 mt-2.5 rounded-full bg-emerald-500 flex-shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                <div>
                  <div className="text-sm font-medium text-white flex items-center gap-2">
                    Real-Time Auditing
                    <Activity className="w-3 h-3 text-gray-500" />
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Logging all system interactions
                  </div>
                </div>
              </div>
            </div>

            <Link to="/security" className="block mt-6 text-center py-2 text-sm text-premium-gold hover:text-white transition-colors">
              View Request Logs →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
