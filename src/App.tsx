import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Import Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import KasPage from './pages/KasPage';
import DatabaseRumahPage from './pages/DatabaseRumahPage';

// Komponen Proteksi Halaman (Harus Login)
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth() as { currentUser: any };
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// Komponen Proteksi Tamu (Jika sudah login, arahkan ke dashboard)
function GuestRoute({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth() as { currentUser: any };
  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public / Guest Routes */}
          <Route path="/" element={<GuestRoute><LandingPage /></GuestRoute>} />
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />

          {/* Protected Routes (Harus Login) */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/kas" element={<ProtectedRoute><KasPage /></ProtectedRoute>} />
          <Route path="/database" element={<ProtectedRoute><DatabaseRumahPage /></ProtectedRoute>} />
          
          {/* Fallback jika URL tidak ditemukan */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}