import React from 'react';
import { Bell, Search, UserCircle } from 'lucide-react';

const Navbar = ({ title = "Dashboard" }) => {
    return (
        <header className="h-20 bg-white shadow-sm border-b border-gray-100 flex items-center justify-between px-8 sticky top-0 z-10">
            <div>
                <h2 className="text-2xl font-semibold text-gray-800 tracking-tight">{title}</h2>
            </div>

            <div className="flex items-center gap-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search..."
                        className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-primary transition-all w-64"
                    />
                </div>

                <button className="relative p-2 text-gray-500 hover:text-primary transition-colors rounded-full hover:bg-primary-light/50">
                    <Bell size={20} />
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                </button>

                <div className="flex items-center gap-3 cursor-pointer pl-4 border-l border-gray-200">
                    <UserCircle size={36} className="text-gray-400" />
                    <div className="hidden md:block">
                        <p className="text-sm font-medium text-gray-700">John Doe</p>
                        <p className="text-xs text-gray-500">Patient</p>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Navbar;
