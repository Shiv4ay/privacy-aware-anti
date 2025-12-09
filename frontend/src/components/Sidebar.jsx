import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Search,
  MessageSquare,
  FileText,
  Upload,
  Settings,
  Shield,
  Users,
  ChevronLeft,
  ChevronRight,
  LogOut
} from 'lucide-react';

export default function Sidebar({ isOpen, setIsOpen }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Overview', path: '/dashboard' },
    { icon: Search, label: 'Search', path: '/search' },
    { icon: MessageSquare, label: 'Chat', path: '/chat' },
    { icon: FileText, label: 'Documents', path: '/documents' },
    { icon: Upload, label: 'Upload', path: '/documents/upload' },
  ];

  // Role-based items
  if (user?.role === 'super_admin') {
    menuItems.push({ icon: Shield, label: 'Super Admin', path: '/super-admin' });
  }
  if (user?.role === 'admin' || user?.role === 'super_admin') {
    menuItems.push({ icon: Users, label: 'Admin', path: '/admin' });
  }

  menuItems.push({ icon: Settings, label: 'Settings', path: '/settings' });

  return (
    <aside
      className={`
        fixed left-0 top-0 h-screen bg-premium-black border-r border-white/5 
        transition-all duration-300 ease-in-out z-50
        ${isOpen ? 'w-64' : 'w-20'}
      `}
    >
      {/* Logo Section */}
      <div className="h-16 flex items-center px-6 border-b border-white/5">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-premium-gold to-yellow-600 flex items-center justify-center flex-shrink-0">
            <span className="font-bold text-black text-lg">P</span>
          </div>
          <span className={`font-bold text-white text-lg whitespace-nowrap transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
            Privacy RAG
          </span>
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute -right-3 top-20 w-6 h-6 bg-premium-gold rounded-full flex items-center justify-center text-black hover:bg-white transition-colors shadow-lg z-50"
      >
        {isOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      {/* Navigation */}
      <nav className="p-4 space-y-2 mt-4">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
                ${isActive
                  ? 'bg-premium-gold/10 text-premium-gold'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }
              `}
            >
              <item.icon
                size={20}
                className={`flex-shrink-0 transition-colors ${isActive ? 'text-premium-gold' : 'group-hover:text-white'}`}
              />
              <span className={`whitespace-nowrap transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
                {item.label}
              </span>

              {/* Active Indicator */}
              {isActive && (
                <div className="absolute left-0 w-1 h-8 bg-premium-gold rounded-r-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile / Logout (Bottom) */}
      <div className="absolute bottom-0 left-0 w-full p-4 border-t border-white/5 bg-premium-black">
        <div className={`flex items-center gap-3 ${isOpen ? '' : 'justify-center'}`}>
          <div className="w-10 h-10 rounded-full bg-premium-gold/20 flex items-center justify-center text-premium-gold font-bold flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>

          <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}>
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.role}</p>
          </div>

          {isOpen && (
            <button
              onClick={logout}
              className="ml-auto p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
