import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    Bell,
    Search,
    ChevronDown,
    User,
    Settings,
    LogOut,
    Menu
} from 'lucide-react';

export default function Navbar({ toggleSidebar, isSidebarOpen }) {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    // Generate breadcrumbs from path
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs = pathSegments.map((segment, index) => {
        const path = `/${pathSegments.slice(0, index + 1).join('/')}`;
        return {
            label: segment.charAt(0).toUpperCase() + segment.slice(1).replace('-', ' '),
            path
        };
    });

    return (
        <header className="h-16 bg-premium-black/50 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 sticky top-0 z-40">
            {/* Left: Breadcrumbs & Mobile Toggle */}
            <div className="flex items-center gap-4">
                <button
                    onClick={toggleSidebar}
                    className="p-2 text-gray-400 hover:text-white lg:hidden"
                >
                    <Menu size={20} />
                </button>

                <nav className="hidden md:flex items-center gap-2 text-sm">
                    <Link to="/dashboard" className="text-gray-400 hover:text-white transition-colors">
                        App
                    </Link>
                    {breadcrumbs.map((crumb, index) => (
                        <React.Fragment key={crumb.path}>
                            <span className="text-gray-600">/</span>
                            <Link
                                to={crumb.path}
                                className={`
                  transition-colors
                  ${index === breadcrumbs.length - 1
                                        ? 'text-white font-medium'
                                        : 'text-gray-400 hover:text-white'
                                    }
                `}
                            >
                                {crumb.label}
                            </Link>
                        </React.Fragment>
                    ))}
                </nav>
            </div>

            {/* Right: Actions & Profile */}
            <div className="flex items-center gap-4">
                {/* Search Bar (Optional) */}
                <div className="hidden md:flex items-center relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search..."
                        className="bg-white/5 border border-white/10 rounded-full pl-9 pr-4 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-premium-gold/50 w-64 transition-all"
                    />
                </div>

                {/* Notifications */}
                <button className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors relative">
                    <Bell size={20} />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-premium-gold rounded-full animate-pulse"></span>
                </button>

                {/* Profile Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-full hover:bg-white/5 transition-colors border border-transparent hover:border-white/5"
                    >
                        <div className="text-right hidden md:block">
                            <p className="text-sm font-medium text-white leading-none">{user?.name}</p>
                            <p className="text-xs text-premium-gold mt-0.5">{user?.organization}</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 border border-white/10 flex items-center justify-center">
                            <span className="font-bold text-xs text-white">{user?.name?.[0]?.toUpperCase()}</span>
                        </div>
                        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {isProfileOpen && (
                        <>
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setIsProfileOpen(false)}
                            />
                            <div className="absolute right-0 top-full mt-2 w-56 bg-premium-dark border border-white/10 rounded-xl shadow-2xl py-2 z-50 animate-fade-in">
                                <div className="px-4 py-3 border-b border-white/5 md:hidden">
                                    <p className="text-sm font-medium text-white">{user?.name}</p>
                                    <p className="text-xs text-gray-500">{user?.email}</p>
                                </div>

                                <Link
                                    to="/settings"
                                    className="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                                    onClick={() => setIsProfileOpen(false)}
                                >
                                    <User size={16} />
                                    Profile
                                </Link>
                                <Link
                                    to="/settings"
                                    className="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                                    onClick={() => setIsProfileOpen(false)}
                                >
                                    <Settings size={16} />
                                    Settings
                                </Link>

                                <div className="h-px bg-white/5 my-2" />

                                <button
                                    onClick={() => {
                                        logout();
                                        setIsProfileOpen(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                >
                                    <LogOut size={16} />
                                    Sign Out
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
