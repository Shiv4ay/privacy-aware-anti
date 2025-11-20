import React, { useState } from 'react'
import client from '../api/index'
import { useNavigate } from 'react-router-dom'

export default function ResetPassword() {
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    try {
      await client.post('/api/auth/reset', { token, password })
      setMsg('Password reset. You can now log in.')
      setTimeout(() => navigate('/login'), 1200)
    } catch (err) {
      setMsg(err?.response?.data?.message || err.message || 'Reset failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-12 bg-white p-6 rounded-lg shadow">
      <h2 className="text-2xl font-semibold mb-4">Reset password</h2>
      {msg && <div className="mb-4 text-sm text-slate-600">{msg}</div>}
      <form onSubmit={submit} className="space-y-4">
        <input type="text" required placeholder="Reset token" value={token} onChange={e => setToken(e.target.value)}
               className="w-full rounded border-slate-200 p-2" />
        <input type="password" required placeholder="New password" value={password} onChange={e => setPassword(e.target.value)}
               className="w-full rounded border-slate-200 p-2" />
        <button type="submit" disabled={loading} className="w-full py-2 rounded bg-sky-600 text-white">
          {loading ? 'Resetting...' : 'Reset password'}
        </button>
      </form>
    </div>
  )
}
