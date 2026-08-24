import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import Navbar from '../components/layout/Navbar';

function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatDate(ts) {
  if (!ts) return '-';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

const emptyForm = {
  type: 'pemasukan',
  amount: '',
  description: '',
  date: new Date().toISOString().slice(0, 10),
};

export default function KasPage() {
  const { userData } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('IPL'); // 'IPL' | 'Kas'

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const role = userData?.role || 'user';
  const isSuperAdmin = role === 'super_admin';

  useEffect(() => {
    fetchTransactions();
  }, []);

  async function fetchTransactions() {
    setLoading(true);
    try {
      const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
      const snap = await getDocs(q);
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Gagal mengambil data transaksi:', err);
    } finally {
      setLoading(false);
    }
  }

  const dataByCategory = useMemo(() => {
    const filtered = transactions.filter((t) => t.category === activeTab);
    const saldo = filtered.reduce((sum, t) => {
      return t.type === 'pemasukan' ? sum + (t.amount || 0) : sum - (t.amount || 0);
    }, 0);
    return { list: filtered, saldo };
  }, [transactions, activeTab]);

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setShowForm(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const amountNumber = Number(form.amount);
    if (!amountNumber || amountNumber <= 0) {
      alert('Nominal transaksi wajib diisi dan lebih besar dari nol.');
      return;
    }
    if (!form.description.trim()) {
      alert('Keterangan transaksi wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'transactions'), {
        type: form.type,
        category: activeTab, // otomatis ikut tab yang sedang aktif (IPL / Kas)
        amount: amountNumber,
        description: form.description.trim(),
        date: new Date(form.date).toISOString(),
        createdBy: userData?.name || 'Tidak diketahui',
        createdAt: new Date().toISOString(),
      });
      resetForm();
      fetchTransactions();
    } catch (err) {
      console.error('Gagal menyimpan transaksi:', err);
      alert('Gagal menyimpan transaksi. Silakan coba kembali.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id, description) {
    const confirmed = window.confirm(`Hapus transaksi "${description}"? Tindakan ini tidak dapat dibatalkan.`);
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'transactions', id));
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error('Gagal menghapus transaksi:', err);
      alert('Gagal menghapus transaksi. Silakan coba kembali.');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        <div>
          <h1 className="text-2xl font-bold text-slate-900">Info Iuran / Kas</h1>
          <p className="text-sm text-slate-600 mt-1">
            Ringkasan saldo dan riwayat transaksi lingkungan Valencia Residence AA6.
          </p>
        </div>

        {/* Tab Switcher: IPL vs Kas */}
        <div className="inline-flex bg-slate-200 rounded-lg p-1">
          <button
            onClick={() => { setActiveTab('IPL'); resetForm(); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'IPL' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'
            }`}
          >
            Iuran IPL
          </button>
          <button
            onClick={() => { setActiveTab('Kas'); resetForm(); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'Kas' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'
            }`}
          >
            Iuran Kas
          </button>
        </div>

        {/* Saldo Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <p className="text-xs font-semibold tracking-wider text-teal-800 uppercase bg-teal-50 inline-block px-2.5 py-1 rounded-full">
            Saldo {activeTab === 'IPL' ? 'Iuran IPL' : 'Iuran Kas'}
          </p>
          <p className="text-3xl font-bold text-slate-900 mt-3">
            {loading ? '...' : formatRupiah(dataByCategory.saldo)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Total akumulasi seluruh warga, belum dipecah per rumah.
          </p>
          <p className="text-[11px] text-slate-400 mt-2">
            Per tanggal {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Form Tambah Transaksi */}
        {isSuperAdmin && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <button
              onClick={() => setShowForm((v) => !v)}
              className="w-full px-6 py-3 flex items-center justify-between text-sm font-semibold text-teal-800 hover:bg-teal-50 transition-colors"
            >
              <span>{showForm ? 'Tutup Formulir' : `+ Tambah Transaksi ${activeTab}`}</span>
              <span>{showForm ? '−' : '+'}</span>
            </button>

            {showForm && (
              <form onSubmit={handleSubmit} className="px-6 pb-6 pt-2 space-y-4 border-t border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Jenis Transaksi <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.type}
                      onChange={(e) => updateField('type', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-800"
                    >
                      <option value="pemasukan">Pemasukan</option>
                      <option value="pengeluaran">Pengeluaran</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nominal (Rp) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={form.amount}
                      onChange={(e) => updateField('amount', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-800"
                      placeholder="500000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Keterangan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-800"
                    placeholder={activeTab === 'IPL' ? 'Contoh: Iuran IPL bulan Januari 2027' : 'Contoh: Perbaikan pos satpam'}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tanggal <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => updateField('date', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-800"
                  />
                </div>

                <p className="text-[11px] text-slate-400">
                  Transaksi akan tercatat pada kategori <strong>Iuran {activeTab}</strong> (sesuai tab yang aktif).
                </p>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-teal-800 hover:bg-teal-900 text-white font-medium py-2 px-5 rounded-lg shadow transition-colors text-sm disabled:opacity-50"
                  >
                    {saving ? 'Menyimpan...' : 'Simpan Transaksi'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-slate-600 hover:text-slate-800 font-medium py-2 px-4 text-sm"
                  >
                    Batal
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Riwayat Transaksi */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 text-sm">
              Riwayat Transaksi {activeTab === 'IPL' ? 'IPL' : 'Kas'}
            </h2>
          </div>

          {loading ? (
            <p className="px-6 py-8 text-sm text-slate-400 text-center">Memuat data...</p>
          ) : dataByCategory.list.length === 0 ? (
            <p className="px-6 py-8 text-sm text-slate-400 text-center">
              Belum ada transaksi {activeTab === 'IPL' ? 'IPL' : 'Kas'} tercatat.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {dataByCategory.list.map((t) => (
                <li key={t.id} className="px-6 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {t.description || (t.type === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran')}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDate(t.date)}
                      {isSuperAdmin && t.createdBy && ` • dicatat oleh ${t.createdBy}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span
                      className={`text-sm font-semibold whitespace-nowrap ${
                        t.type === 'pemasukan' ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      {t.type === 'pemasukan' ? '+' : '-'} {formatRupiah(t.amount)}
                    </span>

                    {isSuperAdmin && (
                      <button
                        onClick={() => handleDelete(t.id, t.description)}
                        className="text-[11px] font-medium text-red-600 hover:underline"
                      >
                        Hapus
                      </button>
                    )}
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