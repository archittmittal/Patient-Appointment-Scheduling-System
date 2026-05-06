import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const Layout = () => {
    return (
        <div className="flex h-screen bg-[#f5f5f7] text-[#1d1d1f] transition-colors duration-300 overflow-hidden font-sans">
            <Sidebar />
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                <Navbar />
                <div className="flex-1 overflow-auto">
                    <div className="max-w-7xl mx-auto p-6 md:p-12">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Layout;
