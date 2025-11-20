import React, { useState } from 'react'
import client from '../api/index'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    try {
      await client.post('/api/auth/forgot', { email })
      setMsg('If an account exists, you will receive an email with reset instructions.')
    } catch (err) {
      setMsg(err?.response?.data?.message || err.message || 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-12 bg-white p-6 rounded-lg shadow">
      <h2 className="text-2xl font-semibold mb-4">Forgot password</h2>
      {msg && <div className="mb-4 text-sm text-slate-600">{msg}</div>}
      <form onSubmit={submit} className="space-y-4">
        <input type="email" required placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)}
               className="w-full rounded border-slate-200 p-2" />
        <button type="submit" disabled={loading} className="w-full py-2 rounded bg-sky-600 text-white">
          {loading ? 'Sending...' : 'Send reset link'}
        </button>
      </form>
    </div>
  )
}
