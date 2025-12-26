// frontend/src/api/index.js
import axios from 'axios'

/**
 * API Base URL Configuration
 * Usage:
 * - Host Dev: VITE_API_URL=http://localhost:3001 -> matches directly
 * - Docker Dev: VITE_API_URL=http://api:3001 -> detects internal name, falls back to relative '/api'
 * - Prod: VITE_API_URL (or undefined) -> uses relative '/api' or provided URL
 */
const getBaseURL = () => {
  const envUrl = import.meta.env.VITE_API_URL;

  // Docker Safeguard: If URL points to internal Docker DNS, use relative path
  // so browser uses the Vite Proxy instead of failing to resolve 'api'
  if (envUrl && envUrl.includes('api:3001')) {
    return '/api';
  }

  // Use provided URL or fallback to localhost
  let url = envUrl || 'http://localhost:3001';

  // Normalize URL to not end with slash before appending /api
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }

  // If it's already a relative path (e.g. just /api) return as is
  if (url === '/api') return url;

  return `${url}/api`;
}

const baseURL = getBaseURL()

/**
 * Axios instance
 */
const client = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 120000
})

/**
 * Helper to parse JWT payload safely
 */
const parseJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

/**
 * Interceptor: attach authentication headers
 */
client.interceptors.request.use(
  (cfg) => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');

      // PHASE 2: Client-Side Token Validation (Relaxed for refresh)
      if (token) {
        const payload = parseJwt(token);

        // Only check if token is completely malformed, not the type
        // Let backend handle type validation and trigger refresh if needed
        if (!payload) {
          console.warn('[Security] Malformed token detected. Clearing...');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('token');
          // Don't redirect here - let the response interceptor handle it
        } else {
          // Token is parseable, attach it
          const activeOrg = localStorage.getItem('active_org');

          cfg.headers = cfg.headers || {};
          cfg.headers.Authorization = `Bearer ${token}`;

          // PHASE 11: Context Propagation
          if (activeOrg) {
            cfg.headers['X-Organization'] = activeOrg;
          }
        }
      }
    } catch (err) {
      console.error('Auth header error:', err);
    }

    return cfg;
  },
  (err) => Promise.reject(err)
);

/**
 * Response interceptor: handle 401 unauthorized with automatic token refresh
 */
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we haven't tried refreshing yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Another request is already refreshing, queue this one
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return client(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');

      if (!refreshToken) {
        // No refresh token, must login
        isRefreshing = false;
        localStorage.removeItem('accessToken');
        localStorage.removeItem('token');
        delete client.defaults.headers.common['Authorization'];

        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      try {
        // Try to refresh the token
        const response = await axios.post(`${baseURL}/simple-auth/refresh`, {
          refreshToken
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;

        // Store new tokens
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('token', accessToken); // Backward compat
        if (newRefreshToken) {
          localStorage.setItem('refreshToken', newRefreshToken);
        }

        // Update default header
        client.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;

        processQueue(null, accessToken);
        isRefreshing = false;

        // Retry original request
        return client(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;

        // Refresh failed, must login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('token');
        delete client.defaults.headers.common['Authorization'];

        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default client;

