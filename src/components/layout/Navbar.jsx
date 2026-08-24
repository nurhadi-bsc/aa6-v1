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
  const [menuOpen, setMenuOpen] = useState(false);

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

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <nav className="bg-teal-900 text-white shadow-md relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-2">

          {/* Logo / Brand */}
          <Link
            to="/dashboard"
            className="font-bold text-base sm:text-lg tracking-wider"
            onClick={closeMenu}
          >
            Warga <span className="text-amber-400 font-normal">Valres AA6</span>
          </Link>

          {/* Tombol Menu & Keluar: SATU pola yang sama di semua ukuran layar, tidak ada elemen yang disembunyikan berdasarkan lebar layar */}
          {currentUser && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 bg-teal-800 hover:bg-teal-700 text-white text-xs sm:text-sm font-medium px-3 py-2 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Menu
              </button>

              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm px-3 py-2 rounded-lg transition-colors font-medium"
              >
                Keluar
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Dropdown Menu: sama persis di semua ukuran layar, dikontrol murni oleh state, bukan CSS breakpoint */}
      {currentUser && menuOpen && (
        <div className="bg-teal-900 border-t border-teal-800 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-1">
            <div className="text-xs text-teal-300 px-3 pb-2">
              {userData?.name || 'User'} &middot; {roleLabel}
            </div>
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={closeMenu}
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