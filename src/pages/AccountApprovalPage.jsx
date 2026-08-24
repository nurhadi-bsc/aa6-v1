import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import Navbar from '../components/layout/Navbar';
import { Navigate } from 'react-router-dom';

function formatDate(ts) {
  if (!ts) return '-';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AccountApprovalPage() {
  const { userData } = useAuth();
  const role = userData?.role || 'user';
  const isPengurus = role === 'admin' || role === 'super_admin';
  const isSuperAdmin = role === 'super_admin';

  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const [accessCode, setAccessCode] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [savingCode, setSavingCode] = useState(false);
  const [loadingCode, setLoadingCode] = useState(true);

  useEffect(() => {
    if (!isPengurus) return;
    fetchPendingUsers();
    if (isSuperAdmin) fetchAccessCode();
  }, []);

  async function fetchPendingUsers() {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('status', '==', 'pending'));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return aTime - bTime;
      });
      setPendingUsers(list);
    } catch (err) {
      console.error('Gagal memuat daftar akun menunggu persetujuan:', err);
      alert('Gagal memuat daftar akun. Periksa koneksi atau coba muat ulang halaman.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchAccessCode() {
    setLoadingCode(true);
    try {
      const ref = doc(db, 'public_config', 'registration');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setAccessCode(snap.data().code || '');
        setCodeInput(snap.data().code || '');
      }
    } catch (err) {
      console.error('Gagal memuat kode registrasi:', err);
    } finally {
      setLoadingCode(false);
    }
  }

  async function saveAccessCode() {
    if (!codeInput.trim()) {
      alert('Kode akses tidak boleh kosong.');
      return;
    }
    setSavingCode(true);
    try {
      await setDoc(doc(db, 'public_config', 'registration'), {
        code: codeInput.trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: userData?.name || 'Tidak diketahui',
      });
      setAccessCode(codeInput.trim());
      alert('Kode akses berhasil diperbarui.');
    } catch (err) {
      console.error('Gagal menyimpan kode akses:', err);
      alert('Gagal menyimpan kode akses.');
    } finally {
      setSavingCode(false);
    }
  }

  async function handleApprove(u) {
    setProcessingId(u.id);
    try {
      await updateDoc(doc(db, 'users', u.id), {
        status: 'approved',
        reviewedBy: userData?.name || 'Tidak diketahui',
        reviewedAt: new Date().toISOString(),
      });
      setPendingUsers((prev) => prev.filter((p) => p.id !== u.id));
    } catch (err) {
      console.error('Gagal menyetujui akun:', err);
      alert('Gagal menyetujui akun. Silakan coba kembali.');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(u) {
    const confirmed = window.confirm(`Tolak pendaftaran akun "${u.name}" (${u.email})?`);
    if (!confirmed) return;

    setProcessingId(u.id);
    try {
      await updateDoc(doc(db, 'users', u.id), {
        status: 'rejected',
        reviewedBy: userData?.name || 'Tidak diketahui',
        reviewedAt: new Date().toISOString(),
      });
      setPendingUsers((prev) => prev.filter((p) => p.id !== u.id));
    } catch (err) {
      console.error('Gagal menolak akun:', err);
      alert('Gagal menolak akun. Silakan coba kembali.');
    } finally {
      setProcessingId(null);
    }
  }

  if (!isPengurus) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        <div>
          <h1 className="text-2xl font-bold text-slate-900">Verifikasi Akun Warga</h1>
          <p className="text-sm text-slate-600 mt-1">
            Tinjau pendaftaran akun baru sebelum warga dapat mengakses aplikasi.
          </p>
        </div>

        {/* Panel Kode Akses — khusus Super Admin */}
        {isSuperAdmin && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-3">
            <p className="text-xs font-semibold text-teal-800 uppercase tracking-wide">Kode Akses Warga</p>
            <p className="text-xs text-slate-500">
              Kode ini wajib dimasukkan warga saat mendaftar. Bagikan hanya melalui grup WhatsApp warga resmi.
            </p>
            {loadingCode ? (
              <p className="text-xs text-slate-400">Memuat...</p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-800"
                  placeholder="Contoh: AA6-2026"
                />
                <button
                  onClick={saveAccessCode}
                  disabled={savingCode}
                  className="bg-teal-800 hover:bg-teal-900 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  {savingCode ? 'Menyimpan...' : 'Simpan Kode'}
                </button>
              </div>
            )}
            {accessCode && (
              <p className="text-[11px] text-slate-400">Kode aktif saat ini: <strong>{accessCode}</strong></p>
            )}
          </div>
        )}

        {/* Daftar Akun Pending */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 text-sm">Akun Menunggu Persetujuan</h2>
          </div>

          {loading ? (
            <p className="px-6 py-10 text-sm text-slate-400 text-center">Memuat data...</p>
          ) : pendingUsers.length === 0 ? (
            <p className="px-6 py-10 text-sm text-slate-400 text-center">
              Tidak ada akun yang menunggu persetujuan saat ini.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pendingUsers.map((u) => (
                <li key={u.id} className="px-4 sm:px-6 py-4 space-y-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.email} {u.phone && `• ${u.phone}`}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Daftar {formatDate(u.createdAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(u)}
                      disabled={processingId === u.id}
                      className="text-xs font-medium bg-teal-800 hover:bg-teal-900 text-white px-4 py-1.5 rounded-lg disabled:opacity-50"
                    >
                      {processingId === u.id ? '...' : 'Setujui'}
                    </button>
                    <button
                      onClick={() => handleReject(u)}
                      disabled={processingId === u.id}
                      className="text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 px-4 py-1.5 rounded-lg disabled:opacity-50"
                    >
                      Tolak
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

      </main>
    </div>
  );
}