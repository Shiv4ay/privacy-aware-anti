import React, { useEffect, useState } from 'react'
import client from '../api/index'
import { useDocuments } from '../contexts/DocumentContext'

export default function DocumentList() {
  const { documents, setList } = useDocuments()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadDocuments = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await client.get('/api/documents')
      // Backend returns { documents: [...], pagination: {...} }
      const docs = res.data?.documents || res.data || []
      setList(Array.isArray(docs) ? docs : [])
    } catch (err) {
      console.error('Failed to load documents:', err)
      const errorMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to load documents'
      setError(errorMsg)
      setList([]) // Clear documents on error
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [setList])

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Documents</h2>
        <button
          onClick={loadDocuments}
          disabled={loading}
          className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      {loading && <div className="text-gray-600">Loading documents...</div>}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}
      <div className="space-y-3">
        {!loading && documents.length === 0 && !error && (
          <div className="text-slate-600 p-4 bg-gray-50 rounded-lg text-center">
            No documents found. Upload a document to get started.
          </div>
        )}
        {documents.map((d, i) => (
          <div key={d.id || i} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
              <div className="font-medium text-gray-900">{d.filename || d.name || `Document ${i+1}`}</div>
              {d.status && (
                <span className={`text-xs px-2 py-1 rounded-full ${
                  d.status === 'processed' ? 'bg-green-100 text-green-700' :
                  d.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                  d.status === 'pending' ? 'bg-gray-100 text-gray-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {d.status}
                </span>
              )}
            </div>
            {d.content_preview && (
              <div className="text-sm text-slate-600 mt-1 line-clamp-2">{d.content_preview}</div>
            )}
            {d.created_at && (
              <div className="text-xs text-slate-500 mt-2">
                Uploaded: {new Date(d.created_at).toLocaleString()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
