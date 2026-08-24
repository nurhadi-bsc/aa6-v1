import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PendingApprovalPage() {
  const { userData, logout } = useAuth();
  const navigate = useNavigate();
  const isRejected = userData?.status === 'rejected';

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center space-y-4">

        <div className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center text-2xl ${
          isRejected ? 'bg-red-100' : 'bg-amber-100'
        }`}>
          {isRejected ? '✕' : '⏳'}
        </div>

        <h1 className="text-xl font-bold text-slate-900">
          {isRejected ? 'Pendaftaran Ditolak' : 'Menunggu Persetujuan'}
        </h1>

        <p className="text-sm text-slate-600 leading-relaxed">
          {isRejected
            ? 'Pendaftaran akun Anda tidak dapat disetujui oleh pengurus lingkungan. Jika Anda merasa ini keliru, silakan hubungi pengurus secara langsung.'
            : 'Akun Anda berhasil didaftarkan dan sedang menunggu persetujuan dari pengurus lingkungan Valencia Residence AA6. Anda akan dapat mengakses aplikasi setelah disetujui.'}
        </p>

        <p className="text-xs text-slate-400">
          Selamat datang, {userData?.name || 'warga'}. Silakan cek kembali secara berkala atau hubungi
          pengurus untuk mempercepat proses.
        </p>

        <button
          onClick={handleLogout}
          className="text-sm font-medium text-teal-800 hover:underline pt-2"
        >
          Keluar
        </button>

      </div>
    </div>
  );
}