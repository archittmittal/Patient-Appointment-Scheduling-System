import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, User, Calendar, Activity, LogOut, ClipboardList, CalendarDays } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const PATIENT_MENU = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/patient-dashboard' },
    { name: 'Find a Doctor', icon: Users, path: '/doctors' },
    { name: 'Book Appointment', icon: Calendar, path: '/book' },
    { name: 'Live Queue', icon: Activity, path: '/queue' },
    { name: 'Profile', icon: User, path: '/profile' },
];

const DOCTOR_MENU = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/doctor-dashboard' },
    { name: 'Weekly Schedule', icon: CalendarDays, path: '/doctor-schedule' },
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

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="w-64 h-screen bg-white shadow-xl flex flex-col border-r border-gray-100 flex-shrink-0">
            <div className="p-6">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-hover bg-clip-text text-transparent">HealthSync</h1>
                <p className="text-sm text-gray-500 mt-1">{ROLE_LABEL[user?.role] || 'Portal'}</p>
            </div>

            <nav className="flex-1 px-4 space-y-2 mt-4">
                {menuItems.map((item) => (
                    <NavLink
                        key={item.name}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                                ? 'bg-primary-light text-primary font-medium scale-[1.02] shadow-sm'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`
                        }
                    >
                        <item.icon size={20} />
                        {item.name}
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
