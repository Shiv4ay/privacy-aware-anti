import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import client from '../api/index';
import { User, Shield, Building, Server, LogOut, Lock, Activity, Save, X, CheckCircle, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [showMfaDisable, setShowMfaDisable] = useState(false);
  const [mfaData, setMfaData] = useState({ qrCode: '', manualKey: '', otp: '', password: '' });
  const [mfaEnabled, setMfaEnabled] = useState(user?.is_mfa_enabled || false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });

  const [orgData, setOrgData] = useState({ name: '', domain: '', type: '', member_count: 0, created_at: '' });
  const [orgLoading, setOrgLoading] = useState(false);

  // Fetch Org Data when tab active
  React.useEffect(() => {
    if (activeTab === 'organization') {
      const fetchOrg = async () => {
        setOrgLoading(true);
        try {
          const res = await client.get('/orgs/me');
          if (res.data.success) {
            setOrgData(res.data.organization);
          }
        } catch (err) {
          console.error("Failed to fetch org details", err);
        } finally {
          setOrgLoading(false);
        }
      }
      fetchOrg();
    }
  }, [activeTab]);

  const handleOrgUpdate = async () => {
    try {
      const res = await client.put('/orgs/me', {
        name: orgData.name,
        domain: orgData.domain
      });
      if (res.data.success) {
        toast.success(res.data.message);
        setOrgData(res.data.organization);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update organization");
    }
  };

  // Define tabs with RBAC permissions
  const tabs = [
    { id: 'general', label: 'General', icon: User, allowed: ['all'] },
    { id: 'security', label: 'Security', icon: Shield, allowed: ['all'] },
    { id: 'organization', label: 'Organization', icon: Building, allowed: ['admin', 'super_admin'] },
    { id: 'system', label: 'System Health', icon: Server, allowed: ['super_admin'] },
  ];

  // Filter tabs user has access to
  console.log('[Settings] Current User:', user);
  const allowedTabs = tabs.filter(tab =>
    tab.allowed.includes('all') ||
    (user?.role && tab.allowed.includes(user.role))
  );

  const handleCreatePassword = async () => {
    if (passwordForm.new !== passwordForm.confirm) {
      toast.error("New passwords do not match");
      return;
    }
    try {
      const res = await client.post('/auth/change-password', {
        currentPassword: passwordForm.current,
        newPassword: passwordForm.new
      });
      if (res.data.message) {
        toast.success("Password updated successfully");
        setShowPasswordModal(false);
        setPasswordForm({ current: '', new: '', confirm: '' });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update password");
    }
  };

  const toggleMFA = async () => {
    if (mfaEnabled) {
      setShowMfaDisable(true);
    } else {
      try {
        const res = await client.post('/auth/mfa/setup');
        setMfaData({ ...mfaData, qrCode: res.data.qrCode, manualKey: res.data.manualKey });
        setShowMfaSetup(true);
      } catch (err) {
        toast.error("Failed to initiate MFA setup");
      }
    }
  };

  const verifyMfaSetup = async () => {
    try {
      const res = await client.post('/auth/mfa/verify', { otp: mfaData.otp });
      if (res.data.success) {
        setMfaEnabled(true);
        setShowMfaSetup(false);
        setMfaData({ qrCode: '', manualKey: '', otp: '', password: '' });
        toast.success("MFA enabled successfully");
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Invalid OTP code");
    }
  };

  const disableMFA = async () => {
    try {
      const res = await client.post('/auth/mfa/disable', { password: mfaData.password });
      if (res.data.success) {
        setMfaEnabled(false);
        setShowMfaDisable(false);
        setMfaData({ qrCode: '', manualKey: '', otp: '', password: '' });
        toast.success("MFA disabled");
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Incorrect password");
    }
  };

  const handleSave = () => {
    toast.success("Settings saved successfully");
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 min-h-[80vh]">
      {/* Sidebar Navigation */}
      <div className="w-full md:w-72 glass-panel p-6 rounded-2xl h-fit sticky top-24">
        <h2 className="text-2xl font-bold text-white mb-8 px-2">Settings</h2>
        <nav className="space-y-2">
          {allowedTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl transition-all duration-300 ${activeTab === tab.id
                ? 'bg-gradient-to-r from-premium-gold/20 to-transparent text-premium-gold border-l-4 border-premium-gold'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
            >
              <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-premium-gold' : ''}`} />
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}

          <div className="my-6 border-t border-white/10"></div>

          <button
            onClick={logout}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-red-400 hover:bg-red-500/10 transition-all group"
          >
            <LogOut className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            <span className="font-medium">Sign Out</span>
          </button>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 glass-panel p-8 rounded-2xl relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-premium-gold/5 rounded-full blur-3xl -z-10 pointer-events-none" />

        {activeTab === 'general' && (
          <div className="space-y-8 animate-fadeIn">
            <div>
              <h3 className="text-3xl font-bold text-white mb-2">Profile Settings</h3>
              <p className="text-gray-400">Manage your personal information and preferences.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input type="text" defaultValue={user?.username || ''} className="glass-input w-full pl-12 pr-4 py-3 rounded-xl" />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">Email Address</label>
                <div className="relative opacity-60">
                  <input type="email" value={user?.email || ''} disabled className="glass-input w-full px-4 py-3 rounded-xl cursor-not-allowed bg-white/5" />
                </div>
                <p className="text-xs text-gray-500">Email cannot be changed contact admin.</p>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">Role</label>
                <div className="glass-input w-full px-4 py-3 rounded-xl flex items-center gap-3 bg-white/5 border border-premium-gold/20">
                  <div className="w-2 h-2 rounded-full bg-premium-gold shadow-[0_0_10px_rgba(251,191,36,0.5)]"></div>
                  <span className="uppercase tracking-wider font-semibold text-premium-gold text-sm">{user?.role}</span>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">Organization</label>
                <div className="glass-input w-full px-4 py-3 rounded-xl bg-white/5 ">
                  {user?.organization || 'Personal Workspace'}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-white/10 flex justify-end">
              <button onClick={handleSave} className="btn-primary py-3 px-8 rounded-xl flex items-center gap-2">
                <Save className="w-5 h-5" />
                Save Changes
              </button>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-8 animate-fadeIn">
            <div>
              <h3 className="text-3xl font-bold text-white mb-2">Security & Login</h3>
              <p className="text-gray-400">Manage your password and security references.</p>
            </div>

            <div className="space-y-4">
              <div className="p-6 bg-white/5 rounded-2xl border border-white/10 hover:border-premium-gold/30 transition-colors flex items-center justify-between group">
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-blue-500/10 rounded-xl text-blue-400 group-hover:scale-110 transition-transform"><Lock className="w-6 h-6" /></div>
                  <div>
                    <h4 className="text-lg text-white font-medium mb-1">Password</h4>
                    <p className="text-sm text-gray-400">Last changed 3 months ago</p>
                  </div>
                </div>
                <button onClick={() => setShowPasswordModal(true)} className="px-5 py-2 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/10">Change</button>
              </div>

              <div className="p-6 bg-white/5 rounded-2xl border border-white/10 hover:border-premium-gold/30 transition-colors flex items-center justify-between group">
                <div className="flex items-center gap-5">
                  <div className={`p-4 rounded-xl transition-all duration-300 ${mfaEnabled ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
                    {mfaEnabled ? <CheckCircle className="w-6 h-6" /> : <Smartphone className="w-6 h-6" />}
                  </div>
                  <div>
                    <h4 className="text-lg text-white font-medium mb-1">Two-Factor Authentication</h4>
                    <p className="text-sm text-gray-400">Add an extra layer of security to your account</p>
                  </div>
                </div>
                <button onClick={toggleMFA} className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${mfaEnabled ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'btn-primary bg-premium-gold text-black'}`}>
                  {mfaEnabled ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'organization' && (
          <div className="space-y-8 animate-fadeIn">
            <div>
              <h3 className="text-3xl font-bold text-white mb-2">Organization Details</h3>
              <p className="text-gray-400">Manage your organization's profile and settings.</p>
            </div>

            {orgLoading ? (
              <div className="p-12 text-center text-gray-500">Loading organization details...</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Organization Name */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-300">Organization Name</label>
                    <div className="relative">
                      <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="text"
                        value={orgData.name || ''}
                        onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
                        className="glass-input w-full pl-12 pr-4 py-3 rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Organization Domain */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-300">Primary Domain</label>
                    <div className="relative">
                      <Server className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="text"
                        value={orgData.domain || ''}
                        onChange={(e) => setOrgData({ ...orgData, domain: e.target.value })}
                        placeholder="e.g. univeristy.edu"
                        className="glass-input w-full pl-12 pr-4 py-3 rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Stats Cards */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-300">Account Type</label>
                    <div className="glass-input w-full px-4 py-3 rounded-xl bg-white/5 text-gray-400">
                      {orgData.type || 'Standard'}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-300">Member Count</label>
                    <div className="glass-input w-full px-4 py-3 rounded-xl bg-white/5 text-gray-400 flex justify-between items-center">
                      <span>Active Users</span>
                      <span className="text-premium-gold font-bold">{orgData.member_count}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/10 flex justify-end">
                  <button onClick={handleOrgUpdate} className="btn-primary py-3 px-8 rounded-xl flex items-center gap-2">
                    <Save className="w-5 h-5" />
                    Update Organization
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'system' && (
          <div className="space-y-8 animate-fadeIn">
            <div>
              <h3 className="text-3xl font-bold text-white mb-2">System Health</h3>
              <p className="text-gray-400">Global system status and performance metrics.</p>
            </div>
            <div className="p-8 bg-white/5 rounded-2xl border border-white/10 text-center py-20">
              <Activity className="w-16 h-16 text-green-500 mx-auto mb-4 animate-pulse" />
              <h4 className="text-xl text-white font-bold mb-2">All Systems Operational</h4>
              <p className="text-gray-400">Database, Encryption, and AI Services are running optimally.</p>
            </div>
          </div>
        )}

        {/* Password Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel w-full max-w-md rounded-2xl p-6 relative animate-scaleUp">
              <button onClick={() => setShowPasswordModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
              <h3 className="text-2xl font-bold text-white mb-6">Change Password</h3>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">Current Password</label>
                  <input
                    type="password"
                    className="glass-input w-full px-4 py-3 rounded-xl"
                    value={passwordForm.current}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, current: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">New Password (min 10 chars)</label>
                  <input
                    type="password"
                    className="glass-input w-full px-4 py-3 rounded-xl"
                    value={passwordForm.new}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, new: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">Confirm New Password</label>
                  <input
                    type="password"
                    className="glass-input w-full px-4 py-3 rounded-xl"
                    value={passwordForm.confirm}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
                  />
                </div>

                <button onClick={handleCreatePassword} className="w-full btn-primary py-3 rounded-xl font-bold mt-4">
                  Update Password
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MFA Setup Modal */}
        {showMfaSetup && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel w-full max-w-md rounded-2xl p-8 relative animate-scaleUp">
              <button onClick={() => setShowMfaSetup(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>

              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-premium-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Smartphone className="w-8 h-8 text-premium-gold" />
                </div>
                <h3 className="text-2xl font-bold text-white">Enable MFA</h3>
                <p className="text-gray-400 text-sm">Scan this QR code with your authenticator app</p>
              </div>

              <div className="bg-white p-4 rounded-xl mb-6 mx-auto w-48 h-48 flex items-center justify-center">
                <img src={mfaData.qrCode} alt="MFA QR Code" className="w-full h-full" />
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2 text-center uppercase tracking-widest">Verification Code</label>
                  <input
                    type="text"
                    className="glass-input w-full px-4 py-4 rounded-xl text-center text-2xl tracking-[0.5em] font-mono"
                    placeholder="000000"
                    maxLength={6}
                    value={mfaData.otp}
                    onChange={(e) => setMfaData({ ...mfaData, otp: e.target.value.replace(/\D/g, '') })}
                  />
                </div>

                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-4">Manual Key: <span className="font-mono text-gray-300">{mfaData.manualKey}</span></p>
                </div>

                <button onClick={verifyMfaSetup} className="w-full btn-primary py-3 rounded-xl font-bold shadow-lg shadow-premium-gold/20">
                  Verify & Activate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MFA Disable Modal */}
        {showMfaDisable && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel w-full max-w-md rounded-2xl p-8 relative animate-scaleUp">
              <button onClick={() => setShowMfaDisable(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>

              <div className="text-center mb-6">
                <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-white">Disable MFA</h3>
                <p className="text-gray-400 text-sm">For your security, please confirm your password to disable two-factor authentication.</p>
              </div>

              <div className="space-y-4">
                <input
                  type="password"
                  className="glass-input w-full px-4 py-3 rounded-xl"
                  placeholder="Your Account Password"
                  value={mfaData.password}
                  onChange={(e) => setMfaData({ ...mfaData, password: e.target.value })}
                />

                <button onClick={disableMFA} className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold transition-colors">
                  Disable MFA
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
