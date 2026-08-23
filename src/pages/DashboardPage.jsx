import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import Navbar from '../components/layout/Navbar';

export default function DashboardPage() {
  const { userData } = useAuth();
  const [houseCount, setHouseCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHouseCount() {
      try {
        const querySnapshot = await getDocs(collection(db, 'houses'));
        setHouseCount(querySnapshot.size);
      } catch (err) {
        console.error('Gagal mengambil data rumah:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchHouseCount();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Welcome Banner */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">
            Selamat datang, {userData?.name || 'Warga'}!
          </h1>
          <p className="text-sm text-slate-600">
            Sistem database informasi rumah dan penghuni lingkungan AA6.
          </p>
        </div>

        {/* Summary Card & Action */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div>
              <span className="text-xs font-semibold tracking-wider text-teal-800 uppercase bg-teal-50 px-2.5 py-1 rounded-full">
                Database Rumah AA6
              </span>
              <h2 className="text-3xl font-bold text-slate-900 mt-3">
                {loading ? '...' : `${houseCount} Rumah`}
              </h2>
              <p className="text-xs text-slate-500 mt-1">Total rumah terdaftar di dalam sistem.</p>
            </div>

            <Link
              to="/database"
              className="inline-block bg-teal-800 hover:bg-teal-900 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
            >
              Lihat Database &rarr;
            </Link>
          </div>

          {/* Admin Quick Action Card (Jika Admin) */}
          {userData?.role === 'admin' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 shadow-sm space-y-4">
              <div>
                <span className="text-xs font-semibold tracking-wider text-amber-900 uppercase bg-amber-100 px-2.5 py-1 rounded-full">
                  Admin Control
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-3">
                  Kelola Data Rumah
                </h2>
                <p className="text-xs text-slate-600 mt-1">Tambah, edit, atau perbarui data rumah warga.</p>
              </div>

              <Link
                to="/add-house"
                className="inline-block bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium py-2 px-4 rounded-lg text-sm transition-colors"
              >
                + Tambah Data Rumah
              </Link>
            </div>
          )}

        </div>

      </main>
    </div>
  );
}