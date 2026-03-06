import React from 'react';
import { Bluetooth, LogOut, User, GraduationCap, BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <Bluetooth className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-gray-900 text-lg">AttendSmart</span>
              <span className="hidden sm:inline ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">BLE</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
              {user?.role === 'teacher' ? (
                <BookOpen className="w-4 h-4 text-purple-600" />
              ) : (
                <GraduationCap className="w-4 h-4 text-blue-600" />
              )}
              <span className="text-sm font-medium text-gray-700">{user?.name}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${user?.role === 'teacher' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                {user?.role}
              </span>
            </div>

            <button onClick={handleLogout}
              className="flex items-center gap-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors text-sm font-medium">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
