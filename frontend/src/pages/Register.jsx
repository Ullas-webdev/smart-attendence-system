import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bluetooth } from 'lucide-react';
import { register } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student', rollNumber: '', department: 'Computer Science', semester: 6, bluetoothDeviceId: '' });
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await register(form);
      loginUser(res.data.user, res.data.token);
      toast.success('Account created successfully!');
      navigate(res.data.user.role === 'teacher' ? '/teacher' : '/student');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl backdrop-blur mb-3">
            <Bluetooth className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create Account</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input className="input" placeholder="Your Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" className="input" placeholder="you@college.edu" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" className="input" placeholder="Min 6 chars" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} />
              </div>
              {form.role === 'student' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Roll Number</label>
                    <input className="input" placeholder="CS2021001" value={form.rollNumber} onChange={e => setForm({ ...form, rollNumber: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                    <input type="number" className="input" min={1} max={8} value={form.semester} onChange={e => setForm({ ...form, semester: parseInt(e.target.value) })} />
                  </div>
                </>
              )}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select className="input" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}>
                  <option value="Computer Science">Computer Science</option>
                  <option value="CS IoT">CS IoT</option>
                  <option value="Information Science">Information Science</option>
                  <option value="Electronics">Electronics</option>
                </select>
              </div>
              {form.role === 'student' && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bluetooth Device ID (MAC)</label>
                  <input className="input font-mono" placeholder="AA:BB:CC:DD:EE:FF" value={form.bluetoothDeviceId} onChange={e => setForm({ ...form, bluetoothDeviceId: e.target.value })} />
                  <p className="text-xs text-gray-400 mt-1">Your phone's BT MAC address or UUID</p>
                </div>
              )}
            </div>
            <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-500">
            Have an account? <Link to="/login" className="text-blue-600 hover:underline font-medium">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
