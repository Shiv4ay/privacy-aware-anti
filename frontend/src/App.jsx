// frontend/src/App.jsx
import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { DocumentProvider } from './contexts/DocumentContext'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './components/DashboardLayout'
import Dashboard from './pages/Dashboard'
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import AdminDashboard from './pages/AdminDashboard'
import SecurityDashboard from './pages/SecurityDashboard'
import DataDashboard from './pages/DataDashboard'
import DocumentUpload from './pages/DocumentUpload'
import Documents from './pages/Documents'
import Search from './pages/Search'
import Chat from './pages/Chat'
import Settings from './pages/Settings'
import ProfilePage from './pages/ProfilePage'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import OtpVerification from './pages/OtpVerification'
import OAuthCallback from './pages/OAuthCallback'
import OrgSelectionPage from './pages/OrgSelectionPage'
import LandingPage from './pages/LandingPage'
import './index.css'
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" toastOptions={{
        style: {
          background: '#1A1A1A',
          color: '#fff',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
      }} />
      <DocumentProvider>
        <Router>
          <Routes>
            {/* Root - Smart redirect based on auth */}
            <Route path="/" element={<LandingPage />} />

            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/otp-verify" element={<OtpVerification />} />
            <Route path="/auth/google/callback" element={<OAuthCallback />} />

            {/* Org Selection (Protected but No Org Required) */}
            <Route path="/org-select" element={
              <ProtectedRoute requireOrg={false}>
                <OrgSelectionPage />
              </ProtectedRoute>
            } />

            {/* Protected routes */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Routes>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/super-admin" element={
                        <ProtectedRoute roles={['super_admin']}>
                          <SuperAdminDashboard />
                        </ProtectedRoute>
                      } />
                      <Route path="/admin" element={
                        <ProtectedRoute roles={['admin', 'super_admin']}>
                          <AdminDashboard />
                        </ProtectedRoute>
                      } />
                      <Route path="/security" element={
                        <ProtectedRoute roles={['admin', 'super_admin']}>
                          <SecurityDashboard />
                        </ProtectedRoute>
                      } />
                      <Route path="/audit" element={
                        <ProtectedRoute roles={['auditor', 'super_admin']}>
                          <SecurityDashboard />
                        </ProtectedRoute>
                      } />
                      <Route path="/data" element={
                        <ProtectedRoute roles={['data_steward', 'super_admin']}>
                          <DataDashboard />
                        </ProtectedRoute>
                      } />
                      <Route path="/search" element={<Search />} />
                      <Route path="/chat" element={<Chat />} />
                      <Route path="/documents" element={<Documents />} />
                      <Route path="/documents/upload" element={<DocumentUpload />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/profile" element={<ProfilePage />} />
                    </Routes>
                  </DashboardLayout>
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
