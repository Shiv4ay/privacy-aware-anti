import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import OrgSelection from '../components/OrgSelection';

// Simple Error Boundary to catch render crashes
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-red-900 text-white p-4">
                    <div className="max-w-2xl bg-black/50 p-6 rounded-xl border border-red-500">
                        <h1 className="text-3xl font-bold mb-4">Something went wrong 😓</h1>
                        <p className="mb-4 text-gray-300">The application crashed while enforcing the selection screen.</p>

                        <div className="bg-black p-4 rounded text-sm font-mono overflow-auto max-h-64 mb-4 border border-white/10">
                            <p className="text-red-400 font-bold">{this.state.error && this.state.error.toString()}</p>
                            <pre className="text-gray-500 mt-2">{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
                        </div>

                        <button
                            onClick={() => window.location.reload()}
                            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

// Simplified Page - OrgSelection component handles the heavy lifting & redirect
const OrgSelectionPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    // ✅ SUPER ADMIN GUARD: Super admin should never see org selection
    React.useEffect(() => {
        if (user?.role === 'super_admin') {
            console.log('[OrgSelectionPage] Super admin detected, redirecting to /super-admin');
            navigate('/super-admin', { replace: true });
        }
    }, [user, navigate]);

    // Don't render org selection for super admin
    if (user?.role === 'super_admin') {
        return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">Redirecting...</div>;
    }

    return (
        <div className="relative min-h-screen bg-premium-black text-white overflow-hidden font-sans selection:bg-premium-gold/30 selection:text-premium-gold">
            <ErrorBoundary>
                <OrgSelection
                    onSelect={() => { }} // No-op, handled internally
                    onClose={() => { }}  // No-op, cannot close
                />
            </ErrorBoundary>
        </div>
    );
};

export default OrgSelectionPage;
