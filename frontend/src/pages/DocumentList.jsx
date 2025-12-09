import React, { useEffect, useState } from 'react';
import client from '../api/index';
import { useDocuments } from '../contexts/DocumentContext';
import { FileText, RefreshCw, Search, Clock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DocumentList() {
  const { documents, setList } = useDocuments();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const res = await client.get('/api/documents');
      const docs = res.data?.documents || res.data || [];
      setList(Array.isArray(docs) ? docs : []);
    } catch (err) {
      console.error('Failed to load documents:', err);
      toast.error('Failed to load documents');
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [setList]);

  const filteredDocs = documents.filter(d =>
    (d.filename || d.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-premium-gold" />
          Documents
        </h2>
        <button
          onClick={loadDocuments}
          disabled={loading}
          className="btn-secondary p-2 rounded-lg"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search documents..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="glass-input w-full pl-10 pr-4 py-2 rounded-lg"
        />
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
        {loading && documents.length === 0 ? (
          // Skeletons
          [...Array(3)].map((_, i) => (
            <div key={i} className="glass-panel p-4 rounded-xl animate-pulse">
              <div className="h-4 bg-white/10 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-white/5 rounded w-1/2"></div>
            </div>
          ))
        ) : filteredDocs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No documents found</p>
          </div>
        ) : (
          filteredDocs.map((d, i) => (
            <div key={d.id || i} className="glass-panel p-4 rounded-xl hover:bg-white/5 transition-colors group">
              <div className="flex justify-between items-start mb-2">
                <div className="font-medium text-gray-200 truncate pr-4">{d.filename || d.name || `Document ${i + 1}`}</div>
                {d.status && (
                  <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${d.status === 'processed' ? 'bg-green-500/10 text-green-400' :
                      d.status === 'processing' ? 'bg-yellow-500/10 text-yellow-400' :
                        d.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                          'bg-gray-500/10 text-gray-400'
                    }`}>
                    {d.status === 'processed' && <CheckCircle className="w-3 h-3" />}
                    {d.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin" />}
                    {d.status === 'failed' && <AlertCircle className="w-3 h-3" />}
                    <span className="capitalize">{d.status}</span>
                  </span>
                )}
              </div>
              {d.content_preview && (
                <div className="text-xs text-gray-500 mt-1 line-clamp-2">{d.content_preview}</div>
              )}
              <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-600">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {d.created_at ? new Date(d.created_at).toLocaleDateString() : 'Unknown date'}
                </span>
                {d.file_size && <span>{(d.file_size / 1024).toFixed(1)} KB</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
