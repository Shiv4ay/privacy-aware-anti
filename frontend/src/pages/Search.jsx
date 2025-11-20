// frontend/src/pages/Search.jsx
import React, { useState } from 'react'
import client from '../api/index'

// robust import: if AuthContext or useAuth isn't available, use a safe fallback
let useAuth
try {
  // try to import normally (bundlers will resolve this)
  // eslint-disable-next-line import/no-unresolved
  // Note: the try/catch here is evaluated at runtime in the bundler/VM.
  // If your build environment statically analyzes imports this may still fail —
  // but in most dev setups this pattern provides a safe fallback.
  // If your project *does* have contexts/AuthContext, it will be used.
  // Otherwise we fall back to a noop implementation below.
  // (Keep this as an explicit runtime attempt so missing file doesn't crash the component.)
  // @ts-ignore
  const mod = require('../contexts/AuthContext')
  useAuth = mod?.useAuth || (() => ({ user: null }))
} catch (e) {
  // fallback when file is missing or require isn't supported
  useAuth = () => ({ user: null })
}

export default function Search() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [privacyInfo, setPrivacyInfo] = useState(null)
  const [rbacWarning, setRbacWarning] = useState(null)
  const { user } = useAuth()

  // Helper to detect PII in query (client-side preview)
  const detectPII = (text) => {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
    const phoneRegex = /\b(?:\+?\d{1,3}[-.\s]?)?(?:\d[-.\s]?){6,14}\b/g
    const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g
    
    const detected = []
    if (emailRegex.test(text)) detected.push('Email addresses')
    if (phoneRegex.test(text)) detected.push('Phone numbers')
    if (ssnRegex.test(text)) detected.push('SSN')
    
    return detected
  }

  const doSearch = async (e) => {
    e.preventDefault()
    if (!q || q.trim().length === 0) {
      setError('Enter a search query')
      return
    }
    
    setLoading(true)
    setError(null)
    setResults([])
    setPrivacyInfo(null)
    setRbacWarning(null)

    // Client-side PII detection preview
    const detectedPII = detectPII(q)
    if (detectedPII.length > 0) {
      setPrivacyInfo({
        detected: detectedPII,
        message: `PII detected: ${detectedPII.join(', ')}. These will be redacted in audit logs.`
      })
    }

    try {
      // <-- important: backend expects `query` key (not `q`)
      const res = await client.post('/api/search', { query: q.trim() })
      
      // Extract privacy information from response
      if (res.data?.query_redacted) {
        setPrivacyInfo(prev => ({
          ...prev,
          redacted: res.data.query_redacted,
          original: res.data.query || q
        }))
      }

      // Check for RBAC warnings
      if (res.data?.decision === 'denied' || res.data?.blocked) {
        setRbacWarning({
          message: res.data.message || 'Access denied based on your role/permissions',
          policy: res.data.policy_id || null
        })
      }

      setResults(res.data?.results || res.data?.hits || [])
    } catch (err) {
      console.error('Search error', err)
      
      // Check if it's an RBAC denial
      if (err?.response?.status === 403) {
        setRbacWarning({
          message: err?.response?.data?.message || 'Access denied: You do not have permission to search',
          policy: err?.response?.data?.policy_id || null
        })
      }
      
      // normalize server message into string
      let serverMsg = null
      if (err?.response?.data) {
        // prefer common fields
        const body = err.response.data
        serverMsg = body?.message || body?.error || body?.detail || JSON.stringify(body)
      } else {
        serverMsg = err?.message || 'Search failed'
      }

      setError(serverMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Semantic Search</h2>

      {/* Privacy Notice */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-blue-800">
            <strong>Privacy & Security:</strong> Queries are automatically redacted for PII, hashed for audit logs, 
            and access is controlled by role-based permissions (RBAC).
          </div>
        </div>
      </div>

      {/* Privacy Info Display */}
      {privacyInfo && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="text-sm text-yellow-800">
              {privacyInfo.message}
              {privacyInfo.redacted && privacyInfo.original && (
                <div className="mt-2 text-xs">
                  <div><strong>Original:</strong> {privacyInfo.original}</div>
                  <div><strong>Redacted:</strong> {privacyInfo.redacted}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RBAC Warning */}
      {rbacWarning && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="text-sm text-red-800">
              <strong>Access Denied:</strong> {rbacWarning.message}
              {rbacWarning.policy && (
                <div className="text-xs mt-1">Policy ID: {rbacWarning.policy}</div>
              )}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={doSearch} className="mb-4 flex gap-2">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Enter your search query..."
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {loading && (
        <div className="text-center py-8">
          <div className="inline-flex gap-2">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <p className="mt-2 text-sm text-gray-600">Searching documents...</p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {!loading && results.length === 0 && !error && q && (
        <div className="text-center py-8 text-gray-500">
          No results found. Try a different query.
        </div>
      )}

      <div className="space-y-3">
        {results.map((r, i) => (
          <div key={i} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
              {r.source && (
                <div className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-700">
                  {r.source}
                </div>
              )}
              {r.score && (
                <div className="text-xs text-gray-500">
                  Score: {(r.score * 100).toFixed(1)}%
                </div>
              )}
            </div>
            <div className="text-gray-800 leading-relaxed">
              {r.text || r.content || r.snippet || JSON.stringify(r)}
            </div>
            {r.id && (
              <div className="mt-2 text-xs text-gray-500">
                ID: {r.id}
              </div>
            )}
          </div>
        ))}
      </div>

      {results.length > 0 && (
        <div className="mt-4 text-sm text-gray-600 text-center">
          Found {results.length} result{results.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}




// // frontend/src/pages/Search.jsx
// import React, { useState } from 'react'
// import client from '../api/index'
// import { useAuth } from '../contexts/AuthContext'

// export default function Search() {
//   const [q, setQ] = useState('')
//   const [results, setResults] = useState([])
//   const [loading, setLoading] = useState(false)
//   const [error, setError] = useState(null)
//   const [privacyInfo, setPrivacyInfo] = useState(null)
//   const [rbacWarning, setRbacWarning] = useState(null)
//   const { user } = useAuth()

//   // Helper to detect PII in query (client-side preview)
//   const detectPII = (text) => {
//     const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
//     const phoneRegex = /\b(?:\+?\d{1,3}[-.\s]?)?(?:\d[-.\s]?){6,14}\b/g
//     const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g
    
//     const detected = []
//     if (emailRegex.test(text)) detected.push('Email addresses')
//     if (phoneRegex.test(text)) detected.push('Phone numbers')
//     if (ssnRegex.test(text)) detected.push('SSN')
    
//     return detected
//   }

//   const doSearch = async (e) => {
//     e.preventDefault()
//     if (!q || q.trim().length === 0) {
//       setError('Enter a search query')
//       return
//     }
    
//     setLoading(true)
//     setError(null)
//     setResults([])
//     setPrivacyInfo(null)
//     setRbacWarning(null)

//     // Client-side PII detection preview
//     const detectedPII = detectPII(q)
//     if (detectedPII.length > 0) {
//       setPrivacyInfo({
//         detected: detectedPII,
//         message: `PII detected: ${detectedPII.join(', ')}. These will be redacted in audit logs.`
//       })
//     }

//     try {
//       const res = await client.post('/api/search', { q: q.trim() })
      
//       // Extract privacy information from response
//       if (res.data?.query_redacted) {
//         setPrivacyInfo(prev => ({
//           ...prev,
//           redacted: res.data.query_redacted,
//           original: res.data.query || q
//         }))
//       }

//       // Check for RBAC warnings
//       if (res.data?.decision === 'denied' || res.data?.blocked) {
//         setRbacWarning({
//           message: res.data.message || 'Access denied based on your role/permissions',
//           policy: res.data.policy_id || null
//         })
//       }

//       setResults(res.data?.results || res.data?.hits || [])
//     } catch (err) {
//       console.error('Search error', err)
      
//       // Check if it's an RBAC denial
//       if (err?.response?.status === 403) {
//         setRbacWarning({
//           message: err?.response?.data?.message || 'Access denied: You do not have permission to search',
//           policy: err?.response?.data?.policy_id || null
//         })
//       }
      
//       const serverMsg = err?.response?.data || err?.response?.data?.message
//       setError(serverMsg?.message || serverMsg || err.message || 'Search failed')
//     } finally {
//       setLoading(false)
//     }
//   }

//   return (
//     <div>
//       <h2 className="text-xl font-semibold mb-4">Semantic Search</h2>

//       {/* Privacy Notice */}
//       <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
//         <div className="flex items-start gap-2">
//           <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
//             <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
//           </svg>
//           <div className="text-sm text-blue-800">
//             <strong>Privacy & Security:</strong> Queries are automatically redacted for PII, hashed for audit logs, 
//             and access is controlled by role-based permissions (RBAC).
//           </div>
//         </div>
//       </div>

//       {/* Privacy Info Display */}
//       {privacyInfo && (
//         <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
//           <div className="flex items-start gap-2">
//             <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
//               <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
//             </svg>
//             <div className="text-sm text-yellow-800">
//               {privacyInfo.message}
//               {privacyInfo.redacted && privacyInfo.original && (
//                 <div className="mt-2 text-xs">
//                   <div><strong>Original:</strong> {privacyInfo.original}</div>
//                   <div><strong>Redacted:</strong> {privacyInfo.redacted}</div>
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>
//       )}

//       {/* RBAC Warning */}
//       {rbacWarning && (
//         <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
//           <div className="flex items-start gap-2">
//             <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
//               <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
//             </svg>
//             <div className="text-sm text-red-800">
//               <strong>Access Denied:</strong> {rbacWarning.message}
//               {rbacWarning.policy && (
//                 <div className="text-xs mt-1">Policy ID: {rbacWarning.policy}</div>
//               )}
//             </div>
//           </div>
//         </div>
//       )}

//       <form onSubmit={doSearch} className="mb-4 flex gap-2">
//         <input
//           value={q}
//           onChange={e => setQ(e.target.value)}
//           placeholder="Enter your search query..."
//           className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//         />
//         <button
//           type="submit"
//           disabled={loading}
//           className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
//         >
//           {loading ? 'Searching...' : 'Search'}
//         </button>
//       </form>

//       {loading && (
//         <div className="text-center py-8">
//           <div className="inline-flex gap-2">
//             <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
//             <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
//             <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
//           </div>
//           <p className="mt-2 text-sm text-gray-600">Searching documents...</p>
//         </div>
//       )}

//       {error && (
//         <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
//           {error}
//         </div>
//       )}

//       {!loading && results.length === 0 && !error && q && (
//         <div className="text-center py-8 text-gray-500">
//           No results found. Try a different query.
//         </div>
//       )}

//       <div className="space-y-3">
//         {results.map((r, i) => (
//           <div key={i} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
//             <div className="flex justify-between items-start mb-2">
//               {r.source && (
//                 <div className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-700">
//                   {r.source}
//                 </div>
//               )}
//               {r.score && (
//                 <div className="text-xs text-gray-500">
//                   Score: {(r.score * 100).toFixed(1)}%
//                 </div>
//               )}
//             </div>
//             <div className="text-gray-800 leading-relaxed">
//               {r.text || r.content || r.snippet || JSON.stringify(r)}
//             </div>
//             {r.id && (
//               <div className="mt-2 text-xs text-gray-500">
//                 ID: {r.id}
//               </div>
//             )}
//           </div>
//         ))}
//       </div>

//       {results.length > 0 && (
//         <div className="mt-4 text-sm text-gray-600 text-center">
//           Found {results.length} result{results.length !== 1 ? 's' : ''}
//         </div>
//       )}
//     </div>
//   )
// }
