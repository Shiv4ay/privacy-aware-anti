import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth() // Assuming useAuth is imported or available
  const token = localStorage.getItem('token')

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Loading...</div>
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />
  }

  return children
}
