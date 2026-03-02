import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, User, Calendar, Activity, LogOut } from 'lucide-react';

const Sidebar = () => {
    const menuItems = [
        { name: 'Dashboard', icon: LayoutDashboard, path: '/patient-dashboard' },
        { name: 'Find a Doctor', icon: Users, path: '/doctors' },
        { name: 'Book Appointment', icon: Calendar, path: '/book' },
        { name: 'Live Queue', icon: Activity, path: '/queue' },
        { name: 'Profile', icon: User, path: '/profile' }
    ];

    return (
        <div className="w-64 h-screen bg-white shadow-xl flex flex-col border-r border-gray-100 flex-shrink-0">
            <div className="p-6">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-hover bg-clip-text text-transparent">HealthSync</h1>
                <p className="text-sm text-gray-500 mt-1">Patient Portal</p>
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
                <NavLink
                    to="/"
                    className="flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                >
                    <LogOut size={20} />
                    Logout
                </NavLink>
            </div>
        </div>
    );
};

export default Sidebar;
