import React, { useState } from 'react';
import client from '../api/index';
import { Search as SearchIcon, Sparkles, Loader2, FileText, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

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
    if (!q || q.trim().length === 0) {
      toast.error('Please enter a search query');
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);
    setPrivacyInfo(null);
    setRbacWarning(null);

    const detectedPII = detectPII(q);
    if (detectedPII.length > 0) {
      setPrivacyInfo({
        detected: detectedPII,
        message: `PII detected: ${detectedPII.join(', ')}. These will be redacted in audit logs.`
      });
    }

    try {
      const res = await client.post('/api/search', { query: q.trim() });

      if (res.data?.query_redacted) {
        setPrivacyInfo(prev => ({
          ...prev,
          redacted: res.data.query_redacted,
          original: res.data.query || q
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

  return (
    <div className="min-h-screen animated-gradient-bg">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-premium-gold/10 mb-4">
            <Sparkles className="w-8 h-8 text-premium-gold" />
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300">
            Semantic Search
          </h1>
          <p className="text-gray-400">AI-powered document search with privacy protection</p>
        </div>

        {/* Privacy Notice */}
        <div className="glass-panel p-4 rounded-xl mb-6 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-400">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-sm text-gray-300">
              <strong className="text-white">Privacy & Security:</strong> Queries are automatically redacted for PII, hashed for audit logs,
              and access is controlled by role-based permissions (RBAC).
            </div>
          </div>
        </div>

        {/* Primary Warnings */}
        {privacyInfo && (
          <div className="glass-panel-strong p-4 rounded-xl mb-6 border-yellow-500/20 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 mt-0.5 flex-shrink-0 text-yellow-400">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-sm">
                <p className="text-yellow-200">{privacyInfo.message}</p>
                {privacyInfo.redacted && privacyInfo.original && (
                  <div className="mt-2 space-y-1 text-xs text-gray-400">
                    <div><strong className="text-gray-300">Original:</strong> {privacyInfo.original}</div>
                    <div><strong className="text-gray-300">Redacted:</strong> {privacyInfo.redacted}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {rbacWarning && (
          <div className="glass-panel-strong p-4 rounded-xl mb-6 border-red-500/20 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 mt-0.5 flex-shrink-0 text-red-400">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-sm">
                <p className="text-red-200"><strong>Access Denied:</strong> {rbacWarning.message}</p>
                {rbacWarning.policy && (
                  <div className="text-xs mt-1 text-gray-400">Policy ID: {rbacWarning.policy}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Search Form */}
        <form onSubmit={doSearch} className="mb-8">
          <div className="glass-panel-strong p-6 rounded-2xl">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search documents... (e.g., 'artificial intelligence', 'security policy')"
                  className="glass-input w-full pl-12 pr-4 py-4 rounded-xl text-lg"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !q.trim()}
                className="btn-primary px-8 py-4 rounded-xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    Search
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-flex gap-2 mb-3">
              <div className="w-3 h-3 bg-premium-gold rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-3 h-3 bg-premium-gold rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-3 h-3 bg-premium-gold rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            <p className="text-gray-400">Searching through documents...</p>
          </div>
        )}

        {/* Error State */}
        {error && !rbacWarning && (
          <div className="glass-panel-strong p-4 rounded-xl border-red-500/20 text-red-200 text-sm">
            {error}
          </div>
        )}

        {/* No Results */}
        {!loading && results.length === 0 && !error && q && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No results found. Try a different query.</p>
          </div>
        )}

        {/* Results */}
        <div className="space-y-4 custom-scrollbar">
          {results.map((r, i) => (
            <div key={i} className="premium-card animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex justify-between items-start mb-3">
                {r.source && (
                  <div className="text-xs px-3 py-1 bg-premium-gold/10 rounded-full text-premium-gold font-medium">
                    {r.source}
                  </div>
                )}
                {r.score && (
                  <div className="text-xs text-gray-500 font-mono">
                    {(r.score * 100).toFixed(1)}% match
                  </div>
                )}
              </div>
              <div className="text-gray-200 leading-relaxed mb-3">
                {r.text || r.content || r.snippet || JSON.stringify(r)}
              </div>
              {r.id && (
                <div className="text-xs text-gray-500 font-mono">
                  ID: {r.id}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Results Summary */}
        {results.length > 0 && (
          <div className="mt-6 text-center text-sm text-gray-400">
            Found <span className="text-premium-gold font-semibold">{results.length}</span> result{results.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
