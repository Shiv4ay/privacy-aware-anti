import React, { useState } from 'react';

const OrgSelection = ({ onSelect, onClose }) => {
    const organizations = [
        { id: 'university', name: 'University', icon: '🎓' },
        { id: 'hospital', name: 'Hospital', icon: '🏥' },
        { id: 'finance', name: 'Finance', icon: '💰' },
        { id: 'banking', name: 'Banking', icon: '🏦' },
        { id: 'hr', name: 'HR', icon: '👥' },
        { id: 'corporate', name: 'Corporate', icon: '🏢' }
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 max-w-2xl w-full shadow-2xl transform transition-all">
                <h2 className="text-3xl font-bold text-white mb-2 text-center">Select Your Organization</h2>
                <p className="text-gray-400 text-center mb-8">Choose the domain you want to operate in</p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {organizations.map((org) => (
                        <button
                            key={org.id}
                            onClick={() => onSelect(org.id)}
                            className="flex flex-col items-center justify-center p-6 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-blue-500 rounded-lg transition-all duration-200 group"
                        >
                            <span className="text-4xl mb-3 group-hover:scale-110 transition-transform">{org.icon}</span>
                            <span className="text-lg font-medium text-gray-200 group-hover:text-white">{org.name}</span>
                        </button>
                    ))}
                </div>

                <button
                    onClick={onClose}
                    className="mt-8 w-full py-2 text-gray-500 hover:text-white transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default OrgSelection;
