import React from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Settings() {
  const { user, logout } = useAuth()

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Settings</h2>
      <div className="bg-white p-4 rounded shadow">
        <div className="mb-3"><strong>Account</strong></div>
        <div className="text-slate-700 mb-2">{user?.email || 'No email'}</div>
        <button onClick={logout} className="px-3 py-1 rounded bg-red-500 text-white">Logout</button>
      </div>
    </div>
  )
}
