import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const WARNING_SECONDS = 30;

// Warga: 10 menit. Pengurus & Super Admin: 30 menit (lebih longgar karena kerja admin
// sering butuh fokus lama tanpa interaksi cepat, namun tetap ada jaring pengaman —
// bukan tanpa batas — mengingat mereka memegang akses tulis/hapus data sensitif).
const TIMEOUTS_MS = {
  user: 10 * 60 * 1000,
  admin: 30 * 60 * 1000,
  super_admin: 30 * 60 * 1000,
};

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

export default function IdleLogoutManager() {
  const { currentUser, userData, logout } = useAuth();
  const navigate = useNavigate();

  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WARNING_SECONDS);

  const warningTimerRef = useRef(null);
  const logoutTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  const role = userData?.role || 'user';
  const timeoutMs = TIMEOUTS_MS[role] ?? TIMEOUTS_MS.user;

  function clearAllTimers() {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  }

  async function handleAutoLogout() {
    clearAllTimers();
    setShowWarning(false);
    try {
      await logout();
    } catch (err) {
      console.error('Gagal logout otomatis karena tidak aktif:', err);
    }
    navigate('/login?reason=idle', { replace: true });
  }

  function startCountdown() {
    setSecondsLeft(WARNING_SECONDS);
    countdownIntervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
  }

  function resetTimers() {
    clearAllTimers();
    setShowWarning(false);

    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      startCountdown();
    }, Math.max(timeoutMs - WARNING_SECONDS * 1000, 0));

    logoutTimerRef.current = setTimeout(handleAutoLogout, timeoutMs);
  }

  useEffect(() => {
    if (!currentUser) {
      clearAllTimers();
      setShowWarning(false);
      return;
    }

    resetTimers();

    // Aktivitas apa pun (termasuk saat peringatan sedang tampil) mengatur ulang timer
    // dan menyembunyikan peringatan — pola standar idle-timeout, tidak memaksa klik tombol.
    const handleActivity = () => resetTimers();

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handleActivity));

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handleActivity));
      clearAllTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, timeoutMs]);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-amber-100 mx-auto flex items-center justify-center text-xl">
          ⏳
        </div>
        <h2 className="text-lg font-bold text-slate-900">Sesi Akan Berakhir</h2>
        <p className="text-sm text-slate-600">
          Anda akan logout otomatis karena tidak ada aktivitas dalam{' '}
          <strong className="text-red-600">{secondsLeft} detik</strong>.
        </p>
        <button
          onClick={resetTimers}
          className="w-full bg-teal-800 hover:bg-teal-900 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
        >
          Tetap Login
        </button>
      </div>
    </div>
  );
}
