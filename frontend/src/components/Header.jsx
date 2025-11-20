import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">
            PA
          </div>
          <div>
            <Link to="/dashboard" className="text-lg font-semibold text-slate-900 hover:text-blue-600 transition-colors">
              Privacy-Aware RAG
            </Link>
            <div className="text-xs text-slate-500">Secure Document Search</div>
          </div>
        </div>

        <nav className="flex items-center gap-4 text-sm text-slate-600">
          <Link to="/search" className="hover:text-slate-900 transition-colors">Search</Link>
          <Link to="/chat" className="hover:text-slate-900 transition-colors">Chat</Link>
          <Link to="/documents" className="hover:text-slate-900 transition-colors">Documents</Link>
          <Link to="/settings" className="hover:text-slate-900 transition-colors">Settings</Link>
          {user && (
            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gray-200">
              <span className="text-slate-700">
                <span className="hidden sm:inline">Hi, </span>
                <span className="font-medium">{user.name || user.email?.split('@')[0] || 'User'}</span>
              </span>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-xs rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
              >
                Logout
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}
