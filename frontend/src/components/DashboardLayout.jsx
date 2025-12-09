import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import SetupWizard from './SetupWizard';

export default function DashboardLayout({ children }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    return (
        <div className="flex min-h-screen bg-premium-black text-white font-sans selection:bg-premium-gold selection:text-black">
            {/* Sidebar */}
            <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

            {/* Main Content Area */}
            <div
                className={`
          flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out
          ${isSidebarOpen ? 'ml-64' : 'ml-20'}
        `}
            >
                {/* Navbar */}
                <Navbar
                    toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                    isSidebarOpen={isSidebarOpen}
                />

                {/* Page Content */}
                <main className="flex-1 p-6 overflow-x-hidden">
                    <div className="max-w-7xl mx-auto animate-fade-in">
                        {children}
                    </div>
                </main>
                <SetupWizard />
            </div>
        </div>
    );
}
