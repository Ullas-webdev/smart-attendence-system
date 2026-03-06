import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bluetooth, GraduationCap, Eye, EyeOff, Wifi } from 'lucide-react';
import { login } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login(form);
      const data = res.data?.data || res.data;
      const token = data.token;
      const u = data.user;
      if (!token || !u) throw new Error('Invalid login response');
      const userNorm = { ...u, _id: u._id || u.id };
      loginUser(userNorm, token);
      toast.success(`Welcome back, ${u.name}!`);
      setLoading(false);
      const path = u.role === 'teacher' ? '/teacher' : '/student';
      setTimeout(() => navigate(path), 0);
    } catch (err) {
      setLoading(false);
      toast.error(err.response?.data?.message || err.message || 'Login failed');
    }
  };

  const demoCredentials = {
    teacher: { email: 'teacher@demo.com', password: 'password123' },
    student: { email: 'arjun@demo.com', password: 'password123' }
  };

  const fillDemo = (role) => {
    setForm(demoCredentials[role] || demoCredentials.student);
  };

  const handleDemoLogin = async (role) => {
    const creds = demoCredentials[role] || demoCredentials.student;
    setLoading(true);
    try {
      const res = await login(creds);
      const data = res.data?.data || res.data;
      const token = data.token;
      const u = data.user;
      if (!token || !u) throw new Error('Invalid login response');
      const userNorm = { ...u, _id: u._id || u.id };
      loginUser(userNorm, token);
      toast.success(`Welcome back, ${u.name}!`);
      setLoading(false);
      const path = u.role === 'teacher' ? '/teacher' : '/student';
      setTimeout(() => navigate(path), 0);
    } catch (err) {
      setLoading(false);
      toast.error(err.response?.data?.message || err.message || 'Login failed. Is the backend running?');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 rounded-2xl backdrop-blur mb-4 bluetooth-scanning">
            <Bluetooth className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">AttendSmart</h1>
          <p className="text-blue-200 mt-1">BLE-Powered Attendance System</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Sign In</h2>

          {/* Demo buttons - one click to sign in */}
          <div className="flex gap-2 mb-6">
            <button type="button" onClick={() => handleDemoLogin('student')} disabled={loading}
              className="flex-1 text-xs py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition-colors flex items-center justify-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> : <GraduationCap className="w-3 h-3" />}
              Demo Student
            </button>
            <button type="button" onClick={() => handleDemoLogin('teacher')} disabled={loading}
              className="flex-1 text-xs py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg border border-purple-200 transition-colors flex items-center justify-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? <span className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /> : <Wifi className="w-3 h-3" />}
              Demo Teacher
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                className="input"
                placeholder="you@college.edu"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in...</span>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            No account? <Link to="/register" className="text-blue-600 hover:underline font-medium">Register here</Link>
          </p>
        </div>

        <p className="text-center text-blue-300 text-xs mt-6">
          🔒 Attendance verified via Bluetooth Low Energy proximity
        </p>
      </div>
    </div>
  );
}
