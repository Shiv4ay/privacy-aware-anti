// frontend/src/api/index.js
import axios from 'axios'

/**
 * API Base URL
 * - In production (Docker): Use relative URLs (nginx proxies /api/ to backend)
 * - In development: Use VITE_API_URL or fallback to http://localhost:3001
 */
const getBaseURL = () => {
  // If we're in a browser and the API URL points to a Docker service name,
  // use relative URLs (nginx will proxy)
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.includes('api:3001')) {
    return '' // Use relative URLs, nginx will proxy
  }
  // Use explicit URL from env or fallback
  return import.meta.env.VITE_API_URL || 'http://localhost:3001'
}

const baseURL = getBaseURL()

/**
 * Axios instance
 */
const client = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000 // Increased timeout for search/chat operations
})

/**
 * Interceptor: attach authentication headers
 * - DEV_AUTH_KEY is used for demo/dev mode
 * - backend expects BOTH:
 *     Authorization: Bearer <token>
 *     x-dev-auth: <token>
 */
client.interceptors.request.use(
  (cfg) => {
    try {
      const token =
        localStorage.getItem('DEV_AUTH_KEY') || localStorage.getItem('token')

      if (token) {
        cfg.headers = cfg.headers || {}

        // required by backend for dev-access bypass
        cfg.headers.Authorization = `Bearer ${token}`

        // IMPORTANT: backend dev mode expects this header (401 without it)
        cfg.headers['x-dev-auth'] = token
      }
    } catch (err) {
      console.error('Auth header error:', err)
    }

    return cfg
  },
  (err) => Promise.reject(err)
)

export default client
