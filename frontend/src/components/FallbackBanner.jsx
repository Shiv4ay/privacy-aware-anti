import React, { useState, useEffect } from 'react';
import axios from 'axios';

const FallbackBanner = () => {
    const [status, setStatus] = useState(null);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const token = localStorage.getItem('token');
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                // Note: model-status endpoint might be public or protected. 
                // If protected, we need token. If public, we don't.
                // Assuming public or we have token.
                const response = await axios.get('http://localhost:3001/api/model-status', { headers });
                setStatus(response.data);
            } catch (error) {
                console.error('Failed to fetch model status', error);
            }
        };

        fetchStatus();
        const interval = setInterval(fetchStatus, 30000); // Poll every 30s

        return () => clearInterval(interval);
    }, []);

    if (!status || !status.using_fallback) {
        return null;
    }

    return (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
            <div className="flex items-center">
                <div className="py-1">
                    <svg className="fill-current h-6 w-6 text-yellow-500 mr-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm12.73-1.41A8 8 0 1 0 4.34 4.34a8 8 0 0 0 11.32 11.32zM9 11V9h2v6H9v-4zm0-6h2v2H9V5z" />
                    </svg>
                </div>
                <div>
                    <p className="font-bold">⚠ Using Offline AI Model</p>
                    <p className="text-sm">OpenAI is unreachable. Using local fallback model ({status.local_model}).</p>
                </div>
            </div>
        </div>
    );
};

export default FallbackBanner;
