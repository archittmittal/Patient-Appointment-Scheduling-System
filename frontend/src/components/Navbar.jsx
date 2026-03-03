import React from 'react';
import { Bell, UserCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
    const { user } = useAuth();
    const name = user ? `${user.first_name} ${user.last_name}`.trim() : '';
    const roleLabel = user?.role ? user.role.charAt(0) + user.role.slice(1).toLowerCase() : '';

    return (
        <header className="h-20 bg-white shadow-sm border-b border-gray-100 flex items-center justify-between px-8 sticky top-0 z-10">
            <div>
                <h2 className="text-2xl font-semibold text-gray-800 tracking-tight">HealthSync</h2>
            </div>

            <div className="flex items-center gap-6">
                <button className="relative p-2 text-gray-500 hover:text-primary transition-colors rounded-full hover:bg-primary-light/50">
                    <Bell size={20} />
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                </button>

                <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                    <UserCircle size={36} className="text-gray-400" />
                    <div className="hidden md:block">
                        <p className="text-sm font-medium text-gray-700">{name}</p>
                        <p className="text-xs text-gray-500">{roleLabel}</p>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Navbar;
