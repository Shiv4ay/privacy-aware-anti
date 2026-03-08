import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, Building2, Check, ArrowRight } from 'lucide-react';
import client from '../api/index';
import toast from 'react-hot-toast';

export default function OAuthCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('processing'); // processing, success, error, org_select
    const [message, setMessage] = useState('Completing authentication...');

    // Multi-org state
    const [availableOrgs, setAvailableOrgs] = useState([]);
    const [selectedOrgId, setSelectedOrgId] = useState(null);
    const [tempUser, setTempUser] = useState(null);
    const [googleToken, setGoogleToken] = useState(null);
    const [selectLoading, setSelectLoading] = useState(false);

    useEffect(() => {
        handleOAuthCallback();
    }, []);

    const handleOAuthCallback = async () => {
        try {
            const code = searchParams.get('code');
            const error = searchParams.get('error');

            if (error) {
                setStatus('error');
                setMessage('Authentication cancelled or failed');
                toast.error('Google login cancelled');
                setTimeout(() => navigate('/login'), 2000);
                return;
            }

            if (!code) {
                setStatus('error');
                setMessage('Invalid authentication response');
                setTimeout(() => navigate('/login'), 2000);
                return;
            }

            // Exchange code for tokens via backend
            const response = await client.post('/auth/google/callback', { code });

            // Check if multi-org selection is required
            if (response.data.requiresOrgSelection) {
                setStatus('org_select');
                setMessage('Select which organization to access');
                setAvailableOrgs(response.data.organizations);
                setTempUser(response.data.tempUser);
                setGoogleToken(response.data.googleAccessToken);
                toast.success('Please select your organization');
                return;
            }

            if (response.data.user && response.data.accessToken) {
                completeLogin(response.data);
            }
        } catch (error) {
            console.error('OAuth callback error:', error);
            setStatus('error');
            setMessage(error.response?.data?.error || 'Authentication failed');
            toast.error('Failed to complete Google login');
            setTimeout(() => navigate('/login'), 2000);
        }
    };

    const handleOrgSelect = async () => {
        if (!selectedOrgId || !googleToken) return;

        setSelectLoading(true);
        try {
            // Re-call the callback with the selected org_id and Google Access Token
            const response = await client.post('/auth/google/callback', {
                google_access_token: googleToken,
                org_id: selectedOrgId
            });

            if (response.data.user && response.data.accessToken) {
                completeLogin(response.data);
            } else {
                setStatus('error');
                setMessage('Failed to complete organization login');
            }
        } catch (error) {
            console.error('Org selection error:', error);
            setStatus('error');
            setMessage(error.response?.data?.error || 'Failed to select organization');
            toast.error('Failed to complete login');
        } finally {
            setSelectLoading(false);
        }
    };

    const completeLogin = (data) => {
        // Store authentication data
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.user));

        if (data.user.org_id) {
            localStorage.setItem('active_org', String(data.user.org_id));
        }

        // Set authorization header
        client.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;

        setStatus('success');
        setMessage('Login successful! Redirecting...');
        toast.success('Welcome back!');

        // Redirect based on role
        setTimeout(() => {
            if (data.user.role === 'super_admin') {
                window.location.href = '/super-admin';
            } else if (!data.user.org_id && data.user.role !== 'super_admin') {
                window.location.href = '/org-select';
            } else {
                window.location.href = '/dashboard';
            }
        }, 1500);
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-premium-black">
            <div className="glass-panel p-8 rounded-2xl shadow-2xl w-full max-w-md text-center">
                {status === 'processing' && (
                    <>
                        <Loader2 className="w-16 h-16 mx-auto mb-4 text-premium-gold animate-spin" />
                        <h2 className="text-2xl font-bold text-white mb-2">Authenticating</h2>
                        <p className="text-gray-400">{message}</p>
                    </>
                )}

                {status === 'org_select' && (
                    <>
                        <Building2 className="w-16 h-16 mx-auto mb-4 text-premium-gold" />
                        <h2 className="text-2xl font-bold text-white mb-2">Select Organization</h2>
                        <p className="text-gray-400 mb-6">{message}</p>

                        <div className="space-y-3 mb-6 text-left">
                            {availableOrgs.map((org) => (
                                <button
                                    key={org.id}
                                    onClick={() => setSelectedOrgId(org.id)}
                                    className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left
                                        ${selectedOrgId === org.id
                                            ? 'bg-premium-gold/10 border-premium-gold'
                                            : 'bg-white/5 border-white/5 hover:bg-white/10'
                                        }`}
                                >
                                    <div className={`p-3 rounded-lg ${selectedOrgId === org.id ? 'bg-premium-gold/20' : 'bg-white/5'}`}>
                                        <Building2 className={`w-5 h-5 ${selectedOrgId === org.id ? 'text-premium-gold' : 'text-gray-400'}`} />
                                    </div>
                                    <div className="flex-1">
                                        <div className={`font-semibold ${selectedOrgId === org.id ? 'text-premium-gold' : 'text-white'}`}>
                                            {org.name}
                                        </div>
                                        {org.type && <div className="text-xs text-gray-500 mt-0.5">{org.type}</div>}
                                    </div>
                                    {selectedOrgId === org.id && (
                                        <Check className="w-5 h-5 text-premium-gold" />
                                    )}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={handleOrgSelect}
                            disabled={!selectedOrgId || selectLoading}
                            className="w-full btn-primary py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {selectLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue'}
                            {!selectLoading && <ArrowRight className="w-5 h-5" />}
                        </button>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
                        <h2 className="text-2xl font-bold text-white mb-2">Success!</h2>
                        <p className="text-gray-400">{message}</p>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
                        <h2 className="text-2xl font-bold text-white mb-2">Authentication Failed</h2>
                        <p className="text-gray-400">{message}</p>
                    </>
                )}
            </div>
        </div>
    );
}
