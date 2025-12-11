import React, { useState, useEffect } from 'react';
import client from '../api/index';
import { FileText, Search, Filter, ChevronLeft, ChevronRight, Download, Trash2, Eye, Calendar, Database } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Documents() {
    const [documents, setDocuments] = useState([]);
    const [fileStats, setFileStats] = useState([]);
    const [overallStats, setOverallStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50, totalPages: 0 });

    // Filters
    const [selectedFile, setSelectedFile] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('DESC');

    useEffect(() => {
        fetchDocuments();
        fetchStats();
    }, [pagination.page, selectedFile, searchQuery, sortBy, sortOrder]);

    const fetchDocuments = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit,
                sortBy,
                sortOrder
            });

            if (selectedFile) params.append('filename', selectedFile);
            if (searchQuery) params.append('search', searchQuery);

            const res = await client.get(`/admin/documents?${params}`);
            if (res.data.success) {
                setDocuments(res.data.documents);
                setPagination(res.data.pagination);
            }
        } catch (err) {
            toast.error('Failed to fetch documents');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await client.get('/admin/documents/stats');
            if (res.data.success) {
                setFileStats(res.data.fileStats);
                setOverallStats(res.data.overallStats);
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    };

    const handlePageChange = (newPage) => {
        setPagination(prev => ({ ...prev, page: newPage }));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSearch = (e) => {
        setSearchQuery(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 })); // Reset to page 1
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    const formatTimeAgo = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    if (loading && documents.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-premium-gold"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-1">Documents Management</h1>
                    <p className="text-gray-400">
                        {pagination.total.toLocaleString()} total documents across {fileStats.length} files
                    </p>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard
                    icon={FileText}
                    title="Total Documents"
                    value={overallStats?.total_documents?.toLocaleString() || '0'}
                    subtitle="Across all files"
                    iconColor="text-purple-400"
                    bgColor="bg-purple-500/10"
                />
                <StatCard
                    icon={Database}
                    title="CSV Files"
                    value={overallStats?.total_files || '0'}
                    subtitle="Uploaded sources"
                    iconColor="text-blue-400"
                    bgColor="bg-blue-500/10"
                />
                <StatCard
                    icon={Eye}
                    title="Storage Used"
                    value={formatFileSize(overallStats?.total_storage)}
                    subtitle="Total size"
                    iconColor="text-green-400"
                    bgColor="bg-green-500/10"
                />
                <StatCard
                    icon={Calendar}
                    title="Latest Upload"
                    value={overallStats?.latest_upload ? formatTimeAgo(overallStats.latest_upload) : 'None'}
                    subtitle="Most recent"
                    iconColor="text-yellow-400"
                    bgColor="bg-yellow-500/10"
                />
            </div>

            {/* Filters */}
            <div className="glass-panel p-4 rounded-2xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* File Filter */}
                    <select
                        value={selectedFile}
                        onChange={(e) => {
                            setSelectedFile(e.target.value);
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                        className="glass-input px-4 py-2 rounded-lg appearance-none"
                    >
                        <option value="" className="text-black">All Files</option>
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
                            placeholder="Search documents..."
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
                        <option value="filename-ASC" className="text-black">Filename A-Z</option>
                        <option value="filename-DESC" className="text-black">Filename Z-A</option>
                    </select>
                </div>
            </div>

            {/* Documents Table */}
            <div className="glass-panel rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-white/5 border-b border-gray-800">
                            <tr className="text-left text-gray-400 text-sm">
                                <th className="p-4 font-medium">ID</th>
                                <th className="p-4 font-medium">Filename</th>
                                <th className="p-4 font-medium">Content Preview</th>
                                <th className="p-4 font-medium">Status</th>
                                <th className="p-4 font-medium">Uploaded</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                            {documents.map((doc) => (
                                <tr key={doc.id} className="hover:bg-white/5 transition-colors text-gray-300">
                                    <td className="p-4 text-sm text-gray-500">#{doc.id}</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-purple-400" />
                                            <span className="font-medium text-white">{doc.filename}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 max-w-md">
                                        <div className="text-xs text-gray-400 truncate">
                                            {doc.metadata ? Object.entries(JSON.parse(doc.metadata)).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', ') : 'No preview'}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs ${doc.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                                                doc.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                                                    'bg-gray-500/10 text-gray-400'
                                            }`}>
                                            {doc.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-gray-500">
                                        {formatTimeAgo(doc.created_at)}
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
