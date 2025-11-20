import React, { useState } from 'react'
import client from '../api/index'
import { useNavigate } from 'react-router-dom'

export default function OtpVerification() {
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    try {
      await client.post('/api/auth/verify-otp', { otp })
      setMsg('Verified — redirecting...')
      setTimeout(() => navigate('/dashboard'), 900)
    } catch (err) {
      setMsg(err?.response?.data?.message || err.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-12 bg-white p-6 rounded-lg shadow">
      <h2 className="text-2xl font-semibold mb-4">OTP verification</h2>
      {msg && <div className="mb-4 text-sm text-slate-600">{msg}</div>}
      <form onSubmit={submit} className="space-y-4">
        <input type="text" value={otp} onChange={e => setOtp(e.target.value)} placeholder="Enter OTP"
               className="w-full rounded border-slate-200 p-2" />
        <button type="submit" disabled={loading} className="w-full py-2 rounded bg-sky-600 text-white">
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </form>
    </div>
  )
}
