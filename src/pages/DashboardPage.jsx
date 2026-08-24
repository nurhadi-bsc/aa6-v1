import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import Navbar from '../components/layout/Navbar';

const TOTAL_HOUSES = 105;

export default function DashboardPage() {
  const { userData } = useAuth();
  const [filledHouses, setFilledHouses] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingAccountCount, setPendingAccountCount] = useState(0);
  const [saldoIPL, setSaldoIPL] = useState(0);
  const [saldoKas, setSaldoKas] = useState(0);
  const [loading, setLoading] = useState(true);

  const role = userData?.role || 'user';
  const isSuperAdmin = role === 'super_admin';
  const isPengurus = role === 'admin' || isSuperAdmin; // admin & super_admin sama-sama "pengurus ke atas"

  useEffect(() => {
    async function fetchCounts() {
      try {
        const [housesSnap, transSnap] = await Promise.all([
          getDocs(collection(db, 'houses')),
          getDocs(collection(db, 'transactions')),
        ]);
        setFilledHouses(housesSnap.size);

        let ipl = 0;
        let kas = 0;
        transSnap.docs.forEach((d) => {
          const t = d.data();
          const delta = t.type === 'pemasukan' ? (t.amount || 0) : -(t.amount || 0);
          if (t.category === 'IPL') ipl += delta;
          if (t.category === 'Kas') kas += delta;
        });
        setSaldoIPL(ipl);
        setSaldoKas(kas);

        if (isPengurus) {
          const reqSnap = await getDocs(
            query(collection(db, 'house_requests'), where('status', '==', 'pending'))
          );
          setPendingCount(reqSnap.size);

          const accSnap = await getDocs(
            query(collection(db, 'users'), where('status', '==', 'pending'))
          );
          setPendingAccountCount(accSnap.size);
        }
      } catch (err) {
        console.error('Gagal mengambil data ringkasan:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCounts();
  }, []);

  function formatRupiah(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Welcome Banner */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">
            Selamat datang, {userData?.name || 'Warga'}!
          </h1>
          <p className="text-sm text-slate-600">
            Sistem informasi warga dan data rumah Valencia Residence AA6.
          </p>
          {role !== 'user' && (
            <span className="inline-block mt-2 text-xs font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full bg-slate-900 text-white">
              {isSuperAdmin ? 'Super Admin' : 'Pengurus'}
            </span>
          )}
        </div>

        {/* Statistik Ringkas — semua warga */}
        <div className={`grid grid-cols-2 gap-4 ${isPengurus ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
          <StatCard
            label="Rumah Terdata"
            value={loading ? '...' : `${filledHouses}/${TOTAL_HOUSES}`}
          />
          <StatCard
            label="Saldo Kas IPL"
            value={loading ? '...' : formatRupiah(saldoIPL)}
            to="/kas"
          />
          <StatCard
            label="Saldo Kas Lingkungan"
            value={loading ? '...' : formatRupiah(saldoKas)}
            to="/kas"
          />
          {isPengurus && (
            <StatCard label="Rumah Belum Terdata" value={loading ? '...' : TOTAL_HOUSES - filledHouses} />
          )}
        </div>

        {/* Menu Utama — semua warga */}
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Informasi Warga
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <MenuCard
              to="/database"
              title="Data Rumah & Warga"
              desc="Lihat direktori rumah dan penghuni, atau perbarui data rumah Anda."
              badge={loading ? '' : `${filledHouses}/${TOTAL_HOUSES} rumah`}
            />
            <MenuCard
              to="/kas"
              title="Informasi Iuran & Kas"
              desc="Saldo dan riwayat transaksi Iuran IPL serta Kas Lingkungan."
            />
            <MenuCard
              to="/info-penting"
              title="Informasi Penting"
              desc="Kontak satpam, PLN, PDAM, pemadam kebakaran, dan rumah sakit terdekat."
            />
          </div>
        </section>

        {/* Menu Pengurus (admin & super_admin) */}
        {isPengurus && (
          <section>
            <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide mb-3">
              Menu Pengurus
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <MenuCard
                to="/database"
                title="Kelola Data Rumah & Warga"
                desc="Tinjau, perbarui, atau lengkapi data seluruh rumah."
                badge={pendingCount > 0 ? `${pendingCount} menunggu konfirmasi` : undefined}
                tone="amber"
              />
              <MenuCard
                to="/verifikasi-akun"
                title="Verifikasi Akun Warga"
                desc="Setujui atau tolak pendaftaran akun warga baru."
                badge={pendingAccountCount > 0 ? `${pendingAccountCount} menunggu` : undefined}
                tone="amber"
              />

              {/* Menu khusus Super Admin saja */}
              {isSuperAdmin && (
                <>
                  <MenuCard
                    to="/kas?mode=kelola"
                    title="Kelola Kas / Iuran"
                    desc="Input pemasukan, pengeluaran, dan status pembayaran."
                    tone="amber"
                  />
                  <MenuCard
                    to="/info-penting?mode=kelola"
                    title="Kelola Informasi Penting"
                    desc="Perbarui daftar kontak darurat dan informasi lingkungan."
                    tone="amber"
                  />
                </>
              )}
            </div>
          </section>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs text-slate-400 tracking-wide">
            VALRES AA6 App v1 &copy; 2026 &mdash; Secure Residential Information System
          </p>
          <p className="text-[11px] text-slate-300 mt-1">
            Designed by <span className="font-medium text-slate-400">enha</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ label, value, hint, to }) {
  const content = (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm h-full">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block hover:shadow-md transition-shadow rounded-xl">
        {content}
      </Link>
    );
  }

  return content;
}

function MenuCard({ to, title, desc, badge, tone = 'teal' }) {
  const toneClasses =
    tone === 'amber'
      ? 'hover:border-amber-300 hover:shadow-amber-100'
      : 'hover:border-teal-300 hover:shadow-teal-100';

  return (
    <Link
      to={to}
      className={`block bg-white border border-slate-200 rounded-xl p-5 shadow-sm transition-all hover:shadow-md ${toneClasses}`}
    >
      <div className="flex items-start justify-between">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {badge && (
          <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full whitespace-nowrap ml-2">
            {badge}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{desc}</p>
    </Link>
  );
}