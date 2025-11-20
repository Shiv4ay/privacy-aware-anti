import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const auth = useAuth()

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await auth.login({ email, password })
      navigate('/dashboard')
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-12 bg-white p-6 rounded-lg shadow">
      <h2 className="text-2xl font-semibold mb-4">Sign in</h2>
      {error && <div className="mb-4 text-sm text-red-600">{error}</div>}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                 className="w-full rounded border-slate-200 shadow-sm focus:ring-1 focus:ring-sky-300 focus:border-sky-400"
                 placeholder="you@example.com" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                 className="w-full rounded border-slate-200 shadow-sm focus:ring-1 focus:ring-sky-300 focus:border-sky-400"
                 placeholder="Your password" />
        </div>
        <button type="submit" disabled={loading}
                className="w-full py-2 px-4 rounded bg-sky-600 text-white font-medium hover:bg-sky-700 disabled:opacity-60">
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <div className="mt-4 text-sm text-slate-600">
        <Link to="/forgot" className="text-sky-600 hover:underline">Forgot password?</Link>
      </div>

      <div className="mt-4 text-sm text-slate-600">
        <span>Don't have an account? </span>
        <Link to="/register" className="text-sky-600 hover:underline">Register</Link>
      </div>
    </div>
  )
}
