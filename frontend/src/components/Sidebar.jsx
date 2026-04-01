import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, User, Calendar, Activity, LogOut, ClipboardList, CalendarDays, Zap, Layers, ClipboardCheck, Route, AlarmClock, MessageSquare, BarChart3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API, authedHeaders } from '../config/api';

const PATIENT_MENU = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/patient-dashboard' },
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

    // Issue #43: Feedback loop automation polling
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
        // Poll every 5 minutes
        const interval = setInterval(checkFeedback, 5 * 60 * 1000); 
        return () => clearInterval(interval);
    }, [user]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="w-68 h-screen bg-white shadow-2xl flex flex-col border-r border-slate-100 flex-shrink-0 z-20">
            <div className="p-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                        <Activity className="text-white" size={24} />
                    </div>
                    <h1 className="text-2xl font-black bg-gradient-to-r from-indigo-600 to-indigo-400 bg-clip-text text-transparent tracking-tight">HealthSync</h1>
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">{ROLE_LABEL[user?.role] || 'Portal'}</p>
            </div>

            <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
                {menuItems.map((item) => (
                    <NavLink
                        key={item.name}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-300 ${isActive
                                ? 'bg-indigo-600 text-white font-bold scale-[1.05] shadow-lg shadow-indigo-600/20'
                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 hover:translate-x-1'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <div className="flex items-center gap-3">
                                    <item.icon size={20} />
                                    <span>{item.name}</span>
                                </div>
                                {item.name === 'Feedback' && pendingFeedbackCount > 0 && (
                                    <span className={`px-2 py-0.5 text-[10px] font-black tracking-wider rounded-full transition-colors ${isActive ? 'bg-white text-indigo-600' : 'bg-red-500 text-white shadow-sm shadow-red-500/30'}`}>
                                        {pendingFeedbackCount}
                                    </span>
                                )}
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-gray-100">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                >
                    <LogOut size={20} />
                    Logout
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
