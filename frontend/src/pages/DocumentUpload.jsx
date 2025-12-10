import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/index';
import { useDocuments } from '../contexts/DocumentContext';
import { UploadCloud, File, X, FileText, Loader2, Shield, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DocumentUpload() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const { addDocument } = useDocuments();
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (selectedFile.size > maxSize) {
        toast.error('File size exceeds 10MB limit');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      toast.success(`Selected: ${selectedFile.name}`);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);

    try {
      const fd = new FormData();
      fd.append('file', file);

      const res = await client.post('/upload', fd, {
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

  return (
    <div className="min-h-screen animated-gradient-bg">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-premium-gold/10 mb-4">
            <UploadCloud className="w-8 h-8 text-premium-gold" />
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300">
            Upload Document
          </h1>
          <p className="text-gray-400">Add documents to your knowledge base</p>
        </div>

        {/* Privacy Notice */}
        <div className="glass-panel p-4 rounded-xl mb-6 animate-fade-in">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-300">
              <strong className="text-white">Secure Processing:</strong> Documents are automatically scanned for PII, encrypted at rest, and access is strictly controlled by your organization.
            </div>
          </div>
        </div>

        {/* Upload Area */}
        <form onSubmit={handleUpload}>
          <div className="glass-panel-strong p-12 rounded-2xl border-2 border-dashed border-white/20 hover:border-premium-gold/40 transition-all duration-300 relative">
            <input
              type="file"
              onChange={handleFileChange}
              accept=".pdf,.txt,.doc,.docx,.md"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
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
                <p className="text-gray-400 mb-6">
                  Support for PDF, TXT, DOC, DOCX, MD
                </p>
                <div className="inline-flex items-center gap-2 text-sm text-gray-500">
                  <FileText className="w-4 h-4" />
                  <span>Maximum file size: 10MB</span>
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
          <div className="mt-8 flex justify-center">
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

        {/* Info Cards */}
        <div className="grid md:grid-cols-3 gap-4 mt-12">
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
