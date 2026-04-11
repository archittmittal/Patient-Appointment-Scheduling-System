import React, { useState, useEffect, useRef } from 'react';
import { Bell, UserCircle, X, CheckCheck, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API, authedHeaders } from '../config/api';
import QueueAlertModal from './QueueAlertModal';
import ThemeToggle from './ThemeToggle';

const NOTIFICATION_ICONS = {
    QUEUE_UPDATE: '📊',
    TURN_APPROACHING: '⏰',
    YOUR_TURN: '🔔',
    APPOINTMENT_REMINDER: '📅',
    DELAY_ALERT: '⚠️',
    WAITLIST_OFFER: '🎉',
    CANCELLATION: '❌',
    MISSED: '⚠️',
    GENERAL: '📣'
};

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const name = user ? `${user.first_name} ${user.last_name}`.trim() : '';
    const roleLabel = user?.role ? user.role.charAt(0) + user.role.slice(1).toLowerCase() : '';
    
    const [showNotifications, setShowNotifications] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [activeAlert, setActiveAlert] = useState(null);
    const dropdownRef = useRef(null);
    const userMenuRef = useRef(null);

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
                    
                    const priorityAlerts = data.filter(n => 
                        (n.type === 'YOUR_TURN' || n.type === 'TURN_APPROACHING' || n.type === 'MISSED') && 
                        !n.read_at &&
                        new Date(n.sent_at) > new Date(Date.now() - 5 * 60000)
                    );

                    if (priorityAlerts.length > 0) {
                        const latestAlert = priorityAlerts[0];
                        const seenAlerts = JSON.parse(localStorage.getItem('seen_queue_alerts') || '[]');
                        
                        if (!seenAlerts.includes(latestAlert.id)) {
                            if (typeof latestAlert.data === 'string') {
                                try { latestAlert.data = JSON.parse(latestAlert.data); } catch(e) {}
                            }
                            setActiveAlert(latestAlert);
                        }
                    }
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
        const interval = setInterval(fetchNotifications, 15000);
        return () => clearInterval(interval);
    }, [user]);

    const handleAlertAction = async () => {
        if (!activeAlert) return;
        const seenAlerts = JSON.parse(localStorage.getItem('seen_queue_alerts') || '[]');
        seenAlerts.push(activeAlert.id);
        localStorage.setItem('seen_queue_alerts', JSON.stringify(seenAlerts));

        try {
            await fetch(`${API}/api/notifications/${activeAlert.id}/read`, {
                method: 'POST',
                headers: authedHeaders()
            });
            if (activeAlert.type === 'YOUR_TURN' && activeAlert.data?.appointment_id) {
                navigate(`/virtual-waiting/${activeAlert.data.appointment_id}`);
            }
        } catch (err) {
            console.error('Error handling alert action:', err);
        }
        setActiveAlert(null);
    };

    const handleAlertClose = () => {
        if (activeAlert) {
            const seenAlerts = JSON.parse(localStorage.getItem('seen_queue_alerts') || '[]');
            seenAlerts.push(activeAlert.id);
            localStorage.setItem('seen_queue_alerts', JSON.stringify(seenAlerts));
        }
        setActiveAlert(null);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setShowNotifications(false);
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) setShowUserMenu(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const markAllAsRead = async () => {
        try {
            await fetch(`${API}/api/notifications/mark-all-read`, { method: 'POST', headers: authedHeaders() });
            setUnreadCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
        } catch (err) {
            console.error('Mark all read error:', err);
        }
    };

    return (
        <header className="h-20 bg-[var(--surface)]/80 backdrop-blur-md border-b border-[var(--border-base)] flex items-center justify-between px-8 sticky top-0 z-10 transition-colors duration-300">
            <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-soft bg-clip-text text-transparent tracking-tight">HealthSync</h2>
            </div>

            <div className="flex items-center gap-4">
                <ThemeToggle />
                
                <div className="relative" ref={dropdownRef}>
                    <button 
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="relative p-2.5 text-slate-500 hover:text-primary transition-all rounded-xl hover:bg-primary-light/50 active:scale-95"
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full border-2 border-[var(--surface)] flex items-center justify-center text-[10px] text-white font-bold animate-pulse">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {showNotifications && (
                        <div className="absolute right-0 mt-3 w-80 bg-[var(--surface)] backdrop-blur-xl rounded-2xl shadow-2xl border border-[var(--border-base)] overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between p-4 border-b border-[var(--border-base)]">
                                <h3 className="font-bold text-[var(--text-base)]">Notifications</h3>
                                <div className="flex items-center gap-2">
                                    {unreadCount > 0 && (
                                        <button onClick={markAllAsRead} className="p-1.5 text-slate-400 hover:text-primary rounded-lg transition-colors"><CheckCheck size={16} /></button>
                                    )}
                                    <button onClick={() => { setShowNotifications(false); navigate('/notifications/settings'); }} className="p-1.5 text-slate-400 hover:text-primary rounded-lg transition-colors"><Settings size={16} /></button>
                                </div>
                            </div>

                            <div className="max-h-80 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400">
                                        <Bell size={32} className="mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">No notifications yet</p>
                                    </div>
                                ) : (
                                    notifications.map(notif => (
                                        <div key={notif.id} className={`p-4 border-b border-[var(--border-base)] hover:bg-primary-light/5 transition-colors cursor-pointer ${!notif.read_at ? 'bg-primary-light/10' : ''}`}>
                                            <div className="flex gap-3">
                                                <span className="text-xl">{NOTIFICATION_ICONS[notif.type] || '📣'}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-[var(--text-base)] truncate">{notif.title}</p>
                                                    <p className="text-xs text-slate-500 truncate">{notif.message}</p>
                                                </div>
                                                {!notif.read_at && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></span>}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="relative" ref={userMenuRef}>
                    <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-3 pl-4 border-l border-[var(--border-base)] hover:bg-primary-light/5 rounded-xl p-2 transition-all active:scale-95">
                        <div className="p-1 bg-primary-light/30 rounded-lg">
                            <UserCircle size={28} className="text-primary" />
                        </div>
                        <div className="hidden md:block text-left scale-90 origin-left">
                            <p className="text-sm font-bold text-[var(--text-base)] leading-tight">{name || 'User'}</p>
                            <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">{roleLabel}</p>
                        </div>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${showUserMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {showUserMenu && (
                        <div className="absolute right-0 mt-2 w-48 bg-[var(--surface)] rounded-xl shadow-xl border border-[var(--border-base)] overflow-hidden z-50">
                            <button onClick={handleLogout} className="w-full flex items-center gap-4 px-5 py-4 text-left text-red-600 hover:bg-red-500/10 transition-colors">
                                <LogOut size={18} />
                                <span className="font-bold">Logout</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <QueueAlertModal alert={activeAlert} onClose={handleAlertClose} onAction={handleAlertAction} />
        </header>
    );
};

export default Navbar;
