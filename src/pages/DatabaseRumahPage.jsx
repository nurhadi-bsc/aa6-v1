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
const STATUS_OPTIONS = ['Pemilik Rumah', 'Kontrak/Sewa'];

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
  const [houses, setHouses] = useState({}); // { [houseNumber]: data }
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

  const houseNumberOptions = useMemo(
    () => Array.from({ length: TOTAL_HOUSES }, (_, i) => i + 1),
    []
  );

  useEffect(() => {
    fetchAllHouses();
    if (isPengurus) fetchPendingRequests();
  }, []);

  async function fetchAllHouses() {
    setLoadingList(true);
    try {
      const q = query(collection(db, 'houses'), orderBy('houseNumber', 'asc'));
      const snap = await getDocs(q);
      const map = {};
      snap.docs.forEach((d) => {
        map[d.data().houseNumber] = { id: d.id, ...d.data() };
      });
      setHouses(map);
    } catch (err) {
      console.error('Gagal memuat data rumah:', err);
    } finally {
      setLoadingList(false);
    }
  }

  async function fetchPendingRequests() {
    setLoadingRequests(true);
    try {
      const q = query(
        collection(db, 'house_requests'),
        where('status', '==', 'pending'),
        orderBy('requestedAt', 'asc')
      );
      const snap = await getDocs(q);
      setPendingRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Gagal memuat permintaan konfirmasi:', err);
    } finally {
      setLoadingRequests(false);
    }
  }

  async function handleSelectNumber(num) {
    setSelectedNumber(num);
    setForm(emptyForm);
    setExistingHistory([]);
    setHasExistingData(false);
    if (!num) return;

    setLoadingForm(true);
    try {
      const ref = doc(db, 'houses', String(num));
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setForm({
          residentName: data.residentName || '',
          residentStatus: data.residentStatus || 'Pemilik Rumah',
          residentPhone: data.residentPhone || '',
          ownerName: data.ownerName || '',
          ownerPhone: data.ownerPhone || '',
          emergencyName: data.emergencyName || '',
          emergencyPhone: data.emergencyPhone || '',
          changeNote: '',
        });
        setExistingHistory(data.history || []);
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

  function validate() {
    if (!selectedNumber) return 'Nomor rumah wajib dipilih.';
    if (!form.residentName.trim()) return 'Nama penghuni wajib diisi.';
    if (!form.residentPhone.trim()) return 'Nomor HP penghuni wajib diisi.';
    if (requiresOwnerInfo) {
      if (!form.ownerName.trim()) return 'Nama pemilik rumah wajib diisi untuk status kontrak/sewa.';
      if (!form.ownerPhone.trim()) return 'Nomor HP pemilik rumah wajib diisi untuk status kontrak/sewa.';
    }
    if (!form.emergencyName.trim()) return 'Nama kontak darurat wajib diisi.';
    if (!form.emergencyPhone.trim()) return 'Nomor HP kontak darurat wajib diisi.';
    return null;
  }

  function buildFieldPayload() {
    return {
      residentName: form.residentName.trim(),
      residentStatus: form.residentStatus,
      residentPhone: form.residentPhone.trim(),
      ownerName: requiresOwnerInfo ? form.ownerName.trim() : '',
      ownerPhone: requiresOwnerInfo ? form.ownerPhone.trim() : '',
      emergencyName: form.emergencyName.trim(),
      emergencyPhone: form.emergencyPhone.trim(),
    };
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

      if (isPengurus) {
        // Pengurus & Super Admin: perubahan langsung berlaku, tanpa perlu konfirmasi.
        const ref = doc(db, 'houses', String(selectedNumber));
        const historyEntry = {
          date: new Date().toISOString(),
          note: form.changeNote.trim() || (isNew ? 'Data awal didaftarkan.' : 'Pembaruan data oleh pengurus.'),
          updatedBy: userData?.name || 'Tidak diketahui',
        };

        await setDoc(
          ref,
          {
            houseNumber: selectedNumber,
            ...fields,
            updatedAt: new Date().toISOString(),
            updatedBy: userData?.name || 'Tidak diketahui',
            history: arrayUnion(historyEntry),
          },
          { merge: true }
        );

        alert('Data rumah berhasil disimpan.');
      } else {
        // Warga: perubahan dikirim sebagai permintaan, menunggu konfirmasi pengurus.
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

        alert('Perubahan berhasil dikirim dan menunggu konfirmasi dari admin/pengurus.');
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
      const ref = doc(db, 'houses', String(request.houseNumber));
      const historyEntry = {
        date: new Date().toISOString(),
        note:
          request.changeNote ||
          (request.isNewEntry ? 'Data awal didaftarkan oleh warga.' : 'Pembaruan data oleh warga.'),
        updatedBy: request.requestedBy,
      };

      await setDoc(
        ref,
        {
          houseNumber: request.houseNumber,
          ...request.requestedData,
          updatedAt: new Date().toISOString(),
          updatedBy: request.requestedBy,
          history: arrayUnion(historyEntry),
        },
        { merge: true }
      );

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
              onClick={() => setView('form')}
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
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                {loadingList ? 'Memuat...' : `${filledCount} dari ${TOTAL_HOUSES} rumah telah memiliki data.`}
              </p>
              <input
                type="text"
                placeholder="Cari nomor atau nama..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-800 w-52"
              />
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
                              {h?.residentName || <span className="text-slate-400 font-normal italic">Belum ada data</span>}
                            </p>
                            {isPengurus && h && (
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {h.residentStatus} • {h.residentPhone}
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
                <option value="">Pilih nomor rumah (1–{TOTAL_HOUSES})</option>
                {houseNumberOptions.map((num) => (
                  <option key={num} value={num}>
                    Rumah No. {num} {houses[num] ? '(sudah ada data)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {loadingForm && (
              <p className="text-xs text-slate-400">Memuat data rumah yang dipilih...</p>
            )}

            {selectedNumber && !loadingForm && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nama Penghuni <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.residentName}
                      onChange={(e) => updateField('residentName', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-800 text-sm"
                      placeholder="Nama lengkap penghuni"
                    />
                  </div>

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

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nomor HP Penghuni <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.residentPhone}
                      onChange={(e) => updateField('residentPhone', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-800 text-sm"
                      placeholder="+62812xxxxxxxx"
                    />
                  </div>
                </div>

                {requiresOwnerInfo && (
                  <div className="border-t border-slate-100 pt-4 space-y-4">
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                      Data Pemilik Rumah (wajib untuk status kontrak/sewa)
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