import React, { useState, useEffect, useRef } from 'react';
import { Bell, UserCircle, X, CheckCheck, Settings, LogOut, ChevronDown, Activity, Sparkles } from 'lucide-react';
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
    
    const ROLE_PORTAL_LABEL = { PATIENT: 'Patient Portal', DOCTOR: 'Medical Portal', ADMIN: 'System Control' };
    const ROLE_COLOR = { PATIENT: 'text-patient', DOCTOR: 'text-doctor', ADMIN: 'text-admin' };
    const ROLE_BG = { PATIENT: 'bg-patient', DOCTOR: 'bg-doctor', ADMIN: 'bg-admin' };
    const ROLE_SHADOW = { PATIENT: 'shadow-patient/20', DOCTOR: 'shadow-doctor/20', ADMIN: 'shadow-admin/20' };
    const ROLE_AVATAR_COLOR = { PATIENT: '0071e3', DOCTOR: '0f766e', ADMIN: '6d28d9' };
    
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
        <header className="glass-nav sticky top-0 z-50 px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate(user ? (user.role === 'DOCTOR' ? '/doctor-dashboard' : (user.role === 'ADMIN' ? '/admin-dashboard' : '/patient-dashboard')) : '/doctors')}>
                <div className={`w-10 h-10 ${ROLE_BG[user?.role] || 'bg-primary'} rounded-2xl flex items-center justify-center shadow-lg ${ROLE_SHADOW[user?.role] || 'shadow-primary/20'} group-hover:scale-105 transition-all duration-300`}>
                    <Activity className="text-white" size={20} />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight leading-none">HealthSync</h2>
                    <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${ROLE_COLOR[user?.role] || 'text-primary/60'}`}>
                        {user ? ROLE_PORTAL_LABEL[user.role] : 'Patient Care'}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-1 bg-slate-100/50 p-1 rounded-full border border-slate-200/50">
                    <ThemeToggle />
                </div>
                
                <div className="h-6 w-px bg-slate-200 mx-1" />

                {user ? (
                    <>
                        <div className="relative" ref={dropdownRef}>
                            <button 
                                onClick={() => setShowNotifications(!showNotifications)}
                                className={`relative p-2.5 transition-all rounded-full hover:bg-slate-100 ${showNotifications ? 'text-primary bg-slate-100' : 'text-slate-500'}`}
                            >
                                <Bell size={20} strokeWidth={1.5} />
                                {unreadCount > 0 && (
                                    <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white shadow-sm animate-pulse" />
                                )}
                            </button>

                            {showNotifications && (
                                <div className="absolute right-0 mt-4 w-80 bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                                        <h3 className="font-bold text-slate-900">Notifications</h3>
                                        <div className="flex items-center gap-1">
                                            {unreadCount > 0 && (
                                                <button onClick={markAllAsRead} className="p-2 text-slate-400 hover:text-primary rounded-full hover:bg-white shadow-sm transition-all" title="Mark all as read">
                                                    <CheckCheck size={16} />
                                                </button>
                                            )}
                                            <button onClick={() => { setShowNotifications(false); navigate('/profile'); }} className="p-2 text-slate-400 hover:text-primary rounded-full hover:bg-white shadow-sm transition-all" title="Settings">
                                                <Settings size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="max-h-96 overflow-y-auto custom-scrollbar">
                                        {notifications.length === 0 ? (
                                            <div className="p-12 text-center text-slate-400">
                                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <Bell size={32} strokeWidth={1} className="opacity-20" />
                                                </div>
                                                <p className="text-sm font-bold text-slate-900">All caught up</p>
                                                <p className="text-xs mt-1">We'll notify you of any updates.</p>
                                            </div>
                                        ) : (
                                            notifications.map(notif => (
                                                <div key={notif.id} className={`p-5 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer flex gap-4 items-start ${!notif.read_at ? 'bg-primary/5' : ''}`}>
                                                    <span className="text-2xl flex-shrink-0">{NOTIFICATION_ICONS[notif.type] || '📣'}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start gap-2">
                                                            <p className="text-[13px] font-bold text-slate-900 truncate">{notif.title}</p>
                                                            {!notif.read_at && <span className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0 mt-1.5"></span>}
                                                        </div>
                                                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed font-medium">{notif.message}</p>
                                                        <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase tracking-wider">
                                                            {new Date(notif.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="relative" ref={userMenuRef}>
                            <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-3 pl-3 pr-1 hover:bg-slate-100 rounded-full p-1 transition-all border border-transparent hover:border-slate-200">
                                <div className="text-right hidden sm:block">
                                    <p className="text-[11px] font-bold text-slate-900 leading-none">{user?.first_name}</p>
                                    <p className={`text-[9px] font-bold uppercase tracking-wider mt-1 ${ROLE_COLOR[user?.role] || 'text-slate-500'}`}>{ROLE_PORTAL_LABEL[user?.role] || roleLabel}</p>
                                </div>
                                <div className={`w-9 h-9 ${ROLE_BG[user?.role] || 'bg-primary'}/10 rounded-full flex items-center justify-center overflow-hidden border-2 border-white shadow-sm`}>
                                    <img 
                                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ffffff&color=${ROLE_AVATAR_COLOR[user?.role] || '0071e3'}&bold=true`} 
                                        alt="User" 
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 mr-1 ${showUserMenu ? 'rotate-180' : ''}`} />
                            </button>

                            {showUserMenu && (
                                <div className="absolute right-0 mt-4 w-60 bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="px-5 py-4 border-b border-slate-100 mb-2 bg-slate-50/50 rounded-2xl mx-1">
                                        <p className="text-sm font-bold text-slate-900 truncate">{name}</p>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{user?.email}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <button onClick={() => { setShowUserMenu(false); navigate('/profile'); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 rounded-2xl transition-colors font-medium group">
                                            <UserCircle size={18} strokeWidth={1.5} className="group-hover:text-primary transition-colors" />
                                            <span>Personal Profile</span>
                                        </button>
                                        <button onClick={() => { setShowUserMenu(false); navigate('/vitals'); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 rounded-2xl transition-colors font-medium group">
                                            <Activity size={18} strokeWidth={1.5} className="group-hover:text-primary transition-colors" />
                                            <span>Health Records</span>
                                        </button>
                                        <div className="h-px bg-slate-100 my-1 mx-2" />
                                        <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-rose-600 hover:bg-rose-50 rounded-2xl transition-colors font-bold group">
                                            <LogOut size={18} strokeWidth={1.5} className="group-hover:scale-110 transition-transform" />
                                            <span>Sign Out</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => navigate('/login')}
                            className="hidden sm:block text-sm font-bold text-slate-500 hover:text-primary transition-all px-4 py-2"
                        >
                            Sign In
                        </button>
                        <button 
                            onClick={() => navigate('/register')}
                            className="btn-primary py-2.5 px-6 text-[11px] font-black uppercase tracking-widest shadow-xl shadow-primary/20"
                        >
                            Create Account
                        </button>
                    </div>
                )}
            </div>

            <QueueAlertModal alert={activeAlert} onClose={handleAlertClose} onAction={handleAlertAction} />
        </header>
    );
};

export default Navbar;
