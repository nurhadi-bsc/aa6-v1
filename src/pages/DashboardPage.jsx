import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import Navbar from '../components/layout/Navbar';

export default function DashboardPage() {
  const { userData } = useAuth();
  const [houseCount, setHouseCount] = useState(0);
  const [wargaCount, setWargaCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const role = userData?.role || 'user';
  const isSuperAdmin = role === 'super_admin';
  const isPengurus = role === 'admin' || isSuperAdmin; // admin & super_admin sama-sama "pengurus ke atas"

  useEffect(() => {
    async function fetchCounts() {
      try {
        const [housesSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, 'houses')),
          getDocs(collection(db, 'users')),
        ]);
        setHouseCount(housesSnap.size);
        setWargaCount(usersSnap.size);
      } catch (err) {
        console.error('Gagal mengambil data ringkasan:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCounts();
  }, []);

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
            Sistem informasi warga & database rumah Valencia Residence AA6.
          </p>
          {role !== 'user' && (
            <span className="inline-block mt-2 text-xs font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full bg-slate-900 text-white">
              {isSuperAdmin ? 'Super Admin' : 'Pengurus / Admin'}
            </span>
          )}
        </div>

        {/* Statistik Ringkas — hanya Pengurus ke atas */}
        {isPengurus && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Rumah" value={loading ? '...' : houseCount} />
            <StatCard label="Total Warga" value={loading ? '...' : wargaCount} />
            <StatCard label="Saldo Kas" value="—" hint="Belum terhubung" />
            <StatCard label="Iuran Bulan Ini" value="—" hint="Belum terhubung" />
          </div>
        )}

        {/* Menu Utama — semua warga */}
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Informasi Warga
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MenuCard
              to="/database"
              title="Database Rumah"
              desc="Lihat data blok, nomor, dan status rumah."
              badge={loading ? '' : `${houseCount} rumah`}
            />
            <MenuCard
              to="/warga"
              title="Daftar Warga"
              desc="Nama dan nomor rumah warga terdaftar."
              badge={loading ? '' : `${wargaCount} warga`}
            />
            <MenuCard
              to="/kas"
              title="Info Iuran / Kas"
              desc="Saldo kas dan riwayat pemasukan-pengeluaran."
            />
            <MenuCard
              to="/info-penting"
              title="Informasi Penting"
              desc="Kontak satpam, PLN, PDAM, damkar, RS terdekat."
            />
          </div>
        </section>

        {/* Menu Pengurus (admin & super_admin) */}
        {isPengurus && (
          <section>
            <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide mb-3">
              Menu Pengurus
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MenuCard
                to="/warga?mode=kelola"
                title="Kelola Data Warga"
                desc="Edit, verifikasi, atau hapus data warga."
                tone="amber"
              />

              {/* Menu khusus Super Admin saja */}
              {isSuperAdmin && (
                <>
                  <MenuCard
                    to="/add-house"
                    title="Kelola Data Rumah"
                    desc="Tambah, edit, atau hapus data rumah."
                    tone="amber"
                  />
                  <MenuCard
                    to="/kas?mode=kelola"
                    title="Kelola Kas / Iuran"
                    desc="Input pemasukan, pengeluaran, dan status bayar."
                    tone="amber"
                  />
                  <MenuCard
                    to="/info-penting?mode=kelola"
                    title="Kelola Info Penting"
                    desc="Ubah daftar kontak darurat & informasi lingkungan."
                    tone="amber"
                  />
                </>
              )}
            </div>

            {isSuperAdmin && (
              <p className="text-xs text-slate-500 mt-3">
                Sebagai Super Admin, kamu juga dapat mengelola role pengguna lain melalui menu
                Kelola Data Warga.
              </p>
            )}
          </section>
        )}

      </main>
    </div>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
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