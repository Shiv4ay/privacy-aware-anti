import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import client from '../api/index';
import { Search as SearchIcon, Sparkles, Loader2, FileText, ChevronRight, AlertTriangle, Shield, Eye, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

// Robust auth import handling to match other pages
let useAuth;
try {
  const mod = require('../contexts/AuthContext');
  useAuth = mod?.useAuth || (() => ({ user: null }));
} catch (e) {
  useAuth = () => ({ user: null });
}

export default function Search() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [privacyInfo, setPrivacyInfo] = useState(null);
  const [rbacWarning, setRbacWarning] = useState(null);
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const query = searchParams.get('q');
    if (query) {
      setQ(query);
      // We need a ref to the form submit or just call doSearch wrap
      triggerSearch(query);
    }
  }, [searchParams]);

  const triggerSearch = async (queryText) => {
    if (!queryText || queryText.trim().length === 0) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setPrivacyInfo(null);
    setRbacWarning(null);

    const detectedPII = detectPII(queryText);
    if (detectedPII.length > 0) {
      setPrivacyInfo({
        detected: detectedPII,
        message: `PII detected: ${detectedPII.join(', ')}. These will be redacted in audit logs.`
      });
    }

    try {
      const res = await client.post('/search', { query: queryText.trim() });

      if (res.data?.query_redacted && res.data.query_redacted !== (res.data.query || queryText)) {
        setPrivacyInfo(prev => ({
          ...prev,
          redacted: res.data.query_redacted,
          original: res.data.query || queryText
        }));
      }

      if (res.data?.decision === 'denied' || res.data?.blocked) {
        setRbacWarning({
          message: res.data.message || 'Access denied based on your role/permissions',
          policy: res.data.policy_id || null
        });
      }

      const searchResults = res.data?.results || res.data?.hits || [];
      setResults(searchResults);
      toast.success(`Found ${searchResults.length} results`);
    } catch (err) {
      console.error('Search error', err);
      if (err?.response?.status === 403) {
        setRbacWarning({
          message: err?.response?.data?.message || 'Access denied: You do not have permission to search',
          policy: err?.response?.data?.policy_id || null
        });
      }
      const serverMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Search failed';
      setError(serverMsg);
      toast.error(serverMsg);
    } finally {
      setLoading(false);
    }
  };

  const detectPII = (text) => {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    const phoneRegex = /\b(?:\+?\d{1,3}[-.\s]?)?(?:\d[-.\s]?){6,14}\b/g;
    const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;

    const detected = [];
    if (emailRegex.test(text)) detected.push('Email addresses');
    if (phoneRegex.test(text)) detected.push('Phone numbers');
    if (ssnRegex.test(text)) detected.push('SSN');

    return detected;
  };

  const doSearch = async (e) => {
    e.preventDefault();
    triggerSearch(q);
  };

  return (
    <div className="min-h-screen animated-gradient-bg">
      <div className="max-w-6xl mx-auto px-6 py-12">

        {/* Header Section */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-premium-gold/10 mb-6 shadow-lg backdrop-blur-sm border border-premium-gold/20">
            <SearchIcon className="w-10 h-10 text-premium-gold" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-premium-gold to-white drop-shadow-sm">
            Semantic Search
          </h1>
          <p className="text-gray-400 text-lg flex items-center justify-center gap-2 max-w-2xl mx-auto">
            <Sparkles className="w-4 h-4 text-premium-gold" />
            Find exactly what you need with AI-powered context understanding
            <Sparkles className="w-4 h-4 text-premium-gold" />
          </p>
        </div>

        {/* Privacy & Security Notice Pill */}
        <div className="flex justify-center mb-8 animate-fade-in">
          <div className="glass-panel px-4 py-2 rounded-full flex items-center gap-2 text-xs md:text-sm text-gray-300 border border-white/5 hover:bg-white/5 transition-colors">
            <Shield className="w-4 h-4 text-blue-400" />
            <span>Secure RBAC & PII Redaction Active</span>
          </div>
        </div>

        {/* Search Input Area */}
        <div className="max-w-3xl mx-auto mb-12 relative z-20">
          <form onSubmit={doSearch} className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-premium-gold/50 to-purple-600/50 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative glass-panel-strong p-2 rounded-2xl flex items-center gap-2 shadow-2xl">
              <div className="flex-1 relative">
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-premium-gold transition-colors" />
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search across all your documents..."
                  className="w-full bg-transparent border-none text-white placeholder-gray-500 text-lg py-4 pl-12 pr-4 focus:ring-0 focus:outline-none"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !q.trim()}
                className="bg-gradient-to-r from-premium-gold to-yellow-500 text-black font-bold py-3 px-8 rounded-xl hover:shadow-lg hover:shadow-premium-gold/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-5 h-5" />}
                <span className="hidden md:inline">Search</span>
              </button>
            </div>
          </form>
        </div>

        {/* Alerts & Warnings Area */}
        <div className="max-w-3xl mx-auto space-y-4 mb-8">
          {/* Privacy Alert */}
          {privacyInfo && (
            <div className="glass-panel border-l-4 border-l-yellow-500 p-4 rounded-xl animate-fade-in flex items-start gap-4 bg-yellow-500/5">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Eye className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <h3 className="font-semibold text-yellow-100 mb-1">Privacy Notice</h3>
                <p className="text-sm text-yellow-200/80 mb-2">{privacyInfo.message}</p>
                {privacyInfo.redacted && (
                  <div className="text-xs font-mono bg-black/30 p-2 rounded border border-white/10 text-gray-400">
                    <span className="text-gray-500">Query Redacted:</span> {privacyInfo.redacted}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RBAC Warning */}
          {rbacWarning && (
            <div className="glass-panel border-l-4 border-l-red-500 p-4 rounded-xl animate-fade-in flex items-start gap-4 bg-red-500/5">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <Lock className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-red-100 mb-1">Access Denied</h3>
                <p className="text-sm text-red-200/80">{rbacWarning.message}</p>
                {rbacWarning.policy && (
                  <p className="text-xs mt-1 text-gray-500">Policy Violation: {rbacWarning.policy}</p>
                )}
              </div>
            </div>
          )}

          {/* General Error */}
          {error && !rbacWarning && (
            <div className="glass-panel border-l-4 border-l-red-500 p-4 rounded-xl animate-fade-in flex items-center gap-4 bg-red-500/5">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <p className="text-red-200">{error}</p>
            </div>
          )}
        </div>

        {/* Helper State: Loading */}
        {loading && (
          <div className="text-center py-16 animate-fade-in">
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-gray-700/50 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-premium-gold/50 rounded-full border-t-transparent animate-spin"></div>
              <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-premium-gold animate-pulse" />
            </div>
            <p className="text-gray-400 text-lg">Querying university index...</p>
            <p className="text-premium-gold/60 text-xs mt-2 italic">Scanning 11,701 records for best matches</p>
          </div>
        )}

        {/* Helper State: No Results */}
        {!loading && results.length === 0 && q && !error && (
          <div className="text-center py-16 animate-fade-in">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText className="w-10 h-10 text-gray-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-300 mb-2">No results found</h3>
            <p className="text-gray-500">Try adjusting your search terms or checking different keywords.</p>
          </div>
        )}

        {/* Results Grid */}
        <div className="space-y-4">
          {results.map((r, i) => (
            <div
              key={i}
              className="premium-card p-6 rounded-xl animate-fade-in group hover:bg-white/5 transition-all duration-300 border-l-2 border-l-transparent hover:border-l-premium-gold"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-3 items-center">
                  <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 group-hover:text-blue-300 transition-colors">
                    <FileText className="w-5 h-5" />
                  </div>
                  {r.source && (
                    <span className="px-3 py-1 text-xs font-medium rounded-full bg-white/5 border border-white/10 text-gray-300">
                      {r.source}
                    </span>
                  )}
                </div>
                {r.score && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-premium-gold/10 rounded-full border border-premium-gold/20">
                    <Sparkles className="w-3 h-3 text-premium-gold" />
                    <span className="text-xs font-bold text-premium-gold">{(r.score * 100).toFixed(0)}% Match</span>
                  </div>
                )}
              </div>

              <div className="pl-14">
                <p className="text-gray-200 leading-relaxed font-light text-lg">
                  {r.text || r.content || r.snippet || JSON.stringify(r)}
                </p>
                {r.id && (
                  <p className="mt-4 text-xs font-mono text-gray-600 group-hover:text-gray-500 transition-colors">
                    ID: {r.id}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
