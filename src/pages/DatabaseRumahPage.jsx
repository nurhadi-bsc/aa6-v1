import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  arrayUnion,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import Navbar from '../components/layout/Navbar';

const TOTAL_HOUSES = 105;
const STATUS_OPTIONS = ['Pemilik Rumah', 'Kontrak/Sewa', 'Kosong (Tidak Dihuni)'];

// Field yang tergolong PUBLIK (Tier 1) — boleh dilihat semua warga.
// residentStatus disertakan agar status "Kosong (Tidak Dihuni)" transparan untuk semua warga
// (sudah disepakati bersama warga, bukan disembunyikan seperti data kontak lainnya).
const PUBLIC_FIELDS = ['residentName', 'residentStatus'];

// Field yang tergolong data KONTAK (Tier 2) — hanya Pengurus/Super Admin.
const DETAIL_FIELDS = [
  'residentPhone',
  'ownerName',
  'ownerPhone',
  'emergencyName',
  'emergencyPhone',
];

function formatDate(ts) {
  if (!ts) return '-';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const emptyForm = {
  residentName: '',
  residentStatus: 'Pemilik Rumah',
  residentPhone: '',
  ownerName: '',
  ownerPhone: '',
  emergencyName: '',
  emergencyPhone: '',
  changeNote: '',
};

export default function DatabaseRumahPage() {
  const { userData } = useAuth();
  const role = userData?.role || 'user';
  const isPengurus = role === 'admin' || role === 'super_admin';

  const [view, setView] = useState('list'); // 'list' | 'form' | 'requests'
  const [houses, setHouses] = useState({}); // { [houseNumber]: { residentName, ...detail jika pengurus } }
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');

  const [selectedNumber, setSelectedNumber] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [existingHistory, setExistingHistory] = useState([]);
  const [hasExistingData, setHasExistingData] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [wargaNotice, setWargaNotice] = useState(null); // { houseNumber }

  const houseNumberOptions = useMemo(
    () => Array.from({ length: TOTAL_HOUSES }, (_, i) => i + 1),
    []
  );

  // Mendukung akun lama (houseNumber tunggal) maupun akun baru (houseNumbers array),
  // agar warga bisa memiliki lebih dari satu rumah.
  const myHouseNumbers = !isPengurus
    ? (userData?.houseNumbers || (userData?.houseNumber ? [userData.houseNumber] : []))
    : [];

  // Warga boleh memilih: rumah yang sudah menjadi miliknya (untuk diperbarui),
  // ATAU rumah yang belum ada datanya sama sekali (untuk klaim rumah tambahan).
  const selectableHouseNumbers = isPengurus
    ? houseNumberOptions
    : houseNumberOptions.filter((num) => myHouseNumbers.includes(num) || !houses[num]);

  useEffect(() => {
    fetchAllHouses();
    if (isPengurus) fetchPendingRequests();
  }, []);

  // Mengambil data Tier 1 (publik) untuk semua orang, ditambah Tier 2 (kontak) khusus Pengurus.
  // Detail diambil per-dokumen (bukan collectionGroup) agar tidak butuh index tambahan,
  // dan hanya untuk rumah yang sudah terisi (bukan semua 105).
  async function fetchAllHouses() {
    setLoadingList(true);
    try {
      const publicSnap = await getDocs(collection(db, 'houses'));
      const map = {};
      publicSnap.docs.forEach((d) => {
        const data = d.data();
        map[data.houseNumber] = { id: d.id, ...data };
      });

      // Tampilkan dulu data publik segera, supaya tidak kosong seluruhnya
      // kalau proses pengambilan detail di bawah ini gagal.
      setHouses(map);

      if (isPengurus) {
        const filledNumbers = Object.keys(map);
        const detailResults = await Promise.all(
          filledNumbers.map(async (num) => {
            try {
              const detailSnap = await getDoc(doc(db, 'houses', String(num), 'detail', 'info'));
              return { num, data: detailSnap.exists() ? detailSnap.data() : null };
            } catch (err) {
              console.error(`Gagal memuat detail Rumah No. ${num}:`, err);
              return { num, data: null };
            }
          })
        );

        const mergedMap = { ...map };
        detailResults.forEach(({ num, data }) => {
          if (data) mergedMap[num] = { ...mergedMap[num], ...data };
        });
        setHouses(mergedMap);
      }
    } catch (err) {
      console.error('Gagal memuat data rumah:', err);
    } finally {
      setLoadingList(false);
    }
  }

  async function fetchPendingRequests() {
    setLoadingRequests(true);
    try {
      const q = query(collection(db, 'house_requests'), where('status', '==', 'pending'));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(a.requestedAt) - new Date(b.requestedAt));
      setPendingRequests(list);
    } catch (err) {
      console.error('Gagal memuat permintaan konfirmasi:', err);
      alert('Gagal memuat daftar permintaan konfirmasi. Periksa koneksi atau coba muat ulang halaman.');
    } finally {
      setLoadingRequests(false);
    }
  }

  // Mengambil data lengkap satu rumah (Tier 1 + Tier 2 jika Pengurus) saat form dibuka.
  async function handleSelectNumber(num) {
    setSelectedNumber(num);
    setForm(emptyForm);
    setExistingHistory([]);
    setHasExistingData(false);
    if (!num) return;

    setLoadingForm(true);
    try {
      const publicRef = doc(db, 'houses', String(num));
      const publicSnap = await getDoc(publicRef);

      if (publicSnap.exists()) {
        let combined = publicSnap.data();

        if (isPengurus) {
          const detailRef = doc(db, 'houses', String(num), 'detail', 'info');
          const detailSnap = await getDoc(detailRef);
          if (detailSnap.exists()) {
            combined = { ...combined, ...detailSnap.data() };
          }
        }

        setForm({
          residentName: combined.residentName || '',
          residentStatus: combined.residentStatus || 'Pemilik Rumah',
          residentPhone: combined.residentPhone || '',
          ownerName: combined.ownerName || '',
          ownerPhone: combined.ownerPhone || '',
          emergencyName: combined.emergencyName || '',
          emergencyPhone: combined.emergencyPhone || '',
          changeNote: '',
        });
        setExistingHistory(combined.history || []);
        setHasExistingData(true);
      }
    } catch (err) {
      console.error('Gagal memuat data rumah terpilih:', err);
    } finally {
      setLoadingForm(false);
    }
  }

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const requiresOwnerInfo = form.residentStatus !== 'Pemilik Rumah';
  const isEmptyStatus = form.residentStatus === 'Kosong (Tidak Dihuni)';

  function validate() {
    if (!selectedNumber) return 'Nomor rumah wajib dipilih.';
    if (!isEmptyStatus) {
      if (!form.residentName.trim()) return 'Nama penghuni wajib diisi.';
      if (!form.residentPhone.trim()) return 'Nomor HP penghuni wajib diisi.';
    }
    if (requiresOwnerInfo) {
      if (!form.ownerName.trim()) return 'Nama pemilik rumah wajib diisi untuk status kontrak/sewa atau rumah kosong.';
      if (!form.ownerPhone.trim()) return 'Nomor HP pemilik rumah wajib diisi untuk status kontrak/sewa atau rumah kosong.';
    }
    if (!form.emergencyName.trim()) return 'Nama kontak darurat wajib diisi.';
    if (!form.emergencyPhone.trim()) return 'Nomor HP kontak darurat wajib diisi.';
    return null;
  }

  function buildFieldPayload() {
    return {
      residentName: isEmptyStatus ? '' : form.residentName.trim(),
      residentStatus: form.residentStatus,
      residentPhone: isEmptyStatus ? '' : form.residentPhone.trim(),
      ownerName: requiresOwnerInfo ? form.ownerName.trim() : '',
      ownerPhone: requiresOwnerInfo ? form.ownerPhone.trim() : '',
      emergencyName: form.emergencyName.trim(),
      emergencyPhone: form.emergencyPhone.trim(),
    };
  }

  // Memisahkan field gabungan menjadi Tier 1 (publik) dan Tier 2 (kontak).
  function splitFields(fields) {
    const publicPart = {};
    const detailPart = {};
    Object.entries(fields).forEach(([key, value]) => {
      if (PUBLIC_FIELDS.includes(key)) publicPart[key] = value;
      else if (DETAIL_FIELDS.includes(key)) detailPart[key] = value;
    });
    return { publicPart, detailPart };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const error = validate();
    if (error) {
      alert(error);
      return;
    }

    setSaving(true);
    try {
      const fields = buildFieldPayload();
      const isNew = existingHistory.length === 0;
      const { publicPart, detailPart } = splitFields(fields);

      if (isPengurus) {
        const historyEntry = {
          date: new Date().toISOString(),
          note: form.changeNote.trim() || (isNew ? 'Data awal didaftarkan.' : 'Pembaruan data oleh pengurus.'),
          updatedBy: userData?.name || 'Tidak diketahui',
        };

        // Tier 1: publik
        await setDoc(
          doc(db, 'houses', String(selectedNumber)),
          { houseNumber: selectedNumber, ...publicPart },
          { merge: true }
        );

        // Tier 2: kontak (subcollection)
        await setDoc(
          doc(db, 'houses', String(selectedNumber), 'detail', 'info'),
          {
            ...detailPart,
            updatedAt: new Date().toISOString(),
            updatedBy: userData?.name || 'Tidak diketahui',
            history: arrayUnion(historyEntry),
          },
          { merge: true }
        );

        alert('Data rumah berhasil disimpan.');
      } else {
        // Warga: tetap dikirim sebagai satu pengajuan gabungan (house_requests sudah private,
        // hanya bisa dibaca Pengurus, jadi tidak perlu dipisah tier di tahap pengajuan).
        await addDoc(collection(db, 'house_requests'), {
          houseNumber: selectedNumber,
          requestedData: fields,
          changeNote: form.changeNote.trim(),
          isNewEntry: isNew,
          requestedBy: userData?.name || 'Tidak diketahui',
          requestedByUid: userData?.uid || null,
          requestedAt: new Date().toISOString(),
          status: 'pending',
        });

        setWargaNotice({ houseNumber: selectedNumber });
      }

      setView('list');
      fetchAllHouses();
    } catch (err) {
      console.error('Gagal menyimpan data rumah:', err);
      alert('Gagal menyimpan data. Silakan coba kembali.');
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(request) {
    setProcessingId(request.id);
    try {
      const { publicPart, detailPart } = splitFields(request.requestedData);
      const historyEntry = {
        date: new Date().toISOString(),
        note:
          request.changeNote ||
          (request.isNewEntry ? 'Data awal didaftarkan oleh warga.' : 'Pembaruan data oleh warga.'),
        updatedBy: request.requestedBy,
      };

      await setDoc(
        doc(db, 'houses', String(request.houseNumber)),
        { houseNumber: request.houseNumber, ...publicPart },
        { merge: true }
      );

      await setDoc(
        doc(db, 'houses', String(request.houseNumber), 'detail', 'info'),
        {
          ...detailPart,
          updatedAt: new Date().toISOString(),
          updatedBy: request.requestedBy,
          history: arrayUnion(historyEntry),
        },
        { merge: true }
      );

      if (request.requestedByUid) {
        // Tambahkan nomor rumah ke daftar rumah milik warga (arrayUnion mencegah duplikat
        // dan tidak menimpa rumah lain yang sudah dimiliki — mendukung warga multi-rumah).
        await setDoc(
          doc(db, 'users', request.requestedByUid),
          { houseNumbers: arrayUnion(request.houseNumber) },
          { merge: true }
        );
      }

      await updateDoc(doc(db, 'house_requests', request.id), {
        status: 'approved',
        reviewedBy: userData?.name || 'Tidak diketahui',
        reviewedAt: new Date().toISOString(),
      });

      setPendingRequests((prev) => prev.filter((r) => r.id !== request.id));
      fetchAllHouses();
    } catch (err) {
      console.error('Gagal mengkonfirmasi permintaan:', err);
      alert('Gagal mengkonfirmasi permintaan. Silakan coba kembali.');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(request) {
    const confirmed = window.confirm(
      `Tolak permintaan perubahan data Rumah No. ${request.houseNumber} dari ${request.requestedBy}?`
    );
    if (!confirmed) return;

    setProcessingId(request.id);
    try {
      await updateDoc(doc(db, 'house_requests', request.id), {
        status: 'rejected',
        reviewedBy: userData?.name || 'Tidak diketahui',
        reviewedAt: new Date().toISOString(),
      });
      setPendingRequests((prev) => prev.filter((r) => r.id !== request.id));
    } catch (err) {
      console.error('Gagal menolak permintaan:', err);
      alert('Gagal menolak permintaan. Silakan coba kembali.');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleDeleteHouse() {
    if (!isPengurus || !selectedNumber) return;
    const confirmed = window.confirm(
      `Hapus seluruh data Rumah No. ${selectedNumber}?\n\nSeluruh data penghuni dan riwayat perubahan akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      // Hapus kedua tier: subcollection 'detail' dulu, baru dokumen utama.
      await deleteDoc(doc(db, 'houses', String(selectedNumber), 'detail', 'info'));
      await deleteDoc(doc(db, 'houses', String(selectedNumber)));

      alert(`Data Rumah No. ${selectedNumber} berhasil dihapus.`);
      setSelectedNumber('');
      setForm(emptyForm);
      setExistingHistory([]);
      setHasExistingData(false);
      setView('list');
      fetchAllHouses();
    } catch (err) {
      console.error('Gagal menghapus data rumah:', err);
      alert('Gagal menghapus data. Silakan coba kembali.');
    } finally {
      setDeleting(false);
    }
  }

  // Ekspor seluruh data rumah & warga (105 baris, termasuk yang belum terisi) ke file Excel.
  // Library 'xlsx' di-load secara dinamis (hanya saat tombol ini diklik) agar tidak
  // membebani ukuran bundle untuk semua pengguna yang tidak memakai fitur ini.
  const [exporting, setExporting] = useState(false);

  async function exportToExcel() {
    setExporting(true);
    try {
      const XLSX = await import('xlsx');

      const rows = houseNumberOptions.map((num) => {
        const h = houses[num] || {};
        return {
          'No. Rumah': num,
          'Nama Penghuni': h.residentName || '',
          'Status Penghunian': h.residentStatus || 'Belum ada data',
          'No. HP Penghuni': h.residentPhone || '',
          'Nama Pemilik Rumah': h.ownerName || '',
          'No. HP Pemilik Rumah': h.ownerPhone || '',
          'Nama Kontak Darurat': h.emergencyName || '',
          'No. HP Kontak Darurat': h.emergencyPhone || '',
          'Terakhir Diperbarui': h.updatedAt ? formatDate(h.updatedAt) : '',
          'Diperbarui Oleh': h.updatedBy || '',
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = [
        { wch: 10 }, { wch: 25 }, { wch: 20 }, { wch: 16 }, { wch: 25 },
        { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 20 }, { wch: 20 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Rumah & Warga');

      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `Data-Rumah-Warga-AA6-${today}.xlsx`);
    } catch (err) {
      console.error('Gagal mengekspor data ke Excel:', err);
      alert('Gagal mengekspor data. Silakan coba kembali.');
    } finally {
      setExporting(false);
    }
  }

  const filledCount = Object.keys(houses).length;

  const filteredHouseNumbers = houseNumberOptions.filter((num) => {
    if (!search) return true;
    const h = houses[num];
    const term = search.toLowerCase();
    return (
      String(num).includes(term) ||
      (h?.residentName || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Data Rumah & Warga</h1>
            <p className="text-sm text-slate-600 mt-1">
              Direktori terpadu data rumah dan penghuni Valencia Residence AA6.
            </p>
          </div>

          <div className="inline-flex bg-slate-200 rounded-lg p-1 self-start flex-wrap">
            <button
              onClick={() => setView('list')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                view === 'list' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'
              }`}
            >
              Lihat Data
            </button>
            <button
              onClick={() => { setView('form'); setWargaNotice(null); }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                view === 'form' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'
              }`}
            >
              Isi / Perbarui Data
            </button>
            {isPengurus && (
              <button
                onClick={() => setView('requests')}
                className={`relative px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  view === 'requests' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'
                }`}
              >
                Permintaan Konfirmasi
                {pendingRequests.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full w-4 h-4">
                    {pendingRequests.length}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* ================= LIST VIEW ================= */}
        {view === 'list' && (
          <>
            {wargaNotice && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-800">
                    Data Rumah No. {wargaNotice.houseNumber} berhasil dikirim
                  </p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Perubahan Anda sedang menunggu konfirmasi dari admin/pengurus sebelum berlaku secara resmi.
                    Anda akan melihat data terbaru setelah disetujui.
                  </p>
                </div>
                <button
                  onClick={() => setWargaNotice(null)}
                  className="text-emerald-500 hover:text-emerald-700 flex-shrink-0"
                  aria-label="Tutup notifikasi"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                {loadingList ? 'Memuat...' : `${filledCount} dari ${TOTAL_HOUSES} rumah telah memiliki data.`}
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Cari nomor atau nama..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-800 w-full sm:w-52"
                />
                {isPengurus && (
                  <button
                    onClick={exportToExcel}
                    disabled={loadingList || exporting}
                    className="flex items-center gap-1.5 text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {exporting ? 'Menyiapkan...' : '⬇ Export Excel'}
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              {loadingList ? (
                <p className="px-6 py-10 text-sm text-slate-400 text-center">Memuat data...</p>
              ) : (
                <ul className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                  {filteredHouseNumbers.map((num) => {
                    const h = houses[num];
                    return (
                      <li key={num} className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-9 rounded-lg bg-teal-800 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {num}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {!h ? (
                                <span className="text-slate-400 font-normal italic">Belum ada data</span>
                              ) : h.residentStatus === 'Kosong (Tidak Dihuni)' ? (
                                <span className="text-amber-700">Kosong (Tidak Dihuni)</span>
                              ) : (
                                h.residentName
                              )}
                            </p>
                            {isPengurus && h && (
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {h.residentStatus}{h.residentPhone && ` • ${h.residentPhone}`}
                                {h.updatedAt && ` • Diperbarui ${formatDate(h.updatedAt)}`}
                              </p>
                            )}
                          </div>
                        </div>

                        {isPengurus && h && (
                          <button
                            onClick={() => {
                              setView('form');
                              handleSelectNumber(num);
                            }}
                            className="text-[11px] font-medium text-teal-800 hover:underline flex-shrink-0"
                          >
                            Lihat / Edit
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {!isPengurus && (
              <p className="text-xs text-slate-400">
                Untuk keperluan privasi, warga hanya dapat melihat nomor rumah dan nama penghuni.
                Detail kontak dikelola oleh pengurus lingkungan.
              </p>
            )}
          </>
        )}

        {/* ================= FORM VIEW ================= */}
        {view === 'form' && (
          <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-5">

            {!isPengurus && (
              <div className="bg-teal-50 border border-teal-200 text-teal-800 text-xs px-4 py-2.5 rounded-lg">
                Perubahan yang Anda kirimkan akan ditinjau terlebih dahulu oleh admin/pengurus sebelum berlaku secara resmi.
              </div>
            )}

            {!isPengurus && myHouseNumbers.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 text-slate-600 text-xs px-4 py-2.5 rounded-lg">
                Rumah Anda: <strong>{myHouseNumbers.map((n) => `No. ${n}`).join(', ')}</strong>. Anda dapat
                memperbarui data rumah tersebut, atau memilih nomor rumah lain yang belum terdata di bawah
                untuk mendaftarkan rumah tambahan (jika Anda memiliki lebih dari satu rumah).
              </div>
            )}

            {!isPengurus && myHouseNumbers.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-2.5 rounded-lg">
                Anda belum terhubung dengan rumah manapun. Pilih nomor rumah Anda dari daftar rumah yang belum
                terdata di bawah ini untuk mendaftarkan data rumah Anda untuk pertama kali.
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nomor Rumah <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={selectedNumber}
                onChange={(e) => handleSelectNumber(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-800 text-sm"
              >
                <option value="">Pilih nomor rumah</option>
                {selectableHouseNumbers.map((num) => (
                  <option key={num} value={num}>
                    Rumah No. {num} {myHouseNumbers.includes(num) ? '(milik Anda)' : houses[num] ? '(sudah ada data)' : ''}
                  </option>
                ))}
              </select>
              {!isPengurus && selectableHouseNumbers.length === 0 && (
                <p className="text-[11px] text-red-500 mt-1">
                  Seluruh {TOTAL_HOUSES} rumah sudah memiliki data terdaftar. Hubungi pengurus jika rumah Anda
                  belum tercatat.
                </p>
              )}
            </div>

            {loadingForm && (
              <p className="text-xs text-slate-400">Memuat data rumah yang dipilih...</p>
            )}

            {selectedNumber && !loadingForm && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Status Penghunian <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={form.residentStatus}
                      onChange={(e) => updateField('residentStatus', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-800 text-sm"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {!isEmptyStatus && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Nama Penghuni <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required={!isEmptyStatus}
                          value={form.residentName}
                          onChange={(e) => updateField('residentName', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-800 text-sm"
                          placeholder="Nama lengkap penghuni"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Nomor HP Penghuni <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required={!isEmptyStatus}
                          value={form.residentPhone}
                          onChange={(e) => updateField('residentPhone', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-800 text-sm"
                          placeholder="+62812xxxxxxxx"
                        />
                      </div>
                    </>
                  )}
                </div>

                {isEmptyStatus && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-2.5 rounded-lg">
                    Rumah berstatus kosong (tidak dihuni). Data pemilik di bawah ini akan menjadi kontak
                    utama untuk rumah ini.
                  </div>
                )}

                {requiresOwnerInfo && (
                  <div className="border-t border-slate-100 pt-4 space-y-4">
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                      Data Pemilik Rumah (wajib untuk status kontrak/sewa atau rumah kosong)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Nama Pemilik Rumah <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required={requiresOwnerInfo}
                          value={form.ownerName}
                          onChange={(e) => updateField('ownerName', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-800 text-sm"
                          placeholder="Nama lengkap pemilik rumah"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Nomor HP Pemilik Rumah <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required={requiresOwnerInfo}
                          value={form.ownerPhone}
                          onChange={(e) => updateField('ownerPhone', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-800 text-sm"
                          placeholder="+62812xxxxxxxx"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="border-t border-slate-100 pt-4 space-y-4">
                  <p className="text-xs font-semibold text-teal-800 uppercase tracking-wide">
                    Kontak Darurat
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Nama Kontak Darurat <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={form.emergencyName}
                        onChange={(e) => updateField('emergencyName', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-800 text-sm"
                        placeholder="Nama kerabat/kontak darurat"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Nomor HP Kontak Darurat <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={form.emergencyPhone}
                        onChange={(e) => updateField('emergencyPhone', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-800 text-sm"
                        placeholder="+62812xxxxxxxx"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Catatan Perubahan
                  </label>
                  <textarea
                    value={form.changeNote}
                    onChange={(e) => updateField('changeNote', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-800 text-sm"
                    placeholder="Contoh: Penghuni berganti dari kontrak menjadi pemilik, per Januari 2027."
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Opsional, namun disarankan diisi setiap kali terjadi perubahan data (misalnya pergantian status
                    kontrak/sewa) agar tercatat dalam riwayat.
                  </p>
                </div>

                {existingHistory.length > 0 && (
                  <div className="border-t border-slate-100 pt-4">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                      Riwayat Perubahan
                    </p>
                    <ul className="space-y-2 max-h-40 overflow-y-auto">
                      {[...existingHistory].reverse().map((h, i) => (
                        <li key={i} className="text-xs bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                          <p className="text-slate-700">{h.note}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {formatDate(h.date)} • oleh {h.updatedBy}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-teal-800 hover:bg-teal-900 text-white font-medium py-2.5 px-6 rounded-lg shadow transition-colors text-sm disabled:opacity-50"
                  >
                    {saving
                      ? 'Menyimpan...'
                      : isPengurus
                      ? 'Simpan Data'
                      : 'Simpan Data & Kirim Konfirmasi ke Admin'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('list')}
                    className="text-slate-600 hover:text-slate-800 font-medium py-2.5 px-4 text-sm"
                  >
                    Batal
                  </button>

                  {role === 'super_admin' && hasExistingData && (
                    <button
                      type="button"
                      onClick={handleDeleteHouse}
                      disabled={deleting}
                      className="ml-auto text-red-600 hover:text-red-700 hover:bg-red-50 font-medium py-2.5 px-4 rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      {deleting ? 'Menghapus...' : 'Hapus Data Rumah'}
                    </button>
                  )}
                </div>
              </>
            )}
          </form>
        )}

        {/* ================= REQUESTS VIEW (khusus Pengurus) ================= */}
        {view === 'requests' && isPengurus && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 text-sm">Permintaan Konfirmasi dari Warga</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Perubahan berikut menunggu peninjauan sebelum berlaku secara resmi.
              </p>
            </div>

            {loadingRequests ? (
              <p className="px-6 py-10 text-sm text-slate-400 text-center">Memuat permintaan...</p>
            ) : pendingRequests.length === 0 ? (
              <p className="px-6 py-10 text-sm text-slate-400 text-center">
                Tidak ada permintaan konfirmasi yang menunggu saat ini.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {pendingRequests.map((r) => (
                  <li key={r.id} className="px-4 sm:px-6 py-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Rumah No. {r.houseNumber}
                          {r.isNewEntry && (
                            <span className="ml-2 text-[10px] font-medium bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                              Data Baru
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Diajukan oleh {r.requestedBy} • {formatDate(r.requestedAt)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs bg-slate-50 border border-slate-100 rounded-lg p-3">
                      <p><span className="text-slate-400">Nama Penghuni:</span> {r.requestedData.residentName}</p>
                      <p><span className="text-slate-400">Status:</span> {r.requestedData.residentStatus}</p>
                      <p><span className="text-slate-400">HP Penghuni:</span> {r.requestedData.residentPhone}</p>
                      {r.requestedData.ownerName && (
                        <p><span className="text-slate-400">Pemilik Rumah:</span> {r.requestedData.ownerName} ({r.requestedData.ownerPhone})</p>
                      )}
                      <p><span className="text-slate-400">Kontak Darurat:</span> {r.requestedData.emergencyName} ({r.requestedData.emergencyPhone})</p>
                      {r.changeNote && (
                        <p className="sm:col-span-2 pt-1 border-t border-slate-200 mt-1">
                          <span className="text-slate-400">Catatan:</span> {r.changeNote}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(r)}
                        disabled={processingId === r.id}
                        className="text-xs font-medium bg-teal-800 hover:bg-teal-900 text-white px-4 py-1.5 rounded-lg disabled:opacity-50"
                      >
                        {processingId === r.id ? '...' : 'Konfirmasi'}
                      </button>
                      <button
                        onClick={() => handleReject(r)}
                        disabled={processingId === r.id}
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

      </main>
    </div>
  );
}
