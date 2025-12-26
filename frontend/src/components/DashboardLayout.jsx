import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function DashboardLayout({ children }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const location = useLocation();
    const isChat = location.pathname === '/chat';

    return (
        <div className="flex h-full w-full overflow-hidden bg-premium-black text-white font-sans selection:bg-premium-gold selection:text-black">
            {/* Sidebar */}
            <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

            {/* Main Content Area */}
            <div
                className={`
          flex-1 flex flex-col h-full transition-all duration-300 ease-in-out
          ${isSidebarOpen ? 'ml-64' : 'ml-20'}
        `}
            >
                {/* Navbar */}
                <Navbar
                    toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                    isSidebarOpen={isSidebarOpen}
                />

                {/* Page Content */}
                <main className={`flex-1 overflow-x-hidden flex flex-col ${isChat ? 'overflow-hidden p-0 sm:p-4' : 'overflow-y-auto p-6'}`}>
                    <div className={`mx-auto animate-fade-in flex-1 flex flex-col w-full h-full ${isChat ? 'max-w-full' : 'max-w-7xl'}`}>
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
