import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import client from '../api/index';
import { Building, User, Check, ChevronRight, GraduationCap, Stethoscope, Briefcase, Globe } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SetupWizard() {
    const { user, login } = useAuth(); // We might need a way to update user in context, for now we'll just rely on page refresh or simple state if possible
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        organizationType: '',
        organizationName: '', // Optional, for "General" or specific naming
        roleCategory: '',
        department: ''
    });

    useEffect(() => {
        // Check if user needs setup
        // We assume if 'user_category' is missing or 'employee' (default) AND they are just a 'user' role, they might need setup.
        // Or strictly if user_category is null/empty. 
        // Let's assume the backend migration set existing ones to 'employee'. 
        // For NEW users, we want this to show. 
        // Let's rely on a specific check: if user_category is 'employee' (default) but we want them to specify?
        // Or better, let's assume we want to capture this for everyone who hasn't explicitly set it via this wizard.
        // For now, let's show if user_category is 'employee' and they are in 'General' org (id 1 usually, or name 'General').
        // A safer check for this demo: If user_category is 'employee' (the default from registration if not provided)

        if (user && (!user.user_category || user.user_category === 'employee')) {
            // Check if we should show it. 
            // For the demo, let's show it if they haven't completed it.
            // We can use a local storage flag to prevent annoying them, or check a specific DB field.
            // For this phase, let's show it if user_category is 'employee'.
            setIsOpen(true);
        }
    }, [user]);

    const handleNext = () => setStep(step + 1);
    const handleBack = () => setStep(step - 1);

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const res = await client.post('/user/setup', formData);
            if (res.data.success) {
                toast.success('Profile setup complete!');
                setIsOpen(false);

                // PHASE 3: Clean Reset to ensure no old/incompatible tokens persist
                // This forces a fresh login with the new token structure 
                import('../utils/resetSession').then(({ resetSession }) => {
                    resetSession();
                });
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to save profile');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const orgTypes = [
        { id: 'university', label: 'University', icon: GraduationCap, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { id: 'hospital', label: 'Hospital', icon: Stethoscope, color: 'text-red-400', bg: 'bg-red-500/10' },
        { id: 'finance', label: 'Finance', icon: Briefcase, color: 'text-green-400', bg: 'bg-green-500/10' },
        { id: 'general', label: 'General', icon: Globe, color: 'text-gray-400', bg: 'bg-gray-500/10' },
    ];

    const rolesByOrg = {
        university: ['Student', 'Faculty', 'Researcher', 'Admin'],
        hospital: ['Doctor', 'Nurse', 'Administrator', 'Staff'],
        finance: ['Analyst', 'Trader', 'Compliance', 'Manager'],
        general: ['Employee', 'Manager', 'Contractor', 'Other']
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-panel w-full max-w-lg rounded-2xl overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="p-6 border-b border-white/5 bg-premium-black/50">
                    <h2 className="text-2xl font-bold text-white mb-1">Welcome to AntiGravity</h2>
                    <p className="text-gray-400 text-sm">Let's set up your profile to personalize your experience.</p>

                    {/* Progress */}
                    <div className="flex gap-2 mt-4">
                        <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-premium-gold' : 'bg-white/10'}`} />
                        <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-premium-gold' : 'bg-white/10'}`} />
                    </div>
                </div>

                <div className="p-6">
                    {step === 1 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium text-white mb-4">Select Organization Type</h3>
                            <div className="grid grid-cols-1 gap-3">
                                {orgTypes.map((type) => (
                                    <button
                                        key={type.id}
                                        onClick={() => setFormData({ ...formData, organizationType: type.id })}
                                        className={`flex items-center gap-4 p-4 rounded-xl border transition-all text-left group
                                            ${formData.organizationType === type.id
                                                ? 'bg-premium-gold/10 border-premium-gold'
                                                : 'bg-white/5 border-white/5 hover:bg-white/10'
                                            }`}
                                    >
                                        <div className={`p-3 rounded-lg ${type.bg}`}>
                                            <type.icon className={`w-6 h-6 ${type.color}`} />
                                        </div>
                                        <div className="flex-1">
                                            <div className={`font-semibold ${formData.organizationType === type.id ? 'text-premium-gold' : 'text-white'}`}>
                                                {type.label}
                                            </div>
                                        </div>
                                        {formData.organizationType === type.id && (
                                            <Check className="w-5 h-5 text-premium-gold" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-medium text-white mb-4">Select Your Role</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {rolesByOrg[formData.organizationType || 'general'].map((role) => (
                                        <button
                                            key={role}
                                            onClick={() => setFormData({ ...formData, roleCategory: role })}
                                            className={`p-3 rounded-xl border text-sm font-medium transition-all
                                                ${formData.roleCategory === role
                                                    ? 'bg-premium-gold/10 border-premium-gold text-premium-gold'
                                                    : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10'
                                                }`}
                                        >
                                            {role}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-400 mb-2 block">Department (Optional)</label>
                                <input
                                    type="text"
                                    value={formData.department}
                                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                    placeholder="e.g. Engineering, Sales"
                                    className="glass-input w-full px-4 py-2 rounded-lg"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 bg-premium-black/30 flex justify-between">
                    {step > 1 ? (
                        <button
                            onClick={handleBack}
                            className="text-gray-400 hover:text-white transition-colors text-sm font-medium px-4 py-2"
                        >
                            Back
                        </button>
                    ) : (
                        <div></div> // Spacer
                    )}

                    {step < 2 ? (
                        <button
                            onClick={handleNext}
                            disabled={!formData.organizationType}
                            className="btn-primary px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={!formData.roleCategory || loading}
                            className="btn-primary px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Saving...' : 'Complete Setup'}
                            {!loading && <Check className="w-4 h-4" />}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
