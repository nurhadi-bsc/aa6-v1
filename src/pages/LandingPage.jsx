import React from 'react';
import { Link } from 'react-router-dom';
import logoWhite from '../assets/logo-white.png';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between relative overflow-hidden">
      
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1920&q=80" 
          alt="Modern House Background" 
          className="w-full h-full object-cover opacity-25 scale-105 animate-pulse duration-1000"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-900/90 to-slate-900"></div>
      </div>

      {/* Top Navbar Header */}
      <header className="relative z-10 max-w-7xl w-full mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img src={logoWhite} alt="Logo Valencia AA6" className="w-9 h-9 object-contain" />
          <span className="font-bold text-lg tracking-wide text-white">
            Warga <span className="text-teal-400 font-normal">Valres AA6</span>
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <Link
            to="/login"
            className="text-sm font-medium text-slate-300 hover:text-white px-4 py-2 transition-colors"
          >
            Masuk
          </Link>
          <Link
            to="/register"
            className="text-sm font-medium bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg shadow-md shadow-teal-600/30 transition-all"
          >
            Daftar Warga
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 max-w-4xl w-full mx-auto px-6 py-16 text-center space-y-8 my-auto">
        
        {/* Badge */}
        <div className="inline-flex items-center space-x-2 bg-teal-950/80 border border-teal-800/60 text-teal-300 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase shadow-inner">
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping"></span>
          <span>Sistem Informasi Lingkungan AA6 v1.0</span>
        </div>

        {/* Main Heading */}
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          SIWARA <br />
          <span className="bg-gradient-to-r from-teal-400 to-emerald-300 bg-clip-text text-transparent">
            Sistem Informasi Warga AA6 Valencia Residence
          </span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 tracking-wide">
          Sidoarjo, Jawa Timur
        </p>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Pusat database informasi hunian warga lingkungan Valencia Residence AA6.
        </p>
        <p className="text-sm sm:text-base font-semibold text-teal-400 tracking-wide">
          Bersama Kita Bisa
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            to="/login"
            className="w-full sm:w-auto bg-teal-600 hover:bg-teal-500 text-white font-semibold px-8 py-3.5 rounded-xl shadow-lg shadow-teal-600/30 transition-all text-center text-sm"
          >
            Masuk ke Akun Anda &rarr;
          </Link>
          <Link
            to="/register"
            className="w-full sm:w-auto bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold px-8 py-3.5 rounded-xl transition-all text-center text-sm"
          >
            Registrasi Warga Baru
          </Link>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12 border-t border-slate-800/80 text-left">
          <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl backdrop-blur-sm space-y-1">
            <div className="text-teal-400 font-bold text-sm">🏡 Data Rumah</div>
            <p className="text-xs text-slate-400">Informasi lengkap blok, nomor rumah, dan status kepemilikan.</p>
          </div>
          <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl backdrop-blur-sm space-y-1">
            <div className="text-teal-400 font-bold text-sm">👥 Data Penghuni</div>
            <p className="text-xs text-slate-400">Direktori kontak warga yang terverifikasi dan aman.</p>
          </div>
          <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl backdrop-blur-sm space-y-1">
            <div className="text-teal-400 font-bold text-sm">🔒 Akses Kontrol</div>
            <p className="text-xs text-slate-400">Keamanan berlapis dengan otentikasi akun warga resmi.</p>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-7xl w-full mx-auto px-6 py-6 text-center text-xs text-slate-500 border-t border-slate-800/60">
        VALRES AA6 App v1 &copy; 2026 — Secure Residential Information System.
      </footer>

    </div>
  );
}