import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import OrgSelection from '../components/OrgSelection';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showOrgSelection, setShowOrgSelection] = useState(false);
  const [tempToken, setTempToken] = useState(null);
  const [tempUser, setTempUser] = useState(null);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await api.post('/auth/login', { email, password });

      setTempToken(response.data.token);
      setTempUser(response.data.user);

      // Show org selection popup
      setShowOrgSelection(true);

    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  const handleOrgSelect = async (orgId) => {
    try {
      // Call API to switch organization and get new token
      const response = await api.post('/auth/organization',
        { organization: orgId },
        { headers: { Authorization: `Bearer ${tempToken}` } }
      );

      const { token, user } = response.data;

      login(user, token);
      setShowOrgSelection(false);
      navigate('/dashboard');
    } catch (err) {
      console.error("Failed to set organization", err);
      setError("Failed to set organization. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#111111]">
      {showOrgSelection && (
        <OrgSelection
          onSelect={handleOrgSelect}
          onClose={() => setShowOrgSelection(false)}
        />
      )}

      <div className="bg-[#1a1a1a] p-8 rounded-xl shadow-2xl w-full max-w-md border border-gray-800">
        <h2 className="text-3xl font-bold text-center text-white mb-8">Welcome Back</h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg mb-6 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#222] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="Enter your email"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#222] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="Enter your password"
              required
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center text-gray-400 cursor-pointer">
              <input type="checkbox" className="mr-2 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-0" />
              Remember me
            </label>
            <Link to="/forgot-password" class="text-blue-400 hover:text-blue-300">Forgot password?</Link>
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-3 rounded-lg transition-all transform hover:scale-[1.02] shadow-lg shadow-blue-500/20"
          >
            Sign In
          </button>
        </form>

        <p className="mt-8 text-center text-gray-400 text-sm">
          Don't have an account?{' '}
          <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
