import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { currentUser, userData, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Gagal logout', err);
    }
  }

  return (
    <nav className="bg-teal-900 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          
          {/* Logo / Brand */}
          <div className="flex items-center space-x-3">
            <Link to="/dashboard" className="font-bold text-lg tracking-wider">
              VALRES <span className="text-amber-400">AA6</span>
            </Link>
          </div>

          {/* Navigation Links (jika sudah login) */}
          {currentUser && (
            <div className="flex items-center space-x-4 sm:space-x-6">
              <Link to="/dashboard" className="text-sm font-medium hover:text-amber-300 transition-colors">
                Dashboard
              </Link>
              <Link to="/database" className="text-sm font-medium hover:text-amber-300 transition-colors">
                Database Rumah
              </Link>
              
              {/* Menu khusus Admin */}
              {userData?.role === 'admin' && (
                <Link to="/add-house" className="text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors">
                  + Tambah Rumah
                </Link>
              )}

              {/* User Info & Logout */}
              <div className="flex items-center space-x-3 pl-2 border-l border-teal-700">
                <span className="text-xs hidden sm:inline-block bg-teal-800 px-2.5 py-1 rounded-full">
                  {userData?.name || 'User'} ({userData?.role || 'user'})
                </span>
                <button
                  onClick={handleLogout}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-medium"
                >
                  Keluar
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </nav>
  );
}