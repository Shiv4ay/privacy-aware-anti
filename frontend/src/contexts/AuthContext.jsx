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
            // Map org_id to organization for consistency
            const userData = {
              ...res.data.user,
              organization: res.data.user.org_id || res.data.user.organization
            };
            setUser(userData);
            console.log('[AuthContext] User loaded:', userData.email, 'Org:', userData.organization);
          } else if (mounted && res?.data && !res.data.user) {
            // Backend might return user data directly without wrapping in { user }
            const userData = {
              ...res.data,
              organization: res.data.org_id || res.data.organization
            };
            setUser(userData);
            console.log('[AuthContext] User loaded (direct):', userData.email, 'Org:', userData.organization);
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
    const res = await client.post('/auth/login', { email, password });

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

    // Set user state with organization mapping
    const user = {
      ...userData,
      organization: userData.org_id || userData.organization
    };
    setUser(user);
    console.log('[AuthContext] Login successful:', user.email, 'Org:', user.organization);

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
