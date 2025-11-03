# Create Header component
import os

project_name = "Privacy-Aware-RAG"
header_component = """import React from 'react';
import { useDocuments } from '../contexts/DocumentContext';

const Header = () => {
  const { systemHealth } = useDocuments();

  const getHealthStatus = () => {
    if (!systemHealth) return { color: 'bg-gray-400', text: 'Unknown' };
    
    if (systemHealth.status === 'healthy') {
      return { color: 'bg-green-400', text: 'Healthy' };
    } else if (systemHealth.status === 'degraded') {
      return { color: 'bg-yellow-400', text: 'Degraded' };
    } else {
      return { color: 'bg-red-400', text: 'Unhealthy' };
    }
  };

  const healthStatus = getHealthStatus();

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-full mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">🔒</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                Privacy-Aware RAG
              </h1>
            </div>
            <div className="hidden sm:block text-sm text-gray-500">
              Secure Document Processing & Retrieval
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* System Health Indicator */}
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${healthStatus.color}`}></div>
              <span className="text-sm text-gray-600 hidden sm:inline">
                System: {healthStatus.text}
              </span>
            </div>
            
            {/* User Profile Placeholder */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-gray-600 text-sm font-medium">👤</span>
              </div>
              <span className="text-sm text-gray-700 hidden sm:inline">
                Admin
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
"""

# Write Header component
with open(f"{project_name}/frontend/src/components/Header.js", "w") as f:
    f.write(header_component)

print("Created Header component")