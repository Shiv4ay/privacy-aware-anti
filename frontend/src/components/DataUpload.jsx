import React, { useState, useRef } from 'react';
import client from '../api/index';
import { Upload, X, FileText, CheckCircle, AlertTriangle, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

export default function DataUpload({ onUploadComplete }) {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const fileInputRef = useRef(null);
    const { user } = useAuth();

    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (selected) {
            // Basic validation
            if (selected.type !== 'application/pdf' && selected.type !== 'text/csv') {
                toast.error("Only PDF and CSV files are supported");
                return;
            }
            setFile(selected);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        if (!user?.organization) {
            toast.error("No organization found for user");
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('organization_id', user.organization);

        try {
            const res = await client.post('/documents/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setProgress(percentCompleted);
                }
            });

            if (res.data.success) {
                toast.success(`Uploaded ${file.name} successfully`);
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
                if (onUploadComplete) onUploadComplete();
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || "Upload failed");
        } finally {
            setUploading(false);
            setProgress(0);
        }
    };

    return (
        <div className="space-y-4">
            <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${file ? 'border-premium-gold bg-premium-gold/5' : 'border-white/10 hover:border-premium-gold/50 hover:bg-white/5'
                    }`}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.csv"
                />

                {file ? (
                    <div className="flex flex-col items-center">
                        <FileText className="w-12 h-12 text-premium-gold mb-2" />
                        <p className="text-white font-medium break-all">{file.name}</p>
                        <p className="text-gray-400 text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        <button
                            onClick={(e) => { e.stopPropagation(); setFile(null); }}
                            className="mt-4 px-3 py-1 bg-red-500/10 text-red-400 rounded-lg text-xs hover:bg-red-500/20"
                        >
                            Remove
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center">
                        <div className="p-4 bg-white/5 rounded-full mb-3">
                            <Upload className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-300 font-medium">Click to browse</p>
                        <p className="text-gray-500 text-sm mt-1">PDF or CSV files supported</p>
                    </div>
                )}
            </div>

            {file && (
                <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="w-full btn-primary py-3 rounded-xl flex items-center justify-center gap-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {uploading ? (
                        <>
                            <Loader className="w-5 h-5 animate-spin" />
                            Uploading {progress}%...
                        </>
                    ) : (
                        <>
                            <Upload className="w-5 h-5" />
                            Start Upload
                        </>
                    )}
                </button>
            )}
        </div>
    );
}
