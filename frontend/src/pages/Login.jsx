import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Loader2, ShieldCheck, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import GoogleOAuthButton from '../components/GoogleOAuthButton';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [showMfa, setShowMfa] = useState(false);
  const [mfaToken, setMfaToken] = useState(null);

  const { login, verifyMFA, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect when user is authenticated
  useEffect(() => {
    if (user && !showMfa) {
      if (user.role === 'super_admin') {
        navigate('/super-admin');
      } else if (!user.organization) {
        navigate('/org-select');
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, navigate, showMfa]);

  const emailRef = useRef(null);
  const passRef = useRef(null);

  useEffect(() => {
    if (emailRef.current) emailRef.current.value = '';
    if (passRef.current) passRef.current.value = '';
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (showMfa) {
        // Step 2: Verify MFA
        await verifyMFA(otp, mfaToken);
        toast.success('MFA Verified');
        // Navigation handled by useEffect
      } else {
        // Step 1: Initial Login
        const data = await login(email.trim(), password);

        if (data.mfaRequired) {
          setShowMfa(true);
          setMfaToken(data.mfaToken);
          toast.success('Please enter MFA code');
        } else {
          toast.success('Login successful');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      const msg = err.response?.data?.error || err.message || 'Authentication failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-premium-black relative overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-premium-gold/5 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[100px]" />

      <div className="glass-panel p-8 rounded-2xl shadow-2xl w-full max-w-md relative z-10">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-premium-gold/10 mb-4">
            {showMfa ? <ShieldCheck className="w-6 h-6 text-premium-gold" /> : <Lock className="w-6 h-6 text-premium-gold" />}
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">
            {showMfa ? 'Second Factor' : 'Welcome Back'}
          </h2>
          <p className="text-gray-400">
            {showMfa ? 'Enter the 6-digit code from your app' : 'Sign in to access your secure workspace'}
          </p>
        </div>

        {!showMfa && (
          <>
            {/* Google OAuth Button */}
            <GoogleOAuthButton mode="signin" className="mb-4" />

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-premium-black text-gray-400">Or continue with email</span>
              </div>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
          {!showMfa ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    ref={emailRef}
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="glass-input w-full pl-10 pr-4 py-3 rounded-xl"
                    placeholder="name@company.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    ref={passRef}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
              </div>
            </>
          ) : (
            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
              <label className="text-sm font-medium text-gray-300 ml-1">Authenticator Code</label>
              <div className="relative">
                <ShieldAlert className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').substring(0, 6))}
                  className="glass-input w-full pl-10 pr-4 py-3 rounded-xl text-center text-2xl tracking-[0.5em] font-mono"
                  placeholder="000000"
                  maxLength={6}
                  required
                  autoFocus
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3 rounded-xl flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (showMfa ? 'Verify & Sign In' : 'Sign In')}
            {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
          </button>

          {showMfa && (
            <button
              type="button"
              onClick={() => setShowMfa(false)}
              className="w-full text-sm text-gray-400 hover:text-white transition-colors py-2"
            >
              Back to Login
            </button>
          )}
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          Don't have an account?{' '}
          <Link to="/register" className="text-premium-gold hover:text-premium-gold-hover font-medium transition-colors">
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}
