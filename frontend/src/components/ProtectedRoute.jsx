import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children, roles = [], requireOrg = true }) {
  const { user, loading } = useAuth()
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token')

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Loading...</div>
  }

  if (!token) {
    return <Navigate to="/login" replace />
  }

  // STRICT CHECK: The User Context MUST have an organization
  // If not, we force them to select one.
  // We ignore localStorage for auth decisions - we trust the User Profile (from Token)
  if (requireOrg && user && !user.organization) {
    console.log('[ProtectedRoute] User has no org context. Redirecting to selection.');
    return <Navigate to="/org-select" replace />
  }

  // If we have a token but no user yet, show loading instead of blocking
  if (token && !user) {
    return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Syncing Profile...</div>
  }

  // Check Role Access (Only if user is loaded and exists)
  if (user && roles.length > 0 && !roles.includes(user.role)) {
    // Redirect to dashboard if unauthorized for specific route
    return <Navigate to="/dashboard" replace />
  }

  return children
}
