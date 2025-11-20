import React, { createContext, useContext, useEffect, useState } from 'react'
import client from '../api/index'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const token = localStorage.getItem('token')
        if (token) {
          const res = await client.get('/api/auth/me').catch(() => null)
          if (mounted && res && res.data) setUser(res.data)
        }
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const login = async ({ email, password }) => {
    const res = await client.post('/api/auth/login', { email, password })
    const token = res?.data?.token || res?.data?.accessToken || null
    if (!token) throw new Error('No token returned')
    localStorage.setItem('token', token)
    const profileRes = await client.get('/api/auth/me').catch(() => null)
    if (profileRes && profileRes.data) setUser(profileRes.data)
    return token
  }

  const register = async ({ name, email, password }) => {
    const res = await client.post('/api/auth/register', { name, email, password })
    const token = res?.data?.token || res?.data?.accessToken || null
    if (token) {
      localStorage.setItem('token', token)
      const profileRes = await client.get('/api/auth/me').catch(() => null)
      if (profileRes && profileRes.data) setUser(profileRes.data)
      return token
    }
    return res
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
