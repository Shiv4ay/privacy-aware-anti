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
          // Set default header for all requests
          client.defaults.headers.common['Authorization'] = `Bearer ${token}`

          const res = await client.get('/auth/me').catch(() => null)
          if (mounted && res && res.data) {
            setUser(res.data)
            // Ensure organization is persisted/synced if needed
            if (res.data.organization) {
              localStorage.setItem('organization', res.data.organization)
            }
          }
        }
      } catch (e) {
        console.error("Auth load error", e)
        localStorage.removeItem('token')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const login = async (userData, token) => {
    // If token is provided directly (e.g. from Login component after API call)
    if (token) {
      localStorage.setItem('token', token)
      client.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }

    if (userData) {
      setUser(userData)
      if (userData.organization) {
        localStorage.setItem('organization', userData.organization)
      }
    } else {
      // Fetch user if not provided
      const res = await client.get('/auth/me')
      setUser(res.data)
    }
  }

  const register = async (data) => {
    // Registration usually returns token, handled in component or here
    // For now, we'll let the component handle the API call and use login() to set state
    // This keeps it consistent with the Login component flow
    pass
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('organization')
    delete client.defaults.headers.common['Authorization']
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
