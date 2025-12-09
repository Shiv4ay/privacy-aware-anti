import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ✅ HARD RESET OF BROWSER & AGENT AUTOFILL ON FIRST LOAD
  const emailRef = useRef(null);
  const passRef = useRef(null);

  useEffect(() => {
    if (emailRef.current) emailRef.current.value = '';
    if (passRef.current) passRef.current.value = '';
    setEmail('');
    setPassword('');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email.trim(), password);
      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.error || err.message || 'Login failed');
      toast.error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-premium-black relative overflow-hidden">
      <div className="glass-panel p-8 rounded-2xl shadow-2xl w-full max-w-md">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-premium-gold/10 mb-4">
            <Lock className="w-6 h-6 text-premium-gold" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
          <p className="text-gray-400">Sign in to access your secure workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">

          {/* ✅ EMAIL FIELD — AUTOFILL + AGENT SAFE */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                ref={emailRef}
                type="text"
                name="email-no-autofill"
                autoComplete="new-email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={(e) => e.target.value && setEmail('')} // ✅ wipes autofill on focus
                className="glass-input w-full pl-10 pr-4 py-3 rounded-xl"
                placeholder="name@company.com"
                required
              />
            </div>
          </div>

          {/* ✅ PASSWORD FIELD — AUTOFILL + AGENT SAFE */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                ref={passRef}
                type="password"
                name="password-no-autofill"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={(e) => e.target.value && setPassword('')} // ✅ wipes autofill on focus
                className="glass-input w-full pl-10 pr-4 py-3 rounded-xl"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3 rounded-xl flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
            {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
          </button>
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
