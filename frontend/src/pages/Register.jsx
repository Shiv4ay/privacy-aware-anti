import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import client from '../api/index';
import { UserPlus, Mail, Lock, User, Building, ArrowRight, Loader2, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import GoogleOAuthButton from '../components/GoogleOAuthButton';
import toast from 'react-hot-toast';

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    org_id: '',
    department: '',
    role: 'user'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth(); // Auto-login after register
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const res = await client.get('/auth/organizations');
      if (res.data.success) {
        console.log("Fetched organizations:", res.data.organizations);
        setOrganizations(res.data.organizations);
        if (res.data.organizations.length > 0) {
          setFormData(prev => ({ ...prev, org_id: res.data.organizations[0].id }));
        }
      }
    } catch (err) {
      console.error("Failed to fetch organizations", err);
      toast.error("Failed to load organizations");
    }
  };

  // Password strength calculator
  const getPasswordStrength = (password) => {
    if (!password) return { strength: 0, label: '', color: '' };
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    if (strength <= 2) return { strength, label: 'Weak', color: 'bg-red-500' };
    if (strength <= 3) return { strength, label: 'Fair', color: 'bg-yellow-500' };
    if (strength <= 4) return { strength, label: 'Good', color: 'bg-blue-500' };
    return { strength, label: 'Strong', color: 'bg-green-500' };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // 1. Prepare Payload
    const payload = {
      ...formData,
      username: formData.name // Map frontend 'name' to backend 'username'
    };

    try {
      // 2. Register
      const res = await client.post('/auth/register', payload);

      if (res.data.success) {
        toast.success('Account created! Logging you in...');

        try {
          // 3. Auto-Login
          await login(formData.email, formData.password);

          // 4. Redirect to Dashboard
          navigate('/dashboard', { replace: true });
        } catch (loginErr) {
          console.error("Auto-login failed:", loginErr);
          toast.error("Auto-login failed. Please sign in manually.");
          navigate('/login');
        }
      }
    } catch (err) {
      console.error("Registration error:", err);
      // Handle 409 Conflict specifically
      if (err.response && err.response.status === 409) {
        toast.error("Account already exists. Redirecting to login...");
        setTimeout(() => navigate('/login'), 1500);
      } else {
        toast.error(err.response?.data?.error || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-premium-black relative overflow-hidden py-10">
      {/* Background Accents */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-premium-gold/5 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[100px]" />

      <div className="glass-panel p-8 rounded-2xl shadow-2xl w-full max-w-lg relative z-10 animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-premium-gold/10 mb-4">
            <UserPlus className="w-6 h-6 text-premium-gold" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Create Account</h2>
          <p className="text-gray-400">Join your organization's secure workspace</p>
        </div>

        {/* Google OAuth Button */}
        <GoogleOAuthButton mode="signup" className="mb-4" />

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-premium-black text-gray-400">Or register with email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 ml-1">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="glass-input w-full pl-10 pr-4 py-3 rounded-xl"
                placeholder="Enter your name"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="glass-input w-full pl-10 pr-4 py-3 rounded-xl"
                placeholder="Enter your email"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="glass-input w-full pl-10 pr-12 py-3 rounded-xl"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Password Strength Indicator */}
            {formData.password && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all ${i < passwordStrength.strength ? passwordStrength.color : 'bg-gray-700'
                        }`}
                    />
                  ))}
                </div>
                <p className={`text-xs ${passwordStrength.strength >= 3 ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                  Password strength: {passwordStrength.label}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 ml-1">Organization</label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <select
                value={formData.org_id}
                onChange={(e) => setFormData({ ...formData, org_id: e.target.value })}
                className="glass-input w-full pl-10 pr-4 py-3 rounded-xl appearance-none"
                required
              >
                <option value="" disabled className="text-gray-500">Select Organization</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id} className="text-black">
                    {org.name} ({org.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {organizations.find(o => parseInt(o.id) === parseInt(formData.org_id))?.type !== 'Personal' && (
            <div className="grid grid-cols-2 gap-4 animate-fade-in">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 ml-1">Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="glass-input w-full px-4 py-3 rounded-xl"
                  placeholder="Engineering"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 ml-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="glass-input w-full px-4 py-3 rounded-xl appearance-none"
                >
                  <option value="user" className="text-black">Member</option>
                  <option value="student" className="text-black">Student</option>
                  <option value="faculty" className="text-black">Faculty</option>
                  <option value="researcher" className="text-black">Researcher</option>
                  <option value="employee" className="text-black">Employee</option>
                  <option value="guest" className="text-black">Guest</option>
                </select>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3 rounded-xl flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
            {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-premium-gold hover:text-premium-gold-hover font-medium transition-colors">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
