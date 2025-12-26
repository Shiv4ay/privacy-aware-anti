import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/index';
import { useAuth } from '../contexts/AuthContext';
import { useDocuments } from '../contexts/DocumentContext';
import { UploadCloud, File, X, FileText, Loader2, Shield, CheckCircle2, Globe } from 'lucide-react';
import toast from 'react-hot-toast';


export default function DocumentUpload() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // ... existing code ...

  React.useEffect(() => {
    if (user) {
      // const canUpload = (user.role !== 'student' && user.role !== 'guest') || user.organization_type === 'Personal';
      const canUpload = true; // DEBUG: Force visible
      if (!canUpload) {
        navigate('/dashboard');
      }
    }
  }, [user, navigate]);
  const [loading, setLoading] = useState(false);
  const { addDocument } = useDocuments();
  const [file, setFile] = useState(null);
  const [webUrl, setWebUrl] = useState('');
  const [webLoading, setWebLoading] = useState(false);

  const handleFileChange = (e) => {
    // ... file handling code ...
    console.log('[Upload] File input changed', e.target.files);
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      console.log('[Upload] File selected:', selectedFile.name, selectedFile.size);
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (selectedFile.size > maxSize) {
        console.error('[Upload] File too large:', selectedFile.size);
        toast.error('File size exceeds 50MB limit');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      console.log('[Upload] File set successfully');
      toast.success(`Selected: ${selectedFile.name}`);
    } else {
      console.log('[Upload] No file selected');
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    console.log('[Upload] Form submitted, file:', file);
    if (!file) {
      console.error('[Upload] No file to upload');
      toast.error('Please select a file first');
      return;
    }

    setLoading(true);
    console.log('[Upload] Starting upload...');

    try {
      if (!user?.organization) {
        toast.error("No organization found for user");
        return;
      }

      const fd = new FormData();
      fd.append('file', file);
      fd.append('organization_id', user.organization);

      const res = await client.post('/documents/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000
      });

      if (res.data) {
        const docData = res.data.document || res.data;
        addDocument({
          id: res.data.docId || res.data.id,
          filename: docData.filename || file.name,
          status: docData.status || 'pending',
          created_at: new Date().toISOString()
        });
        toast.success('Document uploaded successfully!');
        setFile(null);

        // Reset file input
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) fileInput.value = '';

        setTimeout(() => navigate('/documents'), 1500);
      }
    } catch (err) {
      console.error('Upload error', err);
      const msg = err?.response?.data?.error || err?.message || 'Upload failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleWebIngest = async (e) => {
    e.preventDefault();
    if (!webUrl) {
      toast.error('Please enter a URL');
      return;
    }

    setWebLoading(true);
    try {
      const res = await client.post('/ingest/web', { url: webUrl });
      if (res.data && res.data.success) {
        toast.success('Web ingestion started! Check status in Documents.');
        setWebUrl('');
        setTimeout(() => navigate('/documents'), 1500);
      }
    } catch (err) {
      console.error('Web ingest error', err);
      toast.error(err?.response?.data?.error || 'Failed to start web ingestion');
    } finally {
      setWebLoading(false);
    }
  };

  return (
    <div className="min-h-screen animated-gradient-bg">
      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="text-center mb-6 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-premium-gold/10 mb-4">
            <UploadCloud className="w-8 h-8 text-premium-gold" />
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300">
            Add Content
          </h1>
          <p className="text-gray-400">Upload documents or ingest from the web</p>
        </div>

        {/* Privacy Notice */}
        <div className="glass-panel p-4 rounded-xl mb-6 animate-fade-in">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-300">
              <strong className="text-white">Secure Processing:</strong> All content is automatically scanned for PII, encrypted at rest, and strictly controlled.
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Web Ingestion Section */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-400" />
              Ingest from Web
            </h2>
            <div className="glass-panel-strong p-6 rounded-2xl border border-white/10">
              <form onSubmit={handleWebIngest} className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Website URL
                  </label>
                  <input
                    type="url"
                    value={webUrl}
                    onChange={(e) => setWebUrl(e.target.value)}
                    placeholder="https://example.com/page"
                    className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-premium-gold/50 transition-colors"
                    disabled={webLoading}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    We will scrape the text content from this page and add it to your knowledge base.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={webLoading || !webUrl}
                  className="bg-blue-600/20 text-blue-400 border border-blue-500/30 px-6 py-3 rounded-xl font-semibold hover:bg-blue-600/30 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 h-[50px]"
                >
                  {webLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Globe className="w-5 h-5" />}
                  Ingest Page
                </button>
              </form>
            </div>
          </section>

          {/* File Upload Section */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-premium-gold" />
              Upload Document
            </h2>
            <form onSubmit={handleUpload}>
              <div
                className="glass-panel-strong p-8 rounded-2xl border-2 border-dashed border-white/20 hover:border-premium-gold/40 transition-all duration-300 relative cursor-pointer"
                onClick={() => {
                  const input = document.getElementById('file-upload-input');
                  if (input && !loading) {
                    input.click();
                  }
                }}
              >
                <input
                  id="file-upload-input"
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.txt,.doc,.docx,.md,.csv,.html,.htm"
                  className="hidden"
                  disabled={loading}
                />

                {!file ? (
                  <div className="text-center relative z-0">
                    <div className="w-24 h-24 mx-auto bg-white/5 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-white/10 transition-colors">
                      <UploadCloud className="w-12 h-12 text-premium-gold" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Drop files here or click to browse
                    </h3>
                    <p className="text-gray-400 mb-8">
                      Support for PDF, TXT, DOC, DOCX, MD, CSV, HTML
                    </p>
                    <div className="flex justify-center mb-6">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const input = document.getElementById('file-upload-input');
                          if (input) input.click();
                        }}
                        disabled={loading}
                        className="px-8 py-4 bg-premium-gold text-black rounded-xl font-bold text-lg hover:bg-yellow-400 active:scale-95 transition-all duration-200 shadow-lg shadow-premium-gold/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        📁 Browse Files
                      </button>
                    </div>
                    <div className="flex justify-center items-center gap-2 text-sm text-gray-500">
                      <FileText className="w-4 h-4" />
                      <span>Maximum file size: 50MB</span>
                    </div>
                  </div>
                ) : (
                  <div className="relative z-20">
                    <div className="glass-panel p-6 rounded-xl border border-white/10">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-premium-gold/10 rounded-xl">
                          <File className="w-8 h-8 text-premium-gold" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-base font-medium text-white truncate mb-1">
                            {file.name}
                          </div>
                          <div className="text-sm text-gray-400">
                            {(file.size / 1024).toFixed(2)} KB
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setFile(null);
                            toast.info('File removed');
                          }}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                          disabled={loading}
                        >
                          <X className="w-5 h-5 text-gray-400" />
                        </button>
                      </div>

                      {/* Success Indicator */}
                      <div className="mt-4 flex items-center gap-2 text-sm text-green-400">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Ready to upload</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload Button */}
              <div className="mt-6 flex justify-center">
                <button
                  type="submit"
                  disabled={loading || !file}
                  className="btn-primary px-12 py-4 rounded-xl text-lg flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      Start Upload
                      <UploadCloud className="w-5 h-5 group-hover:translate-y-[-2px] transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          <div className="premium-card p-4 text-center">
            <div className="w-10 h-10 mx-auto bg-blue-500/10 rounded-lg flex items-center justify-center mb-3">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <h4 className="text-sm font-semibold text-white mb-1">Encrypted</h4>
            <p className="text-xs text-gray-500">End-to-end encryption</p>
          </div>
          <div className="premium-card p-4 text-center">
            <div className="w-10 h-10 mx-auto bg-green-500/10 rounded-lg flex items-center justify-center mb-3">
              <FileText className="w-5 h-5 text-green-400" />
            </div>
            <h4 className="text-sm font-semibold text-white mb-1">Processed</h4>
            <p className="text-xs text-gray-500">Auto-indexed for search</p>
          </div>
          <div className="premium-card p-4 text-center">
            <div className="w-10 h-10 mx-auto bg-purple-500/10 rounded-lg flex items-center justify-center mb-3">
              <CheckCircle2 className="w-5 h-5 text-purple-400" />
            </div>
            <h4 className="text-sm font-semibold text-white mb-1">Compliant</h4>
            <p className="text-xs text-gray-500">PII detection & RBAC</p>
          </div>
        </div>
      </div>
    </div>
  );
}
