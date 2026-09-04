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
import InfoPentingPage from './pages/InfoPentingPage';
import PendingApprovalPage from './pages/PendingApprovalPage';
import AccountApprovalPage from './pages/AccountApprovalPage';
import IdleLogoutManager from './components/IdleLogoutManager';

// Komponen Proteksi Halaman (Harus Login + Akun Disetujui)
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, userData } = useAuth() as { currentUser: any; userData: any };
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Hanya akun dengan role 'user' yang wajib melalui persetujuan Pengurus.
  // Akun admin/super_admin dianggap sudah terverifikasi melalui proses penunjukan role.
  const role = userData?.role || 'user';
  const status = userData?.status;
  if (role === 'user' && (status === 'pending' || status === 'rejected')) {
    return <Navigate to="/pending-approval" replace />;
  }

  return <>{children}</>;
}

// Komponen Proteksi Tamu (Jika sudah login, arahkan ke dashboard/halaman status)
function GuestRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, userData } = useAuth() as { currentUser: any; userData: any };
  if (currentUser) {
    const role = userData?.role || 'user';
    const status = userData?.status;
    if (role === 'user' && (status === 'pending' || status === 'rejected')) {
      return <Navigate to="/pending-approval" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <IdleLogoutManager />
        <Routes>
          {/* Public / Guest Routes */}
          <Route path="/" element={<GuestRoute><LandingPage /></GuestRoute>} />
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />

          {/* Halaman status akun pending/ditolak: hanya butuh login, TIDAK melalui ProtectedRoute
              (agar tidak terjadi redirect loop bagi akun yang belum disetujui) */}
          <Route path="/pending-approval" element={<PendingApprovalPage />} />

          {/* Protected Routes (Harus Login + Disetujui) */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/kas" element={<ProtectedRoute><KasPage /></ProtectedRoute>} />
          <Route path="/database" element={<ProtectedRoute><DatabaseRumahPage /></ProtectedRoute>} />
          <Route path="/info-penting" element={<ProtectedRoute><InfoPentingPage /></ProtectedRoute>} />
          <Route path="/verifikasi-akun" element={<ProtectedRoute><AccountApprovalPage /></ProtectedRoute>} />

          {/* Fallback jika URL tidak ditemukan */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
