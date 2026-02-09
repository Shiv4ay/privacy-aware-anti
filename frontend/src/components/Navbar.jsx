import React, { useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ProfileDropdown from './ProfileDropdown';
import NotificationDropdown from './NotificationDropdown';
import {
    Search,
    Menu
} from 'lucide-react';

export default function Navbar({ toggleSidebar, isSidebarOpen }) {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();

    // Generate breadcrumbs from path
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs = pathSegments.map((segment, index) => {
        const path = `/${pathSegments.slice(0, index + 1).join('/')}`;
        return {
            label: segment.charAt(0).toUpperCase() + segment.slice(1).replace('-', ' '),
            path
        };
    });

    const handleSearch = (e) => {
        console.log('[Navbar] Key pressed:', e.key, 'Query:', searchQuery);
        if (e.key === 'Enter' && searchQuery.trim()) {
            console.log('[Navbar] Navigating to search with query:', searchQuery.trim());
            navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

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
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearch}
                        className="bg-white/5 border border-white/10 rounded-full pl-9 pr-4 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-premium-gold/50 w-64 transition-all"
                    />
                </div>

                {/* Notifications */}
                <NotificationDropdown />

                {/* Profile Dropdown */}
                <ProfileDropdown />
            </div>
        </header>
    );
}
