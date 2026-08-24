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
        <div className="flex justify-between h-16 items-center">

          {/* Logo / Brand */}
          <div className="flex items-center space-x-3">
            <Link to="/dashboard" className="font-bold text-lg tracking-wider" onClick={closeMobileMenu}>
              Warga <span className="text-amber-400 font-normal">Valres AA6</span>
            </Link>
          </div>

          {/* Navigation Links (Desktop) */}
          {currentUser && (
            <div className="flex items-center space-x-3 sm:space-x-5">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-sm font-medium hover:text-amber-300 transition-colors hidden lg:inline-block"
                >
                  {link.label}
                </Link>
              ))}

              {/* User Info & Logout (Desktop) */}
              <div className="hidden lg:flex items-center space-x-3 pl-2 border-l border-teal-700">
                <span className="text-xs bg-teal-800 px-2.5 py-1 rounded-full">
                  {userData?.name || 'User'} ({roleLabel})
                </span>
                <button
                  onClick={handleLogout}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-medium"
                >
                  Keluar
                </button>
              </div>

              {/* Hamburger Button (Mobile) */}
              <button
                onClick={() => setMobileOpen((v) => !v)}
                className="lg:hidden p-2 -mr-2 rounded-lg hover:bg-teal-800 transition-colors"
                aria-label="Buka menu navigasi"
              >
                {mobileOpen ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {currentUser && mobileOpen && (
        <div className="lg:hidden bg-teal-900 border-t border-teal-800 shadow-lg">
          <div className="px-4 py-3 space-y-1">
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

            <div className="pt-3 mt-2 border-t border-teal-800 flex items-center justify-between">
              <span className="text-xs bg-teal-800 px-2.5 py-1 rounded-full">
                {userData?.name || 'User'} ({roleLabel})
              </span>
              <button
                onClick={() => {
                  closeMobileMenu();
                  handleLogout();
                }}
                className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-medium"
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}