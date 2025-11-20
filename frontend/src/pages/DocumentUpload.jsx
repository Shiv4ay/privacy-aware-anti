// frontend/src/pages/DocumentUpload.jsx
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/index'
import { useDocuments } from '../contexts/DocumentContext'

export default function DocumentUpload() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [error, setError] = useState(null)
  const { addDocument } = useDocuments()
  const navigate = useNavigate()

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Check file size (e.g., 10MB limit)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (selectedFile.size > maxSize) {
        setError('File size exceeds 10MB limit')
        setFile(null)
        return
      }
      setFile(selectedFile)
      setError(null)
      setMsg(null)
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) {
      setError('Please select a file first')
      return
    }
    
    setLoading(true)
    setMsg(null)
    setError(null)
    
    try {
      const fd = new FormData()
      fd.append('file', file)
      
      // Do NOT set Content-Type manually for multipart/form-data; axios will add boundary
      const res = await client.post('/api/documents/upload', fd, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 120000 // 2 minutes for large files
      })
      
      // If your backend returns { ok:true, docId, ... } adapt accordingly
      if (res.data) {
        // Add to context with proper format
        const docData = res.data.document || res.data
        addDocument({
          id: res.data.docId || res.data.id,
          filename: docData.filename || file.name,
          status: docData.status || 'pending',
          created_at: new Date().toISOString()
        })
        setMsg(`Uploaded successfully${res.data.docId ? ` - Document ID: ${res.data.docId}` : ''}`)
        setFile(null)
        // Reset file input
        const fileInput = document.querySelector('input[type="file"]')
        if (fileInput) fileInput.value = ''
        
        // Optionally navigate to documents list after 2 seconds
        setTimeout(() => {
          navigate('/documents')
        }, 2000)
      }
    } catch (err) {
      console.error('Upload error', err)
      // Handle error response properly
      let errorMessage = 'Upload failed'
      if (err?.response?.data) {
        if (typeof err.response.data === 'string') {
          errorMessage = err.response.data
        } else if (err.response.data.message) {
          errorMessage = err.response.data.message
        } else if (err.response.data.error) {
          errorMessage = err.response.data.error
          if (err.response.data.details) {
            errorMessage += ': ' + err.response.data.details
          }
        } else {
          errorMessage = JSON.stringify(err.response.data)
        }
      } else if (err?.message) {
        errorMessage = err.message
      }
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Upload Document</h2>

      {/* Privacy Notice */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-blue-800">
            <strong>Privacy & Security:</strong> Uploaded documents are processed with PII redaction, 
            access-controlled by RBAC, and all access is logged for audit purposes.
          </div>
        </div>
      </div>

      {msg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          {msg}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleUpload} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Document
          </label>
          <input
            type="file"
            onChange={handleFileChange}
            accept=".pdf,.txt,.doc,.docx,.md"
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <p className="mt-2 text-xs text-gray-500">
            Supported formats: PDF, TXT, DOC, DOCX, MD (Max 10MB)
          </p>
          {file && (
            <div className="mt-2 text-sm text-gray-700">
              Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(2)} KB)
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || !file}
            className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Uploading...' : 'Upload Document'}
          </button>
          {file && (
            <button
              type="button"
              onClick={() => {
                setFile(null)
                setError(null)
                setMsg(null)
                const fileInput = document.querySelector('input[type="file"]')
                if (fileInput) fileInput.value = ''
              }}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Clear
            </button>
          )}
        </div>

        {loading && (
          <div className="mt-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span>Processing document and generating embeddings...</span>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
