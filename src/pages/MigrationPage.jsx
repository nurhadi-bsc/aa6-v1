import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, doc, getDocs, setDoc, deleteField } from 'firebase/firestore';
import { db } from '../services/firebase';
import Navbar from '../components/layout/Navbar';
import { Navigate } from 'react-router-dom';

const DETAIL_FIELDS = [
  'residentStatus',
  'residentPhone',
  'ownerName',
  'ownerPhone',
  'emergencyName',
  'emergencyPhone',
  'history',
  'updatedAt',
  'updatedBy',
];

export default function MigrationPage() {
  const { userData } = useAuth();
  const [status, setStatus] = useState('idle'); // idle | running | done | error
  const [log, setLog] = useState([]);

  // Hanya Super Admin yang boleh mengakses halaman ini.
  if (userData?.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  function addLog(msg) {
    setLog((prev) => [...prev, msg]);
  }

  async function runMigration() {
    setStatus('running');
    setLog([]);
    addLog('Memulai migrasi data rumah ke struktur 2 tingkat...');

    try {
      const snap = await getDocs(collection(db, 'houses'));
      addLog(`Ditemukan ${snap.size} dokumen rumah untuk diperiksa.`);

      let migrated = 0;
      let skipped = 0;

      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const houseNumber = data.houseNumber || Number(docSnap.id);

        // Deteksi apakah dokumen ini masih format lama (punya field kontak di dokumen utama).
        const hasOldFields = DETAIL_FIELDS.some((f) => data[f] !== undefined);

        if (!hasOldFields) {
          skipped++;
          continue;
        }

        const detailPayload = {};
        DETAIL_FIELDS.forEach((f) => {
          if (data[f] !== undefined) detailPayload[f] = data[f];
        });

        // Tulis ke subcollection detail (Tier 2)
        await setDoc(doc(db, 'houses', String(houseNumber), 'detail', 'info'), detailPayload, { merge: true });

        // Bersihkan dokumen utama: sisakan hanya houseNumber + residentName (Tier 1)
        const clearPayload = {};
        DETAIL_FIELDS.forEach((f) => {
          clearPayload[f] = deleteField();
        });
        await setDoc(
          doc(db, 'houses', String(houseNumber)),
          { houseNumber, residentName: data.residentName || '', ...clearPayload },
          { merge: true }
        );

        migrated++;
        addLog(`✓ Rumah No. ${houseNumber} berhasil dipisah.`);
      }

      addLog(`Selesai. ${migrated} rumah dimigrasi, ${skipped} rumah sudah dalam format baru (dilewati).`);
      setStatus('done');
    } catch (err) {
      console.error(err);
      addLog(`✗ Terjadi kesalahan: ${err.message}`);
      setStatus('error');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        <div>
          <h1 className="text-2xl font-bold text-slate-900">Migrasi Struktur Data Rumah</h1>
          <p className="text-sm text-slate-600 mt-1">
            Alat sekali-pakai untuk memisahkan data rumah lama (format gabung) menjadi 2 tingkat:
            data publik (nama & nomor rumah) dan data kontak (khusus pengurus).
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-3 rounded-lg">
          <strong>Penting:</strong> Jalankan ini HANYA SEKALI setelah update Firestore Security Rules ke versi
          terbaru (yang mendukung subcollection <code>detail</code>). Menjalankan ulang tidak akan merusak data
          yang sudah bermigrasi (otomatis dilewati), tapi tetap disarankan hanya dijalankan sekali untuk kehati-hatian.
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
          <button
            onClick={runMigration}
            disabled={status === 'running'}
            className="bg-teal-800 hover:bg-teal-900 text-white font-medium py-2.5 px-6 rounded-lg shadow transition-colors text-sm disabled:opacity-50"
          >
            {status === 'running' ? 'Sedang memigrasi...' : 'Jalankan Migrasi'}
          </button>

          {log.length > 0 && (
            <div className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs font-mono max-h-80 overflow-y-auto space-y-1">
              {log.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          )}

          {status === 'done' && (
            <p className="text-sm text-emerald-700 font-medium">
              Migrasi selesai. Silakan cek halaman "Data Rumah & Warga" untuk verifikasi.
            </p>
          )}
        </div>

      </main>
    </div>
  );
}