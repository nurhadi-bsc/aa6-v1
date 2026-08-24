import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/database', label: 'Data Rumah & Warga' },
  { to: '/kas', label: 'Kas' },
  { to: '/info-penting', label: 'Info Penting' },
];

export default function Navbar() {
  const { currentUser, userData, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = userData?.role || 'user';
  const isSuperAdmin = role === 'super_admin';
  const isPengurus = role === 'admin' || isSuperAdmin;

  const roleLabel = isSuperAdmin ? 'Super Admin' : isPengurus ? 'Pengurus' : 'Warga';

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Gagal logout', err);
    }
  }

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  return (
    <nav className="bg-teal-900 text-white shadow-md relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-2">

          {/* Logo / Brand */}
          <Link
            to="/dashboard"
            className="font-bold text-base sm:text-lg tracking-wider flex-shrink-0"
            onClick={closeMobileMenu}
          >
            Warga <span className="text-amber-400 font-normal">Valres AA6</span>
          </Link>

          {currentUser && (
            <div className="flex items-center gap-2 flex-shrink-0">

              {/* Link navigasi: hanya tampil di layar lebar (lg ke atas) */}
              <div className="hidden lg:flex items-center space-x-5 mr-3">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="text-sm font-medium hover:text-amber-300 transition-colors whitespace-nowrap"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              {/* Badge nama & role: disembunyikan di layar sangat sempit agar tidak mendesak tombol lain */}
              <span className="hidden md:inline-block text-xs bg-teal-800 px-2.5 py-1 rounded-full whitespace-nowrap">
                {userData?.name || 'User'} ({roleLabel})
              </span>

              {/* Tombol Keluar: SELALU tampil di semua ukuran layar, tidak pernah disembunyikan */}
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-medium whitespace-nowrap flex-shrink-0"
              >
                Keluar
              </button>

              {/* Tombol Hamburger: hanya tampil di bawah lg, untuk membuka link navigasi */}
              <button
                onClick={() => setMobileOpen((v) => !v)}
                className="lg:hidden p-2 -mr-1 rounded-lg hover:bg-teal-800 transition-colors flex-shrink-0"
                aria-label="Buka menu navigasi"
              >
                {mobileOpen ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Mobile Dropdown Menu: hanya berisi link navigasi (Keluar sudah selalu tampil di atas) */}
      {currentUser && mobileOpen && (
        <div className="lg:hidden bg-teal-900 border-t border-teal-800 shadow-lg">
          <div className="px-4 py-3 space-y-1">
            <div className="md:hidden text-xs text-teal-300 px-3 pb-2">
              {userData?.name || 'User'} &middot; {roleLabel}
            </div>
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={closeMobileMenu}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-teal-800 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}