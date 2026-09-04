import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isIdleLogout = searchParams.get('reason') === 'idle';

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      await login(email, password);
      navigate('/dashboard'); // Pindah ke dashboard setelah berhasil login
    } catch (err) {
      setError('Gagal masuk. Periksa kembali email dan password Anda.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">Masuk ke VALRES AA6</h1>
          <p className="text-sm text-slate-600">Silakan masukkan akun Anda</p>
        </div>

        {/* Idle Logout Info */}
        {isIdleLogout && !error && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm">
            Anda telah logout otomatis karena tidak ada aktivitas. Silakan masuk kembali.
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-800 text-sm"
              placeholder="nama@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-800 text-sm"
              placeholder="••••••••"
            />
          </div>

          <button
            disabled={loading}
            type="submit"
            className="w-full bg-teal-800 hover:bg-teal-900 text-white font-medium py-2.5 px-4 rounded-lg shadow transition-colors text-sm disabled:opacity-50"
          >
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        {/* Footer Link */}
        <div className="text-center text-sm text-slate-600 pt-2 border-t border-slate-100">
          Belum memiliki akun?{' '}
          <Link to="/register" className="text-teal-800 font-medium hover:underline">
            Daftar sebagai Warga Baru
          </Link>
        </div>

        {/* Back to Home */}
        <div className="text-center">
          <Link to="/" className="text-xs text-slate-400 hover:text-teal-800 transition-colors">
            ← Kembali ke Halaman Utama
          </Link>
        </div>

      </div>
    </div>
  );
}
