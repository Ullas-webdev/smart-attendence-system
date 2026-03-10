import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

import Login from './pages/Login';
import Register from './pages/Register';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';


function ProtectedRoute({ children, role }) {

  const { user, loading } = useAuth();

  if (loading) {

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">

        <div className="text-center">

          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />

          <p className="text-gray-500">Loading...</p>

        </div>

      </div>
    );

  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role && user.role !== role) {

    return (
      <Navigate
        to={user.role === 'teacher' ? '/teacher' : '/student'}
        replace
      />
    );

  }

  return children;

}



function AppRoutes() {

  const { user } = useAuth();

  const redirectPath =
    user?.role === 'teacher'
      ? '/teacher'
      : '/student';

  return (

    <Routes>

      <Route
        path="/login"
        element={
          user
            ? <Navigate to={redirectPath} replace />
            : <Login />
        }
      />

      <Route
        path="/register"
        element={
          user
            ? <Navigate to={redirectPath} replace />
            : <Register />
        }
      />

      <Route
        path="/student"
        element={
          <ProtectedRoute role="student">
            <StudentDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/teacher"
        element={
          <ProtectedRoute role="teacher">
            <TeacherDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/"
        element={
          <Navigate
            to={user ? redirectPath : '/login'}
            replace
          />
        }
      />

    </Routes>

  );

}



export default function App() {

  return (

    <BrowserRouter>

      <AuthProvider>

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              borderRadius: '12px',
              fontFamily: 'inherit'
            }
          }}
        />

        <AppRoutes />

      </AuthProvider>

    </BrowserRouter>

  );

}