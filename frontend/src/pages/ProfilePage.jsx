import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Edit2, Save, X, Building2, Calendar, Clock, Mail, User as UserIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import client from '../api/index';
import AvatarInitials from '../components/AvatarInitials';
import RoleBadge from '../components/RoleBadge';
import toast from 'react-hot-toast';

export default function ProfilePage() {
    const [profile, setProfile] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [bio, setBio] = useState('');
    const [avatarFile, setAvatarFile] = useState(null);
    const [imgError, setImgError] = useState(false);
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        fetchProfileData();
    }, [user]);

    const fetchProfileData = async () => {
        try {
            const [profileRes, statsRes] = await Promise.all([
                client.get('/profile'),
                client.get('/profile/stats')
            ]);
            setProfile(profileRes.data.profile);
            setStats(statsRes.data.stats);
            setBio(profileRes.data.profile.bio || '');
            setImgError(false);
        } catch (error) {
            console.error('Failed to fetch profile:', error);
            toast.error('Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        try {
            await client.put('/profile', { bio });
            toast.success('Profile updated!');
            setEditing(false);
            fetchProfileData();
        } catch (error) {
            console.error('Failed to update profile:', error);
            toast.error('Failed to update profile');
        }
    };

    const handleAvatarUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image must be less than 5MB');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('avatar', file);

            const response = await client.post('/profile/avatar', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            toast.success('Avatar uploaded!');
            fetchProfileData();
        } catch (error) {
            console.error('Failed to upload avatar:', error);
            toast.error('Failed to upload avatar');
        }
    };

    const handleRemoveAvatar = async () => {
        try {
            await client.delete('/profile/avatar');
            toast.success('Avatar removed');
            fetchProfileData();
        } catch (error) {
            console.error('Failed to remove avatar:', error);
            toast.error('Failed to remove avatar');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-premium-black">
                <div className="text-white">Loading profile...</div>
            </div>
        );
    }

    if (!profile) return null;

    const avatarUrl = profile.avatarUrl;

    return (
        <div className="min-h-screen bg-premium-black py-8 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Profile Header */}
                <div className="glass-panel rounded-2xl p-8 mb-6">
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                        {/* Avatar Section */}
                        <div className="relative group">
                            {avatarUrl && !imgError ? (
                                <img
                                    src={avatarUrl}
                                    crossOrigin="anonymous"
                                    onError={() => setImgError(true)}
                                    alt={profile.username}
                                    className="w-32 h-32 rounded-full object-cover border-4 border-premium-gold shadow-lg"
                                />
                            ) : (
                                <div className="border-4 border-premium-gold rounded-full shadow-lg">
                                    <AvatarInitials user={profile} size="xl" />
                                </div>
                            )}

                            {/* Avatar Upload Button */}
                            <label className="absolute bottom-0 right-0 bg-premium-gold text-black p-2 rounded-full cursor-pointer shadow-lg hover:scale-110 transition-transform">
                                <Camera className="w-5 h-5" />
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleAvatarUpload}
                                    className="hidden"
                                />
                            </label>

                            {avatarUrl && profile.avatarUrl === profile.custom_avatar_url && (
                                <button
                                    onClick={handleRemoveAvatar}
                                    className="absolute top-0 right-0 bg-red-500 text-white p-2 rounded-full shadow-lg hover:scale-110 transition-transform opacity-0 group-hover:opacity-100"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Profile Info */}
                        <div className="flex-1 text-center md:text-left">
                            <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                                <h1 className="text-3xl font-bold text-white">{profile.username}</h1>
                                <RoleBadge role={profile.role} size="md" />
                            </div>

                            <p className="text-gray-400 mb-4">{profile.email}</p>

                            {profile.role === 'super_admin' ? (
                                <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
                                    <Building2 className="w-5 h-5 text-premium-gold" />
                                    <span className="text-white font-semibold">Global System</span>
                                    <span className="text-gray-400 text-sm">(System)</span>
                                </div>
                            ) : profile.organization && (
                                <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
                                    <Building2 className="w-5 h-5 text-premium-gold" />
                                    <span className="text-white font-semibold">{profile.organization.name}</span>
                                    <span className="text-gray-400 text-sm">({profile.organization.type})</span>
                                </div>
                            )}

                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-gray-400">
                                <div className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    Joined {new Date(profile.createdAt).toLocaleDateString()}
                                </div>
                                <div className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    Last login {profile.lastLogin ? new Date(profile.lastLogin).toLocaleDateString() : 'Never'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bio Section */}
                    <div className="mt-6 pt-6 border-t border-white/10">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-white font-semibold">About</h3>
                            {!editing ? (
                                <button
                                    onClick={() => setEditing(true)}
                                    className="flex items-center gap-2 text-premium-gold hover:text-yellow-400 transition-colors"
                                >
                                    <Edit2 className="w-4 h-4" />
                                    Edit
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSaveProfile}
                                        className="flex items-center gap-2 text-green-500 hover:text-green-400 transition-colors"
                                    >
                                        <Save className="w-4 h-4" />
                                        Save
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditing(false);
                                            setBio(profile.bio || '');
                                        }}
                                        className="flex items-center gap-2 text-red-500 hover:text-red-400 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>

                        {editing ? (
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                placeholder="Tell us about yourself..."
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-premium-gold resize-none"
                                rows={4}
                            />
                        ) : (
                            <p className="text-gray-300">
                                {profile.bio || 'No bio added yet. Click edit to add one!'}
                            </p>
                        )}
                    </div>
                </div>

                {/* Stats Section */}
                {stats && (
                    <div className="glass-panel rounded-2xl p-8 mb-6">
                        <h2 className="text-2xl font-bold text-white mb-6">
                            {profile.role === 'super_admin' ? 'System Statistics' :
                                profile.role === 'admin' ? 'Organization Statistics' :
                                    'Your Activity'}
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {profile.role === 'super_admin' && (
                                <>
                                    <StatCard title="Total Users" value={stats.totalUsers} color="blue" />
                                    <StatCard title="Organizations" value={stats.totalOrganizations} color="green" />
                                    <StatCard title="Total Documents" value={stats.totalDocuments} color="purple" />
                                </>
                            )}

                            {profile.role === 'admin' && (
                                <>
                                    <StatCard title="Team Members" value={stats.organizationUsers} color="blue" />
                                    <StatCard title="Documents" value={stats.organizationDocuments} color="green" />
                                    <StatCard title="Organization" value={profile.organization?.name || 'N/A'} color="purple" />
                                </>
                            )}

                            {profile.role === 'user' && (
                                <>
                                    <StatCard title="Documents Uploaded" value={stats.documentsUploaded} color="blue" />
                                    <StatCard title="Account Type" value={profile.accountType} color="green" />
                                    <StatCard title="Role" value="User" color="purple" />
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Account Details */}
                <div className="glass-panel rounded-2xl p-8">
                    <h2 className="text-2xl font-bold text-white mb-6">Account Details</h2>

                    <div className="space-y-4">
                        <DetailRow icon={UserIcon} label="Username" value={profile.username} />
                        <DetailRow icon={Mail} label="Email" value={profile.email} />
                        <DetailRow
                            icon={Building2}
                            label="Organization"
                            value={profile.role === 'super_admin' ? 'Global System' : (profile.organization?.name || 'None')}
                        />
                        <DetailRow
                            icon={Calendar}
                            label="Joined"
                            value={profile.createdAt ? new Date(profile.createdAt).toLocaleString() : 'N/A'}
                        />
                        <DetailRow
                            icon={Clock}
                            label="Last Login"
                            value={profile.lastLogin ? new Date(profile.lastLogin).toLocaleString() : 'N/A'}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

// Stat Card Component
function StatCard({ title, value, color }) {
    const colorClasses = {
        blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/30',
        green: 'from-green-500/20 to-green-600/5 border-green-500/30',
        purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/30'
    };

    return (
        <div className={`p-6 rounded-xl bg-gradient-to-br ${colorClasses[color]} border backdrop-blur-sm`}>
            <h3 className="text-gray-400 text-sm font-medium mb-2">{title}</h3>
            <p className="text-3xl font-bold text-white">
                {value === undefined || value === null ? '0' : (typeof value === 'string' ? value : value.toLocaleString())}
            </p>
        </div>
    );
}

// Detail Row Component
function DetailRow({ icon: Icon, label, value }) {
    return (
        <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors">
            <div className="p-2 bg-premium-gold/20 rounded-lg">
                <Icon className="w-5 h-5 text-premium-gold" />
            </div>
            <div className="flex-1">
                <p className="text-gray-400 text-sm">{label}</p>
                <p className="text-white font-medium">{value}</p>
            </div>
        </div>
    );
}
