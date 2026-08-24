import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
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

export default function KasPage() {
  const { userData } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('IPL'); // 'IPL' | 'Kas'

  const role = userData?.role || 'user';
  const isSuperAdmin = role === 'super_admin';

  useEffect(() => {
    async function fetchTransactions() {
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
    fetchTransactions();
  }, []);

  const dataByCategory = useMemo(() => {
    const filtered = transactions.filter((t) => t.category === activeTab);
    const saldo = filtered.reduce((sum, t) => {
      return t.type === 'pemasukan' ? sum + (t.amount || 0) : sum - (t.amount || 0);
    }, 0);
    return { list: filtered, saldo };
  }, [transactions, activeTab]);

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
            onClick={() => setActiveTab('IPL')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'IPL' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'
            }`}
          >
            Iuran IPL
          </button>
          <button
            onClick={() => setActiveTab('Kas')}
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
        </div>

        {/* Riwayat Transaksi */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 text-sm">
              Riwayat Transaksi {activeTab === 'IPL' ? 'IPL' : 'Kas'}
            </h2>
            {isSuperAdmin && (
              <button
                className="text-xs font-medium bg-teal-800 hover:bg-teal-900 text-white px-3 py-1.5 rounded-lg transition-colors"
                onClick={() => alert('Halaman input transaksi belum dibuat di v1.')}
              >
                + Tambah Transaksi
              </button>
            )}
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
                <li key={t.id} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {t.description || (t.type === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran')}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDate(t.date)}</p>
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      t.type === 'pemasukan' ? 'text-emerald-600' : 'text-red-500'
                    }`}
                  >
                    {t.type === 'pemasukan' ? '+' : '-'} {formatRupiah(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

      </main>
    </div>
  );
}