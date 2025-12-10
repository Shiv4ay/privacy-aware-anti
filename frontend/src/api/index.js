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
  timeout: 30000
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

      // PHASE 2: Strict Client-Side Token Validation
      if (token) {
        const payload = parseJwt(token);

        // If token is malformed OR missing "type: access", force logout immediately
        if (!payload || payload.type !== 'access') {
          console.warn('[Security] Invalid token format detected. Forcing logout.');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('token');
          delete client.defaults.headers.common['Authorization'];
          window.location.href = '/login';
          // Cancel request
          const controller = new AbortController();
          cfg.signal = controller.signal;
          controller.abort('Invalid token format');
          return cfg;
        }

        const activeOrg = localStorage.getItem('active_org');

        cfg.headers = cfg.headers || {};
        cfg.headers.Authorization = `Bearer ${token}`;

        // PHASE 11: Context Propagation
        if (activeOrg) {
          cfg.headers['X-Organization'] = activeOrg;
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
 * Response interceptor: handle 401 unauthorized
 */
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth data on 401
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('token');
      delete client.defaults.headers.common['Authorization'];

      // Redirect to login if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default client;

