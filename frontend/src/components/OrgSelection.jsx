import React, { useState } from 'react';
import { Check, ChevronRight, GraduationCap, Stethoscope, Briefcase, Globe } from 'lucide-react';
import client from '../api/index';

const OrgSelection = ({ onSelect, onClose }) => {
    // UI State to mimic the Wizard look (hover states etc handled by CSS)
    const [selectedId, setSelectedId] = useState(null);
    const [loading, setLoading] = useState(false);

    const orgTypes = [
        { id: 'university', label: 'University', icon: GraduationCap, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { id: 'hospital', label: 'Hospital', icon: Stethoscope, color: 'text-red-400', bg: 'bg-red-500/10' },
        { id: 'finance', label: 'Finance', icon: Briefcase, color: 'text-green-400', bg: 'bg-green-500/10' },
        { id: 'general', label: 'General', icon: Globe, color: 'text-gray-400', bg: 'bg-gray-500/10' },
    ];

    const handleConfirm = async () => {
        if (selectedId) {
            setLoading(true);
            try {
                // 1. Call Backend to switch context and get new token
                // The new token will contain the organization claim
                const res = await client.post('/session/set-org', { org_id: selectedId });

                if (res.data.token) {
                    console.log('[OrgSelection] Context switched. New Token received.');

                    // 2. CRITICAL: Overwrite the main access token
                    // This creates the "Re-Login" effect
                    localStorage.setItem('accessToken', res.data.token);

                    // Legacy support (just in case)
                    localStorage.setItem('token', res.data.token);
                    localStorage.setItem('active_org', selectedId);

                    // 3. Force a hard reload to reset AuthContext with the new identity
                    // This is the "Clean Slate" approach
                    window.location.href = '/dashboard';
                }
            } catch (err) {
                console.error("Failed to set organization context", err);
                // On error, we stay here. No broken state.
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            {/* Glass Panel Container */}
            <div className="glass-panel w-full max-w-lg rounded-2xl overflow-hidden border border-white/10" style={{ backgroundColor: '#111827' }}>

                {/* Header */}
                <div className="p-6 border-b border-white/5 bg-gray-900">
                    <h2 className="text-2xl font-bold text-white mb-1">Welcome to AntiGravity</h2>
                    <p className="text-gray-400 text-sm">Select an organization context to continue.</p>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-white mb-4">Select Organization Type</h3>
                        <div className="grid grid-cols-1 gap-3">
                            {orgTypes.map((type) => (
                                <button
                                    key={type.id}
                                    onClick={() => setSelectedId(type.id)}
                                    onDoubleClick={() => {
                                        if (!loading) {
                                            setSelectedId(type.id);
                                            handleConfirm();
                                        }
                                    }}
                                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all text-left group
                                        ${selectedId === type.id
                                            ? 'bg-premium-gold/10 border-premium-gold'
                                            : 'bg-white/5 border-white/5 hover:bg-white/10'
                                        }`}
                                >
                                    <div className={`p-3 rounded-lg ${type.bg}`}>
                                        <type.icon className={`w-6 h-6 ${type.color}`} />
                                    </div>
                                    <div className="flex-1">
                                        <div className={`font-semibold ${selectedId === type.id ? 'text-premium-gold' : 'text-white'}`}>
                                            {type.label}
                                        </div>
                                    </div>
                                    {selectedId === type.id && (
                                        <Check className="w-5 h-5 text-premium-gold" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 bg-premium-black/30 flex justify-between items-center">
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors text-sm font-medium px-4 py-2"
                        disabled={loading}
                    >
                        Cancel
                    </button>

                    <button
                        onClick={handleConfirm}
                        disabled={!selectedId || loading}
                        className="btn-primary px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Switching...' : 'Continue'}
                        {!loading && <ChevronRight className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OrgSelection;
