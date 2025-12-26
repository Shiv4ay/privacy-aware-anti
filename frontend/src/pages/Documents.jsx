import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/index';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Search, Filter, ChevronLeft, ChevronRight, Download, Trash2, Eye, Calendar, Database, MessageSquare, UploadCloud } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Documents() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [documents, setDocuments] = useState([]);
    const [fileStats, setFileStats] = useState([]);
    const [overallStats, setOverallStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFile, setSelectedFile] = useState('');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('DESC');
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0
    });

    const isStudent = user?.role === 'student';

    // Fetch documents and stats
    useEffect(() => {
        fetchDocuments();
        fetchStats();
    }, [pagination.page, selectedFile, searchQuery, sortBy, sortOrder]);

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit,
                sortBy,
                sortOrder
            });

            if (selectedFile) params.append('filename', selectedFile);
            if (searchQuery) params.append('search', searchQuery);

            const res = await client.get(`/documents?${params}`);

            if (res.data.success) {
                setDocuments(res.data.documents || []);
                setPagination(prev => ({
                    ...prev,
                    total: res.data.pagination?.total || 0,
                    totalPages: res.data.pagination?.totalPages || 0
                }));
            }
        } catch (err) {
            console.error('Failed to fetch documents:', err);
            toast.error('Failed to load documents');
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await client.get('/documents');
            if (res.data.success && res.data.documents) {
                const docs = res.data.documents;

                // Calculate stats from documents
                const stats = {
                    total_documents: docs.length,
                    total_files: new Set(docs.map(d => d.filename)).size,
                    total_storage: docs.reduce((sum, d) => sum + (d.file_size || 0), 0),
                    latest_upload: docs.length > 0 ? docs[0].created_at : null,
                    processed: docs.filter(d => d.status === 'processed').length,
                    pending: docs.filter(d => d.status === 'pending').length
                };

                setOverallStats(stats);
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    };

    const handlePageChange = (newPage) => {
        setPagination(prev => ({ ...prev, page: newPage }));
    };

    const handleSearch = (e) => {
        setSearchQuery(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const formatTimeAgo = (dateString) => {
        if (!dateString) return 'Unknown';
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    const getMetadataSubject = (doc) => {
        try {
            const metadata = typeof doc.metadata === 'string' ? JSON.parse(doc.metadata) : doc.metadata;
            return metadata?.subject || metadata?.department || 'General';
        } catch {
            return 'General';
        }
    };

    const handleDelete = async (docId, filename) => {
        if (!window.confirm(`Are you sure you want to delete "${filename}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const res = await client.delete(`/documents/${docId}`);
            if (res.data.success) {
                toast.success(res.data.message || 'Document deleted successfully');
                // Refresh documents list
                fetchDocuments();
            }
        } catch (err) {
            console.error('Delete error:', err);
            toast.error(err.response?.data?.error || 'Failed to delete document');
        }
    };

    // Check if user can upload (logic matching Sidebar)
    const canUpload = true; // DEBUG: Force visible

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-1">
                        {isStudent ? 'Learning Resources' : 'Documents Management'}
                    </h1>
                    <p className="text-gray-400">
                        {pagination.total.toLocaleString()} {isStudent ? 'available resources' : 'total documents'}
                    </p>
                </div>
                {canUpload && (
                    <button
                        onClick={() => navigate('/documents/upload')}
                        className="btn-primary px-6 py-3 rounded-xl flex items-center gap-2 font-semibold shadow-lg shadow-premium-gold/20 hover:shadow-premium-gold/40 transition-all"
                    >
                        <UploadCloud className="w-5 h-5" />
                        Add Content
                    </button>
                )}
            </div>

            {/* Statistics Cards (Hidden for students to simplify view, or kept for context? Let's keep simpler for students) */}
            {!isStudent && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {user?.role === 'super_admin' ? (
                        // Super Admin Stats
                        <>
                            <StatCard
                                icon={Database}
                                title="All Organizations"
                                value={(pagination.total || 0).toLocaleString()}
                                subtitle="Total documents"
                                iconColor="text-red-400"
                                bgColor="bg-red-500/10"
                            />
                            <StatCard
                                icon={FileText}
                                title="Processed"
                                value={(overallStats?.processed || 0).toLocaleString()}
                                subtitle="Ready for search"
                                iconColor="text-green-400"
                                bgColor="bg-green-500/10"
                            />
                            <StatCard
                                icon={Calendar}
                                title="Pending"
                                value={(overallStats?.pending || 0).toLocaleString()}
                                subtitle="Being indexed"
                                iconColor="text-yellow-400"
                                bgColor="bg-yellow-500/10"
                            />
                            <StatCard
                                icon={Eye}
                                title="Total Storage"
                                value={formatFileSize(overallStats?.total_storage)}
                                subtitle="Across all orgs"
                                iconColor="text-purple-400"
                                bgColor="bg-purple-500/10"
                            />
                        </>
                    ) : (
                        // Regular Admin/User Stats
                        <>
                            <StatCard
                                icon={FileText}
                                title="My Documents"
                                value={(pagination.total || 0).toLocaleString()}
                                subtitle="In my organization"
                                iconColor="text-blue-400"
                                bgColor="bg-blue-500/10"
                            />
                            <StatCard
                                icon={Database}
                                title="Unique Files"
                                value={(overallStats?.total_files || 0).toLocaleString()}
                                subtitle="Uploaded sources"
                                iconColor="text-green-400"
                                bgColor="bg-green-500/10"
                            />
                            <StatCard
                                icon={Eye}
                                title="Storage Used"
                                value={formatFileSize(overallStats?.total_storage)}
                                subtitle="Total size"
                                iconColor="text-purple-400"
                                bgColor="bg-purple-500/10"
                            />
                            <StatCard
                                icon={Calendar}
                                title="Latest Upload"
                                value={overallStats?.latest_upload ? formatTimeAgo(overallStats.latest_upload) : 'None'}
                                subtitle="Most recent"
                                iconColor="text-yellow-400"
                                bgColor="bg-yellow-500/10"
                            />
                        </>
                    )}
                </div>
            )}

            {/* Filters */}
            <div className="glass-panel p-4 rounded-2xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* File Filter - Renamed for students */}
                    <select
                        value={selectedFile}
                        onChange={(e) => {
                            setSelectedFile(e.target.value);
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                        className="glass-input px-4 py-2 rounded-lg appearance-none"
                    >
                        <option value="" className="text-black">All {isStudent ? 'Subjects' : 'Files'}</option>
                        {fileStats.map(stat => (
                            <option key={stat.filename} value={stat.filename} className="text-black">
                                {stat.filename} ({parseInt(stat.count).toLocaleString()})
                            </option>
                        ))}
                    </select>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder={isStudent ? "Search for topics..." : "Search documents..."}
                            value={searchQuery}
                            onChange={handleSearch}
                            className="glass-input pl-10 pr-4 py-2 rounded-lg w-full"
                        />
                    </div>

                    {/* Sort */}
                    <select
                        value={`${sortBy}-${sortOrder}`}
                        onChange={(e) => {
                            const [newSortBy, newSortOrder] = e.target.value.split('-');
                            setSortBy(newSortBy);
                            setSortOrder(newSortOrder);
                        }}
                        className="glass-input px-4 py-2 rounded-lg appearance-none"
                    >
                        <option value="created_at-DESC" className="text-black">Newest First</option>
                        <option value="created_at-ASC" className="text-black">Oldest First</option>
                        <option value="filename-ASC" className="text-black">A-Z</option>
                    </select>
                </div>
            </div>

            {/* Documents Table */}
            <div className="glass-panel rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-white/5 border-b border-gray-800">
                            <tr className="text-left text-gray-400 text-sm">
                                {!isStudent && <th className="p-4 font-medium">ID</th>}
                                <th className="p-4 font-medium">{isStudent ? 'Resource Name' : 'Filename'}</th>
                                <th className="p-4 font-medium">{isStudent ? 'Subject / Details' : 'Content Preview'}</th>
                                {!isStudent && <th className="p-4 font-medium">Status</th>}
                                <th className="p-4 font-medium">{isStudent ? 'Added' : 'Uploaded'}</th>
                                {isStudent && <th className="p-4 font-medium text-right">Action</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                            {documents.map((doc) => (
                                <tr key={doc.id} className="hover:bg-white/5 transition-colors text-gray-300">
                                    {!isStudent && <td className="p-4 text-sm text-gray-500">#{doc.id}</td>}
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${isStudent ? 'bg-blue-500/10' : ''}`}>
                                                <FileText className={`w-4 h-4 ${isStudent ? 'text-blue-400' : 'text-purple-400'}`} />
                                            </div>
                                            <span className="font-medium text-white">{doc.filename}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 max-w-md">
                                        {isStudent ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                {getMetadataSubject(doc)}
                                            </span>
                                        ) : (
                                            <div className="text-xs text-gray-400 truncate">
                                                {(() => {
                                                    try {
                                                        const metadata = typeof doc.metadata === 'string'
                                                            ? JSON.parse(doc.metadata)
                                                            : doc.metadata;
                                                        if (!metadata) return 'No preview';
                                                        return Object.entries(metadata)
                                                            .slice(0, 3)
                                                            .map(([k, v]) => `${k}: ${v}`)
                                                            .join(', ');
                                                    } catch (err) {
                                                        return 'No preview';
                                                    }
                                                })()}
                                            </div>
                                        )}
                                    </td>
                                    {!isStudent && (
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs ${doc.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                                                doc.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                                                    'bg-gray-500/10 text-gray-400'
                                                }`}>
                                                {doc.status}
                                            </span>
                                        </td>
                                    )}
                                    <td className="p-4 text-sm text-gray-500">
                                        {formatTimeAgo(doc.created_at)}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {isStudent && (
                                                <button
                                                    onClick={() => navigate('/chat', { state: { context: doc.filename } })}
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-premium-gold/10 hover:bg-premium-gold/20 text-premium-gold rounded-lg transition-colors text-sm font-medium"
                                                >
                                                    <MessageSquare className="w-4 h-4" />
                                                    Ask AI
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(doc.id, doc.filename)}
                                                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                title="Delete document"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {documents.length === 0 && !loading && (
                        <div className="text-center py-12 text-gray-500">
                            <Database className="w-16 h-16 mx-auto mb-4 text-gray-700" />
                            <p className="text-lg">No documents found</p>
                            <p className="text-sm">Try adjusting your filters</p>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="border-t border-gray-800 p-4 bg-white/5">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-400">
                                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handlePageChange(pagination.page - 1)}
                                    disabled={pagination.page === 1}
                                    className={`p-2 rounded-lg transition-colors ${pagination.page === 1
                                        ? 'text-gray-600 cursor-not-allowed'
                                        : 'text-white hover:bg-white/10'
                                        }`}
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>

                                <div className="flex items-center gap-1">
                                    {renderPageNumbers(pagination.page, pagination.totalPages, handlePageChange)}
                                </div>

                                <button
                                    onClick={() => handlePageChange(pagination.page + 1)}
                                    disabled={pagination.page === pagination.totalPages}
                                    className={`p-2 rounded-lg transition-colors ${pagination.page === pagination.totalPages
                                        ? 'text-gray-600 cursor-not-allowed'
                                        : 'text-white hover:bg-white/10'
                                        }`}
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Statistics Card Component
function StatCard({ icon: Icon, title, value, subtitle, iconColor, bgColor }) {
    return (
        <div className="glass-panel p-6 rounded-2xl">
            <div className="flex items-center gap-4">
                <div className={`p-3 ${bgColor} rounded-xl`}>
                    <Icon className={`w-6 h-6 ${iconColor}`} />
                </div>
                <div className="flex-1">
                    <p className="text-sm text-gray-400 mb-1">{title}</p>
                    <p className="text-2xl font-bold text-white">{value}</p>
                    <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
                </div>
            </div>
        </div>
    );
}

// Page Numbers Helper
function renderPageNumbers(currentPage, totalPages, onPageChange) {
    const pages = [];
    const maxVisible = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
        pages.push(
            <button key={1} onClick={() => onPageChange(1)} className="px-3 py-1 rounded-lg hover:bg-white/10 text-sm text-white">
                1
            </button>
        );
        if (startPage > 2) {
            pages.push(<span key="ellipsis1" className="px-2 text-gray-600">...</span>);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        pages.push(
            <button
                key={i}
                onClick={() => onPageChange(i)}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${i === currentPage
                    ? 'bg-premium-gold text-black font-semibold'
                    : 'text-white hover:bg-white/10'
                    }`}
            >
                {i}
            </button>
        );
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            pages.push(<span key="ellipsis2" className="px-2 text-gray-600">...</span>);
        }
        pages.push(
            <button key={totalPages} onClick={() => onPageChange(totalPages)} className="px-3 py-1 rounded-lg hover:bg-white/10 text-sm text-white">
                {totalPages}
            </button>
        );
    }

    return pages;
}
