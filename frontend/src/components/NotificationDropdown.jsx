import React, { useState, useEffect, useRef } from 'react';
import { Bell, Shield, AlertTriangle, Info, Clock, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import client from '../api/index';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationDropdown() {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const dropdownRef = useRef(null);
    const { user } = useAuth();

    const fetchNotifications = async () => {
        if (!user) return; // Don't fetch if not authenticated

        try {
            setLoading(true);
            setError(null);
            const res = await client.get('/notifications');
            if (res.data.success) {
                setNotifications(res.data.notifications);
            }
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchNotifications();
            // Refresh every 60 seconds
            const interval = setInterval(fetchNotifications, 60000);
            return () => clearInterval(interval);
        }
    }, [user]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getIcon = (type) => {
        switch (type) {
            case 'security': return <Shield className="w-4 h-4 text-red-400" />;
            case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
            default: return <Info className="w-4 h-4 text-blue-400" />;
        }
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2 rounded-full transition-all relative ${isOpen ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-premium-gold text-black text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-black">
                        {unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-3 w-80 glass-panel-strong rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-in translate-y-0">
                    <div className="p-4 border-b border-white/10 flex items-center justify-between">
                        <h3 className="font-bold text-white">Notifications</h3>
                        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Priority Alerts</span>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                        {loading && notifications.length === 0 ? (
                            <div className="p-8 text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-premium-gold mx-auto mb-3"></div>
                                <p className="text-xs text-gray-500">Checking for alerts...</p>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-8 text-center">
                                <CheckCircle className="w-8 h-8 text-gray-700 mx-auto mb-3 opacity-20" />
                                <p className="text-sm text-gray-500">No active alerts</p>
                            </div>
                        ) : (
                            notifications.map((notif) => (
                                <div
                                    key={notif.id}
                                    className={`p-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group`}
                                >
                                    <div className="flex gap-3">
                                        <div className={`mt-0.5 p-2 rounded-lg bg-white/5 ${notif.type === 'security' ? 'bg-red-500/10' : notif.type === 'warning' ? 'bg-yellow-500/10' : ''}`}>
                                            {getIcon(notif.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-gray-200 leading-snug mb-1 group-hover:text-white transition-colors">
                                                {notif.message}
                                            </p>
                                            <div className="flex items-center gap-2 text-[10px] text-gray-500">
                                                <Clock size={10} />
                                                {formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-3 border-t border-white/10 text-center">
                        <button className="text-xs text-premium-gold hover:text-white transition-colors font-semibold">
                            Security Center Overview
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
