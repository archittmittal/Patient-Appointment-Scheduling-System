import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, User, Calendar, Activity, LogOut, ClipboardList, CalendarDays, Zap, Layers, ClipboardCheck, Route, AlarmClock, MessageSquare, BarChart3, Pill, LineChart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API, authedHeaders } from '../config/api';

const PATIENT_MENU = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/patient-dashboard' },
    { name: 'Health Hub', icon: LineChart, path: '/vitals' },
    { name: 'Prescriptions', icon: Pill, path: '/prescriptions' },
    { name: 'Find a Doctor', icon: Users, path: '/doctors' },
    { name: 'Book Appointment', icon: Calendar, path: '/book' },
    { name: 'Express Check-in', icon: Zap, path: '/express-checkin' },
    { name: 'Batch Appointments', icon: Layers, path: '/batch-appointments' },
    { name: 'Prep Checklist', icon: ClipboardCheck, path: '/prep-checklist' },
    { name: 'Multi-Doctor', icon: Route, path: '/multi-doctor' },
    { name: 'Live Queue', icon: Activity, path: '/queue' },
    { name: 'Late Arrival Help', icon: AlarmClock, path: '/late-arrival' },
    { name: 'Feedback', icon: MessageSquare, path: '/feedback' },
    { name: 'Profile', icon: User, path: '/profile' },
];

const DOCTOR_MENU = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/doctor-dashboard' },
    { name: 'Weekly Schedule', icon: CalendarDays, path: '/doctor-schedule' },
    { name: 'Feedback Analytics', icon: BarChart3, path: '/doctor-feedback' },
    { name: 'My Profile', icon: User, path: '/doctor-profile' },
];

const ADMIN_MENU = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/admin-dashboard' },
    { name: 'Manage Users', icon: Users, path: '/admin-users' },
    { name: 'All Appointments', icon: ClipboardList, path: '/admin-appointments' },
];

const ROLE_MENU = { PATIENT: PATIENT_MENU, DOCTOR: DOCTOR_MENU, ADMIN: ADMIN_MENU };
const ROLE_LABEL = { PATIENT: 'Patient Portal', DOCTOR: 'Doctor Portal', ADMIN: 'Admin Panel' };

const Sidebar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const menuItems = ROLE_MENU[user?.role] || [];
    const [pendingFeedbackCount, setPendingFeedbackCount] = useState(0);

    useEffect(() => {
        if (!user || user.role !== 'PATIENT') return;

        const checkFeedback = async () => {
            try {
                const res = await fetch(`${API}/api/feedback/pending`, { headers: authedHeaders() });
                if (res.ok) {
                    const data = await res.json();
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
        <div className="w-68 h-screen bg-[var(--surface)] shadow-2xl flex flex-col border-r border-[var(--border-base)] flex-shrink-0 z-20 transition-colors duration-300">
            <div className="p-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                        <Activity className="text-white" size={24} />
                    </div>
                    <h1 className="text-2xl font-black bg-gradient-to-r from-primary to-primary-soft bg-clip-text text-transparent tracking-tight">HealthSync</h1>
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">{ROLE_LABEL[user?.role] || 'Portal'}</p>
            </div>

            <nav className="flex-1 px-4 space-y-2 mt-2 overflow-y-auto">
                {menuItems.map((item) => (
                    <NavLink
                        key={item.name}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-300 ${isActive
                                ? 'bg-primary text-white font-bold scale-[1.05] shadow-lg shadow-primary/20'
                                : 'text-slate-500 hover:bg-primary-light/5 hover:text-primary hover:translate-x-1'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <div className="flex items-center gap-3">
                                    <item.icon size={20} />
                                    <span className="text-sm">{item.name}</span>
                                </div>
                                {item.name === 'Feedback' && pendingFeedbackCount > 0 && (
                                    <span className={`px-2 py-0.5 text-[10px] font-black tracking-wider rounded-full transition-colors ${isActive ? 'bg-white text-primary' : 'bg-red-500 text-white shadow-sm shadow-red-500/30'}`}>
                                        {pendingFeedbackCount}
                                    </span>
                                )}
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-[var(--border-base)]">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-500/10 rounded-xl transition-colors font-semibold"
                >
                    <LogOut size={20} />
                    <span>Logout</span>
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
