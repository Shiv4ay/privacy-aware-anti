import React, { createContext, useContext, useEffect, useState } from 'react';
import client from '../api/index';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      // ✅ FIX: Don't load tokens if user is on /login page  
      // This prevents old tokens from redirecting users away from login
      const isOnLoginPage = window.location.pathname === '/login';
      if (isOnLoginPage) {
        console.log('[AuthContext] On login page, skipping token load');
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) {
        console.log('[AuthContext] No token found');
        setLoading(false);
        return;
      }

      try {
        // Set authorization header before making the request
        client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const response = await client.get('/auth/me');
        const userData = response.data.user;

        console.log('[AuthContext] User loaded:', userData.email, 'Org:', userData.organization);

        setUser({
          userId: userData.userId,
          username: userData.username,
          email: userData.email,
          role: userData.role,
          // Map org_id to organization for consistency
          organization: userData.organization || userData.org_id
        });
      } catch (error) {
        console.error('[AuthContext] Failed to load user:', error.message);
        // Clear invalid token
        localStorage.removeItem('accessToken');
        localStorage.removeItem('token');
        delete client.defaults.headers.common['Authorization']; // Clear header on error
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
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
