import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LandingPage() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (loading) return;

        // If no user, go to login
        if (!user) {
            navigate('/login', { replace: true });
            return;
        }

        // ✅ SUPER ADMIN: Route to super admin dashboard
        if (user.role === 'super_admin') {
            navigate('/super-admin', { replace: true });
            return;
        }

        // Regular users: Check if they have org
        if (!user.organization) {
            navigate('/org-select', { replace: true });
        } else {
            navigate('/dashboard', { replace: true });
        }
    }, [user, loading, navigate]);

    // Show loading while determining route
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p>Loading...</p>
            </div>
        </div>
    );
}
