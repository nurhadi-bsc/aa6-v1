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

const ROLE_LABELS = {
  user: 'Warga',
  admin: 'Pengurus',
  super_admin: 'Super Admin',
};

export default function AccountApprovalPage() {
  const { userData } = useAuth();
  const role = userData?.role || 'user';
  const isPengurus = role === 'admin' || role === 'super_admin';
  const isSuperAdmin = role === 'super_admin';

  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'approved' | 'rejected'
  const [processingId, setProcessingId] = useState(null);

  const [pendingUsers, setPendingUsers] = useState([]);
  const [loadingPending, setLoadingPending] = useState(true);

  const [approvedUsers, setApprovedUsers] = useState([]);
  const [loadingApproved, setLoadingApproved] = useState(false);
  const [approvedLoaded, setApprovedLoaded] = useState(false);

  const [rejectedUsers, setRejectedUsers] = useState([]);
  const [loadingRejected, setLoadingRejected] = useState(false);
  const [rejectedLoaded, setRejectedLoaded] = useState(false);

  const [accessCode, setAccessCode] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [savingCode, setSavingCode] = useState(false);
  const [loadingCode, setLoadingCode] = useState(true);

  const [migrating, setMigrating] = useState(false);
  const [migrationDone, setMigrationDone] = useState(false);
  const [migrationLog, setMigrationLog] = useState([]);

  const [migratingHouses, setMigratingHouses] = useState(false);
  const [houseMigrationDone, setHouseMigrationDone] = useState(false);
  const [houseMigrationLog, setHouseMigrationLog] = useState([]);

  useEffect(() => {
    if (!isPengurus) return;
    fetchPendingUsers();
    if (isSuperAdmin) fetchAccessCode();
  }, []);

  // Ambil daftar akun sesuai tab yang dipilih, hanya dimuat sekali per tab (lazy-load)
  // agar tidak boros pembacaan Firestore untuk data yang belum tentu dilihat.
  useEffect(() => {
    if (activeTab === 'approved' && !approvedLoaded) fetchUsersByStatus('approved');
    if (activeTab === 'rejected' && !rejectedLoaded) fetchUsersByStatus('rejected');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  function sortByCreatedAt(list) {
    return [...list].sort((a, b) => {
      const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return bTime - aTime; // terbaru dulu
    });
  }

  async function fetchPendingUsers() {
    setLoadingPending(true);
    try {
      const q = query(collection(db, 'users'), where('status', '==', 'pending'));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPendingUsers(sortByCreatedAt(list).reverse()); // pending: yang paling lama menunggu di atas
    } catch (err) {
      console.error('Gagal memuat daftar akun menunggu persetujuan:', err);
      alert('Gagal memuat daftar akun. Periksa koneksi atau coba muat ulang halaman.');
    } finally {
      setLoadingPending(false);
    }
  }

  async function fetchUsersByStatus(status) {
    const setLoading = status === 'approved' ? setLoadingApproved : setLoadingRejected;
    const setList = status === 'approved' ? setApprovedUsers : setRejectedUsers;
    const setLoaded = status === 'approved' ? setApprovedLoaded : setRejectedLoaded;

    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('status', '==', status));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setList(sortByCreatedAt(list));
      setLoaded(true);
    } catch (err) {
      console.error(`Gagal memuat daftar akun berstatus ${status}:`, err);
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

  // Migrasi sekali-jalan: akun yang didaftarkan SEBELUM fitur persetujuan ini ada
  // tidak memiliki field 'status' sama sekali. Migrasi ini menandai mereka sebagai
  // 'approved' (karena secara de facto sudah aktif & terpakai), agar muncul di riwayat.
  async function runLegacyMigration() {
    setMigrating(true);
    setMigrationLog(['Memeriksa seluruh akun...']);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const legacyDocs = snap.docs.filter((d) => d.data().status === undefined);

      setMigrationLog((prev) => [...prev, `Ditemukan ${legacyDocs.length} akun lama tanpa status.`]);

      for (const d of legacyDocs) {
        await updateDoc(doc(db, 'users', d.id), {
          status: 'approved',
          reviewedBy: 'Migrasi otomatis',
          reviewedAt: new Date().toISOString(),
        });
        setMigrationLog((prev) => [...prev, `✓ ${d.data().name || d.id} ditandai sebagai disetujui.`]);
      }

      setMigrationLog((prev) => [...prev, 'Migrasi selesai.']);
      setMigrationDone(true);

      // Refresh data yang sedang tampil supaya langsung terlihat hasilnya.
      fetchPendingUsers();
      if (approvedLoaded) fetchUsersByStatus('approved');
      if (rejectedLoaded) fetchUsersByStatus('rejected');
    } catch (err) {
      console.error('Gagal migrasi akun lama:', err);
      setMigrationLog((prev) => [...prev, `✗ Terjadi kesalahan: ${err.message}`]);
    } finally {
      setMigrating(false);
    }
  }

  // Migrasi sekali-jalan: akun yang didaftarkan sebelum fitur multi-rumah masih memakai
  // field 'houseNumber' tunggal (kadang tersimpan tidak konsisten sebagai string).
  // Migrasi ini menormalisasi ke 'houseNumbers' (array angka), agar dropdown klaim rumah
  // tambahan bekerja dengan benar untuk akun lama.
  async function runHouseNumberMigration() {
    setMigratingHouses(true);
    setHouseMigrationLog(['Memeriksa seluruh akun untuk field houseNumber lama...']);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const legacyDocs = snap.docs.filter((d) => {
        const data = d.data();
        return data.houseNumber !== undefined && data.houseNumbers === undefined;
      });

      setHouseMigrationLog((prev) => [...prev, `Ditemukan ${legacyDocs.length} akun dengan houseNumber lama.`]);

      for (const d of legacyDocs) {
        const data = d.data();
        const normalizedNumber = Number(data.houseNumber);
        await setDoc(
          doc(db, 'users', d.id),
          { houseNumbers: [normalizedNumber] },
          { merge: true }
        );
        setHouseMigrationLog((prev) => [
          ...prev,
          `✓ ${data.name || d.id}: houseNumber ${JSON.stringify(data.houseNumber)} → houseNumbers [${normalizedNumber}]`,
        ]);
      }

      setHouseMigrationLog((prev) => [...prev, 'Migrasi selesai.']);
      setHouseMigrationDone(true);
    } catch (err) {
      console.error('Gagal migrasi houseNumber:', err);
      setHouseMigrationLog((prev) => [...prev, `✗ Terjadi kesalahan: ${err.message}`]);
    } finally {
      setMigratingHouses(false);
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
      // Perbarui juga daftar Disetujui kalau sudah pernah dimuat, supaya tetap sinkron.
      if (approvedLoaded) {
        setApprovedUsers((prev) => sortByCreatedAt([
          { ...u, status: 'approved', reviewedBy: userData?.name, reviewedAt: new Date().toISOString() },
          ...prev,
        ]));
      }
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
      if (rejectedLoaded) {
        setRejectedUsers((prev) => sortByCreatedAt([
          { ...u, status: 'rejected', reviewedBy: userData?.name, reviewedAt: new Date().toISOString() },
          ...prev,
        ]));
      }
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
            Tinjau pendaftaran akun warga, termasuk riwayat akun yang sudah disetujui maupun ditolak.
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

        {/* Panel Migrasi Akun Lama — khusus Super Admin, jalankan sekali saja */}
        {isSuperAdmin && !migrationDone && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
              Migrasi Akun Lama (Sekali Jalan)
            </p>
            <p className="text-xs text-amber-700">
              Akun yang didaftarkan sebelum fitur persetujuan ini ada belum memiliki status. Jalankan ini
              satu kali agar akun-akun tersebut muncul di tab "Disetujui" pada riwayat di bawah.
            </p>
            <button
              onClick={runLegacyMigration}
              disabled={migrating}
              className="text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {migrating ? 'Memproses...' : 'Jalankan Migrasi Akun Lama'}
            </button>
            {migrationLog.length > 0 && (
              <div className="bg-slate-900 text-slate-100 rounded-lg p-3 text-[11px] font-mono max-h-40 overflow-y-auto space-y-0.5">
                {migrationLog.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Panel Migrasi Nomor Rumah — khusus Super Admin, jalankan sekali saja */}
        {isSuperAdmin && !houseMigrationDone && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
              Migrasi Nomor Rumah ke Format Multi-Rumah (Sekali Jalan)
            </p>
            <p className="text-xs text-amber-700">
              Akun yang terhubung ke rumah sebelum fitur multi-rumah ada masih memakai format lama
              (houseNumber tunggal). Jalankan ini satu kali agar akun tersebut bisa mengklaim rumah
              tambahan dengan benar.
            </p>
            <button
              onClick={runHouseNumberMigration}
              disabled={migratingHouses}
              className="text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {migratingHouses ? 'Memproses...' : 'Jalankan Migrasi Nomor Rumah'}
            </button>
            {houseMigrationLog.length > 0 && (
              <div className="bg-slate-900 text-slate-100 rounded-lg p-3 text-[11px] font-mono max-h-40 overflow-y-auto space-y-0.5">
                {houseMigrationLog.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Switcher */}
        <div className="inline-flex bg-slate-200 rounded-lg p-1 flex-wrap">
          <button
            onClick={() => setActiveTab('pending')}
            className={`relative px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'pending' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'
            }`}
          >
            Menunggu
            {pendingUsers.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full w-4 h-4">
                {pendingUsers.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'approved' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'
            }`}
          >
            Disetujui
          </button>
          <button
            onClick={() => setActiveTab('rejected')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'rejected' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'
            }`}
          >
            Ditolak
          </button>
        </div>

        {/* ============ TAB: MENUNGGU ============ */}
        {activeTab === 'pending' && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 text-sm">Akun Menunggu Persetujuan</h2>
            </div>

            {loadingPending ? (
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
        )}

        {/* ============ TAB: DISETUJUI ============ */}
        {activeTab === 'approved' && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 text-sm">Akun Disetujui</h2>
              <p className="text-xs text-slate-500 mt-0.5">Urut dari yang terbaru disetujui.</p>
            </div>

            {loadingApproved ? (
              <p className="px-6 py-10 text-sm text-slate-400 text-center">Memuat data...</p>
            ) : approvedUsers.length === 0 ? (
              <p className="px-6 py-10 text-sm text-slate-400 text-center">
                Belum ada akun yang disetujui.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {approvedUsers.map((u) => (
                  <li key={u.id} className="px-4 sm:px-6 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{u.name}</p>
                        <p className="text-xs text-slate-500 truncate">{u.email} {u.phone && `• ${u.phone}`}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Daftar {formatDate(u.createdAt)}
                          {u.reviewedAt && ` • Disetujui ${formatDate(u.reviewedAt)}`}
                          {u.reviewedBy && ` oleh ${u.reviewedBy}`}
                        </p>
                      </div>
                      <span className="text-[10px] font-medium bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex-shrink-0">
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ============ TAB: DITOLAK ============ */}
        {activeTab === 'rejected' && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 text-sm">Akun Ditolak</h2>
              <p className="text-xs text-slate-500 mt-0.5">Urut dari yang terbaru ditolak.</p>
            </div>

            {loadingRejected ? (
              <p className="px-6 py-10 text-sm text-slate-400 text-center">Memuat data...</p>
            ) : rejectedUsers.length === 0 ? (
              <p className="px-6 py-10 text-sm text-slate-400 text-center">
                Belum ada akun yang ditolak.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {rejectedUsers.map((u) => (
                  <li key={u.id} className="px-4 sm:px-6 py-3">
                    <p className="text-sm font-semibold text-slate-900">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.email} {u.phone && `• ${u.phone}`}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Daftar {formatDate(u.createdAt)}
                      {u.reviewedAt && ` • Ditolak ${formatDate(u.reviewedAt)}`}
                      {u.reviewedBy && ` oleh ${u.reviewedBy}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
