import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import client from '../api/index';
import toast from 'react-hot-toast';

export default function OAuthCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('processing'); // processing, success, error
    const [message, setMessage] = useState('Completing authentication...');

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

            if (response.data.user && response.data.accessToken) {
                // Store authentication data
                localStorage.setItem('accessToken', response.data.accessToken);
                localStorage.setItem('refreshToken', response.data.refreshToken);
                localStorage.setItem('user', JSON.stringify(response.data.user));

                // Set authorization header
                client.defaults.headers.common['Authorization'] = `Bearer ${response.data.accessToken}`;

                setStatus('success');
                setMessage('Login successful! Redirecting...');
                toast.success('Welcome back!');

                // Redirect based on role
                setTimeout(() => {
                    if (response.data.user.role === 'super_admin') {
                        window.location.href = '/super-admin';
                    } else if (!response.data.user.org_id && response.data.user.role !== 'super_admin') {
                        window.location.href = '/org-select';
                    } else {
                        window.location.href = '/dashboard';
                    }
                }, 1500);
            }
        } catch (error) {
            console.error('OAuth callback error:', error);
            setStatus('error');
            setMessage(error.response?.data?.error || 'Authentication failed');
            toast.error('Failed to complete Google login');
            setTimeout(() => navigate('/login'), 2000);
        }
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
