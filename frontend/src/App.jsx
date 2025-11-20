// frontend/src/App.jsx
import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { DocumentProvider } from './contexts/DocumentContext'
import ProtectedRoute from './components/ProtectedRoute'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import DocumentUpload from './pages/DocumentUpload'
import DocumentList from './pages/DocumentList'
import Search from './pages/Search'
import Chat from './pages/Chat'
import Settings from './pages/Settings'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import OtpVerification from './pages/OtpVerification'
import './index.css'

function App() {
  return (
    <AuthProvider>
      <DocumentProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/otp-verify" element={<OtpVerification />} />
            
            {/* Protected routes */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <div className="min-h-screen bg-gray-50">
                    <Header />
                    <div className="max-w-7xl mx-auto px-4 py-6">
                      <div className="flex gap-6">
                        <aside className="w-64 flex-shrink-0">
                          <Sidebar />
                        </aside>
                        <main className="flex-1">
                          <Routes>
                            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/search" element={<Search />} />
                            <Route path="/chat" element={<Chat />} />
                            <Route path="/documents" element={<DocumentList />} />
                            <Route path="/documents/upload" element={<DocumentUpload />} />
                            <Route path="/settings" element={<Settings />} />
                          </Routes>
                        </main>
                      </div>
                    </div>
                  </div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </DocumentProvider>
    </AuthProvider>
  )
}

export default App
