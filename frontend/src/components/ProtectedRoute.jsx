import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children, roles = [], requireOrg = true }) {
  const { user, loading } = useAuth()
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token')

  console.log('[ProtectedRoute] Check:', {
    loading,
    hasToken: !!token,
    hasUser: !!user,
    userRole: user?.role,
    userOrg: user?.organization,
    requireOrg,
    requiredRoles: roles
  });

  if (loading) {
    console.log('[ProtectedRoute] Still loading auth context...');
    return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Loading...</div>
  }

  if (!token) {
    console.log('[ProtectedRoute] No token found, redirecting to login');
    return <Navigate to="/login" replace />
  }

  // If we have a token but no user yet, show loading instead of redirecting
  if (token && !user) {
    console.log('[ProtectedRoute] Have token but no user yet. AuthContext should be loading...');
    return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Syncing Profile...</div>
  }

  // ✅ SUPER ADMIN BYPASS: Super admin never needs org_id
  if (user?.role === 'super_admin') {
    console.log('[ProtectedRoute] Super admin detected - bypassing org check');
    // Check role-specific access if required
    if (roles.length > 0 && !roles.includes(user.role)) {
      console.log('[ProtectedRoute] Super admin denied access to role-specific route');
      return <Navigate to="/super-admin" replace />
    }
    return children;
  }

  // For non-super-admin users: STRICT CHECK for organization
  if (requireOrg && user && !user.organization) {
    console.log('[ProtectedRoute] User has no org context. Redirecting to selection.');
    return <Navigate to="/org-select" replace />
  }

  // Check Role Access (Only if user is loaded and exists)
  if (user && roles.length > 0 && !roles.includes(user.role)) {
    console.log('[ProtectedRoute] User role', user.role, 'not in required roles:', roles);
    return <Navigate to="/dashboard" replace />
  }

  console.log('[ProtectedRoute] All checks passed, rendering protected content');
  return children
}
