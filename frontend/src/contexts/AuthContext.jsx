import React, { createContext, useContext, useEffect, useState } from 'react';
import client from '../api/index';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
        if (token) {
          client.defaults.headers.common['Authorization'] = `Bearer ${token}`;

          // Try to get user profile from /auth/me
          const res = await client.get('/auth/me').catch(() => null);

          if (mounted && res?.data?.user) {
            setUser(res.data.user);
            if (res.data.user.org_id) {
              localStorage.setItem('organization', res.data.user.org_id);
            }
          } else if (mounted && res?.data && !res.data.user) {
            // Backend might return user data directly without wrapping in { user }
            setUser(res.data);
            if (res.data.org_id) {
              localStorage.setItem('organization', res.data.org_id);
            }
          }
        }
      } catch (e) {
        console.error("Auth load error", e);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('token');
        delete client.defaults.headers.common['Authorization'];
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false };
  }, []);

  const login = async (email, password) => {
    console.log('[Auth] Attempting login with fresh credentials:', email);
    const res = await client.post('/simple-auth/login', { email, password });

    // Phase 4 backend returns: { accessToken, refreshToken, user }
    const { accessToken, refreshToken, user: userData } = res.data;

    if (!accessToken) {
      throw new Error('No access token received from server');
    }

    // Store tokens
    localStorage.setItem('accessToken', accessToken);
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }

    // Set authorization header
    client.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

    // Set user state
    setUser(userData);

    // Store organization if present
    if (userData?.org_id) {
      localStorage.setItem('organization', userData.org_id);
    }

    return res.data;
  };

  const logout = async () => {
    try {
      await client.post('/auth/logout');
    } catch (err) {
      console.error('Logout API call failed', err);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('token');
      localStorage.removeItem('organization');
      delete client.defaults.headers.common['Authorization'];
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
