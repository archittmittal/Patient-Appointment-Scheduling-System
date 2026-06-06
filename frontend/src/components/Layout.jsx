import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const Layout = () => {
    return (
        <div className="flex h-screen bg-(--bg-base) text-(--text-base) transition-colors duration-300 overflow-hidden font-sans relative">
            {/* Ambient Background Blobs for Glass Effect */}
            <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none animate-pulse delay-1000"></div>

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
