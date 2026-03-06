import React, { useState, useEffect, useRef } from 'react';
import { Bell, UserCircle, X, CheckCheck, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API, authedHeaders } from '../config/api';

const NOTIFICATION_ICONS = {
    QUEUE_UPDATE: '📊',
    TURN_APPROACHING: '⏰',
    YOUR_TURN: '🔔',
    APPOINTMENT_REMINDER: '📅',
    DELAY_ALERT: '⚠️',
    WAITLIST_OFFER: '🎉',
    CANCELLATION: '❌',
    GENERAL: '📣'
};

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const name = user ? `${user.first_name} ${user.last_name}`.trim() : '';
    const roleLabel = user?.role ? user.role.charAt(0) + user.role.slice(1).toLowerCase() : '';
    
    // Issue #38: Notification state
    const [showNotifications, setShowNotifications] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const dropdownRef = useRef(null);
    const userMenuRef = useRef(null);

    // Fetch notifications and unread count
    useEffect(() => {
        if (!user) return;
        
        const fetchNotifications = async () => {
            try {
                const [notifRes, countRes] = await Promise.all([
                    fetch(`${API}/api/notifications?limit=10`, { headers: authedHeaders() }),
                    fetch(`${API}/api/notifications/unread-count`, { headers: authedHeaders() })
                ]);
                
                if (notifRes.ok) {
                    const data = await notifRes.json();
                    setNotifications(data);
                }
                if (countRes.ok) {
                    const { count } = await countRes.json();
                    setUnreadCount(count);
                }
            } catch (err) {
                console.error('Fetch notifications error:', err);
            }
        };
        
        fetchNotifications();
        // Poll for new notifications every 30 seconds
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, [user]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setShowUserMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const markAllAsRead = async () => {
        try {
            await fetch(`${API}/api/notifications/mark-all-read`, {
                method: 'POST',
                headers: authedHeaders()
            });
            setUnreadCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
        } catch (err) {
            console.error('Mark all read error:', err);
        }
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <header className="h-20 bg-white shadow-sm border-b border-gray-100 flex items-center justify-between px-8 sticky top-0 z-10">
            <div>
                <h2 className="text-2xl font-semibold text-gray-800 tracking-tight">HealthSync</h2>
            </div>

            <div className="flex items-center gap-6">
                {/* Issue #38: Notification Bell with Dropdown */}
                <div className="relative" ref={dropdownRef}>
                    <button 
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="relative p-2 text-gray-500 hover:text-primary transition-colors rounded-full hover:bg-primary-light/50"
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] text-white font-bold">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Notification Dropdown */}
                    {showNotifications && (
                        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
                            <div className="flex items-center justify-between p-4 border-b border-gray-100">
                                <h3 className="font-bold text-gray-900">Notifications</h3>
                                <div className="flex items-center gap-2">
                                    {unreadCount > 0 && (
                                        <button 
                                            onClick={markAllAsRead}
                                            className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-50 rounded-lg transition-colors"
                                            title="Mark all as read"
                                        >
                                            <CheckCheck size={16} />
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => { setShowNotifications(false); navigate('/notifications/settings'); }}
                                        className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-50 rounded-lg transition-colors"
                                        title="Notification settings"
                                    >
                                        <Settings size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="max-h-80 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="p-8 text-center text-gray-400">
                                        <Bell size={32} className="mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">No notifications yet</p>
                                    </div>
                                ) : (
                                    notifications.map(notif => (
                                        <div 
                                            key={notif.id}
                                            className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${
                                                !notif.read_at ? 'bg-blue-50/50' : ''
                                            }`}
                                        >
                                            <div className="flex gap-3">
                                                <span className="text-xl">{NOTIFICATION_ICONS[notif.type] || '📣'}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 truncate">{notif.title}</p>
                                                    <p className="text-xs text-gray-500 truncate">{notif.message}</p>
                                                    <p className="text-xs text-gray-400 mt-1">{formatTime(notif.sent_at)}</p>
                                                </div>
                                                {!notif.read_at && (
                                                    <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></span>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="p-3 border-t border-gray-100 bg-gray-50">
                                <button 
                                    onClick={() => { setShowNotifications(false); navigate('/notifications/settings'); }}
                                    className="w-full text-center text-sm text-primary font-medium hover:underline"
                                >
                                    Manage notification settings
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="relative" ref={userMenuRef}>
                    <button 
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className="flex items-center gap-3 pl-4 border-l border-gray-200 hover:bg-gray-50 rounded-lg p-2 transition-colors"
                    >
                        <UserCircle size={36} className="text-gray-400" />
                        <div className="hidden md:block text-left">
                            <p className="text-sm font-medium text-gray-700">{name}</p>
                            <p className="text-xs text-gray-500">{roleLabel}</p>
                        </div>
                        <ChevronDown size={16} className={`text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {/* User Menu Dropdown */}
                    {showUserMenu && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                            <div className="p-3 border-b border-gray-100 md:hidden">
                                <p className="text-sm font-medium text-gray-700">{name}</p>
                                <p className="text-xs text-gray-500">{roleLabel}</p>
                            </div>
                            <button 
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-600 hover:bg-red-50 transition-colors"
                            >
                                <LogOut size={18} />
                                <span className="font-medium">Logout</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Navbar;
