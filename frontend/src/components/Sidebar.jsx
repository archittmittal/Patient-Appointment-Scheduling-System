import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
    LayoutDashboard, Users, User, Calendar, Activity, LogOut, 
    ClipboardList, CalendarDays,
    Route, MessageSquare, BarChart3, Pill, LineChart,
    ChevronRight, Sparkles, HeartPulse, FileText, Search, Shield, ArrowRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/apiClient';

const PATIENT_MENU = [
    { name: 'Overview', icon: LayoutDashboard, path: '/patient-dashboard' },
    { name: 'Health Hub', icon: LineChart, path: '/vitals' },
    { name: 'Medications', icon: Pill, path: '/prescriptions' },
    { name: 'Find Doctors', icon: Search, path: '/doctors' },
    { name: 'Book Visit', icon: Calendar, path: '/book' },
    { name: 'Live Queue', icon: HeartPulse, path: '/queue' },
    { name: 'Multi-Doctor', icon: Route, path: '/multi-doctor' },
    { name: 'Insurance', icon: Shield, path: '/insurance' },
    { name: 'Feedback', icon: MessageSquare, path: '/feedback' },
    { name: 'Messages', icon: MessageSquare, path: '/messages' },
    { name: 'My Profile', icon: User, path: '/profile' },
];

const DOCTOR_MENU = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/doctor-dashboard' },
    { name: 'My Schedule', icon: CalendarDays, path: '/doctor-schedule' },
    { name: 'Messages', icon: MessageSquare, path: '/messages' },
    { name: 'Intelligence', icon: Sparkles, path: '/doctor-analytics' },
    { name: 'Feedback', icon: MessageSquare, path: '/doctor-feedback' },
    { name: 'Profile', icon: User, path: '/doctor-profile' },
];

const ADMIN_MENU = [
    { name: 'Admin Hub', icon: LayoutDashboard, path: '/admin-dashboard' },
    { name: 'Users Control', icon: Users, path: '/admin-users' },
    { name: 'Appointment Log', icon: ClipboardList, path: '/admin-appointments' },
    { name: 'Insurance Portal', icon: Shield, path: '/admin/insurance' },
];

const ROLE_MENU = { PATIENT: PATIENT_MENU, DOCTOR: DOCTOR_MENU, ADMIN: ADMIN_MENU };
const GUEST_MENU = [
    { name: 'Find Doctors', icon: Search, path: '/doctors' },
    { name: 'Book Visit', icon: Calendar, path: '/book' },
];
const ROLE_LABEL = { PATIENT: 'Patient Portal', DOCTOR: 'Medical Portal', ADMIN: 'System Control' };
const ROLE_COLOR = { PATIENT: 'text-patient', DOCTOR: 'text-doctor', ADMIN: 'text-admin' };
const ROLE_BG = { PATIENT: 'bg-patient', DOCTOR: 'bg-doctor', ADMIN: 'bg-admin' };
const ROLE_BORDER = { PATIENT: 'border-patient/10', DOCTOR: 'border-doctor/10', ADMIN: 'border-admin/10' };
const ROLE_SHADOW = { PATIENT: 'shadow-patient/20', DOCTOR: 'shadow-doctor/20', ADMIN: 'shadow-admin/20' };
const ROLE_ACCENT_BG = { PATIENT: 'bg-patient/5', DOCTOR: 'bg-doctor/5', ADMIN: 'bg-admin/5' };

const Sidebar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const menuItems = user ? (ROLE_MENU[user.role] || []) : GUEST_MENU;
    const [pendingFeedbackCount, setPendingFeedbackCount] = useState(0);

    useEffect(() => {
        if (!user || user.role !== 'PATIENT') return;

        const checkFeedback = async () => {
            try {
                const data = await apiClient.get('/api/feedback/pending');
                if (data && !data.error) {
                    setPendingFeedbackCount(Array.isArray(data) ? data.length : 0);
                }
            } catch (err) {
                console.error('Failed to poll feedback', err);
            }
        };

        checkFeedback();
        const interval = setInterval(checkFeedback, 5 * 60 * 1000); 
        return () => clearInterval(interval);
    }, [user]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <aside className="w-72 h-screen bg-[var(--glass-bg-val)] backdrop-blur-xl flex flex-col border-r border-[var(--glass-border-val)] flex-shrink-0 z-20 transition-all duration-300">
            {/* Header / Brand */}
            <div className="p-8 pb-4">
                <div className="flex items-center gap-3 mb-10 group cursor-pointer" onClick={() => navigate('/')}>
                    <div className={`w-10 h-10 ${ROLE_BG[user?.role] || 'bg-primary'} rounded-xl flex items-center justify-center shadow-lg ${ROLE_SHADOW[user?.role] || 'shadow-primary/20'} group-hover:scale-110 transition-all`}>
                        <Activity className="text-white" size={20} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xl font-bold tracking-tight text-slate-900 leading-none">HealthSync</span>
                        <span className={`text-[9px] font-black uppercase tracking-[0.2em] mt-1 ${ROLE_COLOR[user?.role] || 'text-primary'}`}>
                            {ROLE_LABEL[user?.role] || 'Universal'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const roleColor = ROLE_COLOR[user?.role] || 'text-primary';
                    const roleAccentBg = ROLE_ACCENT_BG[user?.role] || 'bg-primary/5';
                    
                    return (
                        <NavLink
                            key={item.name}
                            to={item.path}
                            className={`flex items-center justify-between px-5 py-3.5 rounded-2xl transition-all duration-300 group relative ${
                                isActive
                                    ? `${roleAccentBg} ${roleColor} font-bold shadow-sm`
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                        >
                            <div className="flex items-center gap-4 relative z-10">
                                <item.icon 
                                    size={18} 
                                    strokeWidth={isActive ? 2.5 : 1.5} 
                                    className={`transition-all duration-300 ${isActive ? roleColor + ' scale-110' : 'text-slate-400 group-hover:text-slate-600'}`} 
                                />
                                <span className={`text-[13px] tracking-tight transition-all ${isActive ? 'translate-x-1' : ''}`}>{item.name}</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                {item.name === 'Feedback' && pendingFeedbackCount > 0 && (
                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full animate-bounce ${isActive ? (ROLE_BG[user?.role] || 'bg-primary') + ' text-white' : 'bg-red-500 text-white shadow-md shadow-red-200'}`}>
                                        {pendingFeedbackCount}
                                    </span>
                                )}
                                {isActive && <ChevronRight size={14} className={`${roleColor} opacity-40 animate-in slide-in-from-left-2 duration-300`} />}
                            </div>

                            {isActive && (
                                <div className={`absolute left-0 w-1 h-6 ${ROLE_BG[user?.role] || 'bg-primary'} rounded-r-full animate-in slide-in-from-left-4 duration-500`} />
                            )}
                        </NavLink>
                    );
                })}
            </nav>

            {/* User Section & Footer */}
            <div className="p-4 mt-auto">
                {user ? (
                    <>
                        <div className="p-4 glass-card rounded-3xl mb-4 group transition-all hover:shadow-xl hover:shadow-primary/10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[var(--bg-base)]/50 backdrop-blur-md rounded-2xl flex items-center justify-center border border-[var(--glass-border-val)] shadow-sm overflow-hidden">
                                    <img 
                                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.first_name + ' ' + user?.last_name)}&background=ffffff&color=0071e3&bold=true`} 
                                        alt="User" 
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-bold text-slate-900 truncate">{user?.first_name} {user?.last_name}</p>
                                    <p className="text-[10px] text-slate-500 font-medium truncate">Medical ID: #HS-{user?.id?.toString().padStart(4, '0')}</p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-6 py-4 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all text-sm font-bold group"
                        >
                            <LogOut size={18} strokeWidth={2} className="group-hover:-translate-x-1 transition-transform" />
                            <span>Sign Out</span>
                            <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                    </>
                ) : (
                    <div className="space-y-3">
                        <div className="p-6 bg-primary/5 rounded-[2rem] border border-primary/10 text-center">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
                                <User size={24} className="text-primary/40" />
                            </div>
                            <p className="text-xs font-bold text-slate-900">Guest Patient</p>
                            <p className="text-[10px] text-slate-500 mt-1">Sign in to sync your data</p>
                        </div>
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-primary text-white rounded-2xl transition-all text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-[0.98]"
                        >
                            <span>Sign In</span>
                            <ArrowRight size={16} />
                        </button>
                    </div>
                )}
                
                <p className="text-[9px] text-center text-slate-300 font-bold uppercase tracking-widest mt-6">
                    HealthSync v2.4.0
                </p>
            </div>
        </aside>
    );
};

export default Sidebar;
