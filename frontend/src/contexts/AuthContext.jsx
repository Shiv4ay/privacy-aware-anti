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
          organization: userData.organization || userData.org_id,
          organization_type: userData.organization_type
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

    // Handle MFA Required state
    if (res.data.mfaRequired) {
      console.log('[Auth] MFA Required for:', email);
      return { mfaRequired: true, mfaToken: res.data.mfaToken };
    }

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
    const userObj = {
      ...userData,
      organization: userData.org_id || userData.organization,
      organization_type: userData.organization_type
    };
    setUser(userObj);
    console.log('[AuthContext] Login successful:', userObj.email, 'Org:', userObj.organization);

    return { ...res.data, user: userObj };
  };

  const verifyMFA = async (otp, mfaToken) => {
    console.log('[Auth] Attempting MFA verification');
    const res = await client.post('/auth/mfa/authenticate', { otp, mfaToken });

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
    const userObj = {
      ...userData,
      organization: userData.org_id || userData.organization,
      organization_type: userData.organization_type
    };
    setUser(userObj);
    console.log('[AuthContext] MFA Login successful:', userObj.email);

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
    <AuthContext.Provider value={{ user, loading, login, logout, verifyMFA }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
