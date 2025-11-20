import React, { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Link } from 'react-router-dom'
import client from '../api/index'

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth()
  const [stats, setStats] = useState({ documents: 0, searches: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      try {
        // Try to get document count
        const docsRes = await client.get('/api/documents').catch(() => null)
        if (docsRes?.data) {
          setStats(prev => ({
            ...prev,
            documents: Array.isArray(docsRes.data) ? docsRes.data.length : 0
          }))
        }
      } catch (err) {
        console.error('Failed to load stats', err)
      } finally {
        setLoading(false)
      }
    }
    if (!authLoading) {
      loadStats()
    }
  }, [authLoading])

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Dashboard</h2>
      </div>

      {/* Welcome Section */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
        {authLoading && <div>Loading...</div>}
        {!authLoading && user && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Welcome back, <strong>{user.name || user.email}</strong>!
            </h3>
            <p className="text-sm text-gray-600">Email: {user.email}</p>
            {user.roles && Array.isArray(user.roles) && user.roles.length > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                Roles: {user.roles.join(', ')}
              </p>
            )}
          </div>
        )}
        {!authLoading && !user && (
          <div className="text-gray-600">No profile data available.</div>
        )}
      </div>

      {/* Privacy & Security Info */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Privacy & Security Features
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-3 rounded border border-blue-100">
            <div className="font-medium text-sm text-gray-900 mb-1">PII Redaction</div>
            <div className="text-xs text-gray-600">Emails, phones, and SSNs are automatically redacted in queries and logs</div>
          </div>
          <div className="bg-white p-3 rounded border border-blue-100">
            <div className="font-medium text-sm text-gray-900 mb-1">RBAC Access Control</div>
            <div className="text-xs text-gray-600">Role-based permissions control document access and search capabilities</div>
          </div>
          <div className="bg-white p-3 rounded border border-blue-100">
            <div className="font-medium text-sm text-gray-900 mb-1">Audit Logging</div>
            <div className="text-xs text-gray-600">All searches and document access are logged with hashed queries</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Link
          to="/documents/upload"
          className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-gray-900">Upload Document</div>
              <div className="text-sm text-gray-600">Add a new document</div>
            </div>
          </div>
        </Link>

        <Link
          to="/search"
          className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-gray-900">Search</div>
              <div className="text-sm text-gray-600">Semantic search</div>
            </div>
          </div>
        </Link>

        <Link
          to="/chat"
          className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-gray-900">Chat</div>
              <div className="text-sm text-gray-600">AI-powered chat</div>
            </div>
          </div>
        </Link>
      </div>

      {/* Stats */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h3>
        {loading ? (
          <div className="text-gray-600">Loading statistics...</div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-2xl font-bold text-blue-600">{stats.documents}</div>
              <div className="text-sm text-gray-600">Documents</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{stats.searches}</div>
              <div className="text-sm text-gray-600">Searches</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
