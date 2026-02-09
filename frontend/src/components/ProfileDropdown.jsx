import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import client from '../api/index';
import AvatarInitials from './AvatarInitials';
import RoleBadge from './RoleBadge';

export default function ProfileDropdown() {
    const [isOpen, setIsOpen] = useState(false);
    const [profile, setProfile] = useState(null);
    const [imgError, setImgError] = useState(false);
    const { user, logout } = useAuth();
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            setImgError(false);
            // Initialize with partial data from auth context
            setProfile({
                username: user.name || user.email?.split('@')[0],
                email: user.email,
                role: user.role,
                ...user
            });
            fetchProfile();
        }
    }, [user]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchProfile = async () => {
        try {
            const response = await client.get('/profile');
            setProfile(prev => ({ ...prev, ...response.data.profile }));
        } catch (error) {
            console.error('Failed to fetch profile:', error);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    if (!user) return null;

    // Use profile data or fallback to user context
    const displayProfile = profile || user;
    const avatarUrl = displayProfile.avatarUrl || displayProfile.oauth_avatar_url;
    console.log('[ProfileDropdown] Rendering with avatarUrl:', avatarUrl);

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Avatar Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 p-1 rounded-full hover:bg-white/10 transition-colors"
            >
                {/* Avatar */}
                <div className="relative">
                    {avatarUrl && !imgError ? (
                        <img
                            src={avatarUrl}
                            crossOrigin="anonymous"
                            onError={() => setImgError(true)}
                            alt={displayProfile.email?.split('@')[0] || displayProfile.username}
                            className="w-10 h-10 rounded-full object-cover border-2 border-premium-gold/50"
                        />
                    ) : (
                        <AvatarInitials
                            user={{
                                ...displayProfile,
                                username: displayProfile.email?.split('@')[0] || displayProfile.username
                            }}
                            size="md"
                        />
                    )}
                    {/* Online Status Indicator */}
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-gray-900 rounded-full"></div>
                </div>

                {/* Name & Role (hidden on mobile) */}
                <div className="hidden md:flex flex-col items-start">
                    <span className="text-sm font-semibold text-white">{displayProfile.username || displayProfile.name}</span>
                    <span className="text-xs text-gray-400 capitalize">{(displayProfile.role || 'user').replace('_', ' ')}</span>
                </div>

                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-[#0A0A0A] border border-white/20 rounded-xl shadow-2xl overflow-hidden z-50 animate-slideDown ring-1 ring-black/50">
                    {/* Profile Header */}
                    <div className="p-4 bg-gradient-to-r from-gray-900 to-black border-b border-white/10">
                        <div className="flex items-center gap-3 mb-3">
                            {avatarUrl && !imgError ? (
                                <img
                                    src={avatarUrl}
                                    crossOrigin="anonymous"
                                    onError={() => setImgError(true)}
                                    alt={displayProfile.email?.split('@')[0] || displayProfile.username}
                                    className="w-12 h-12 rounded-full object-cover border-2 border-premium-gold"
                                />
                            ) : (
                                <AvatarInitials
                                    user={{
                                        ...displayProfile,
                                        username: displayProfile.email?.split('@')[0] || displayProfile.username
                                    }}
                                    size="lg"
                                />
                            )}
                            <div className="flex-1">
                                <h3 className="text-white font-bold text-base">
                                    {displayProfile.email?.split('@')[0] || displayProfile.username || displayProfile.name}
                                </h3>
                                <p className="text-gray-400 text-sm">{displayProfile.email}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <RoleBadge role={displayProfile.role || 'user'} size="sm" />
                            {displayProfile.role === 'super_admin' ? (
                                <span className="text-xs px-2 py-1 bg-white/10 rounded-full text-gray-300">
                                    Global System
                                </span>
                            ) : displayProfile.organization && (
                                <span className="text-xs px-2 py-1 bg-white/10 rounded-full text-gray-300">
                                    {displayProfile.organization.name}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Menu Items */}
                    <div className="p-2">
                        <Link
                            to="/profile"
                            className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-white/10 rounded-lg transition-colors"
                            onClick={() => setIsOpen(false)}
                        >
                            <User className="w-5 h-5" />
                            <span className="font-medium">View Profile</span>
                        </Link>

                        <Link
                            to="/settings"
                            className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-white/10 rounded-lg transition-colors"
                            onClick={() => setIsOpen(false)}
                        >
                            <Settings className="w-5 h-5" />
                            <span className="font-medium">Settings</span>
                        </Link>

                        <div className="my-2 border-t border-white/10"></div>

                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                            <span className="font-medium">Logout</span>
                        </button>
                    </div>

                    {/* Account Type Footer */}
                    <div className="p-3 bg-white/5 border-t border-white/10">
                        <p className="text-xs text-center text-gray-500">
                            Logged in via <span className="text-premium-gold font-semibold capitalize">{displayProfile.accountType || 'System'}</span>
                        </p>
                    </div>
                </div>
            )}

            <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slideDown {
          animation: slideDown 0.2s ease-out;
        }
      `}</style>
        </div>
    );
}
