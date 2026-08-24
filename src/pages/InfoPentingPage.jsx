import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import Navbar from '../components/layout/Navbar';

const DOC_REF_PATH = ['settings', 'important_info'];

const SUGGESTED_CATEGORIES = [
  'Keamanan / Satpam',
  'PLN (Listrik)',
  'PDAM (Air)',
  'Pemadam Kebakaran',
  'Rumah Sakit Terdekat',
  'Ambulans',
  'Pengurus Lingkungan',
];

const emptyContactForm = { label: '', phone: '', note: '' };

export default function InfoPentingPage() {
  const { userData } = useAuth();
  const [searchParams] = useSearchParams();
  const role = userData?.role || 'user';
  const isSuperAdmin = role === 'super_admin';
  const kelolaMode = isSuperAdmin && searchParams.get('mode') === 'kelola';

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newContact, setNewContact] = useState(emptyContactForm);

  const [editingIndex, setEditingIndex] = useState(null);
  const [editForm, setEditForm] = useState(emptyContactForm);

  useEffect(() => {
    fetchContacts();
  }, []);

  async function fetchContacts() {
    setLoading(true);
    try {
      const ref = doc(db, ...DOC_REF_PATH);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setContacts(snap.data().contacts || []);
      } else {
        setContacts([]);
      }
    } catch (err) {
      console.error('Gagal mengambil data informasi penting:', err);
    } finally {
      setLoading(false);
    }
  }

  async function persistContacts(updatedList) {
    setSaving(true);
    try {
      const ref = doc(db, ...DOC_REF_PATH);
      await setDoc(ref, {
        contacts: updatedList,
        updatedAt: new Date().toISOString(),
        updatedBy: userData?.name || 'Tidak diketahui',
      });
      setContacts(updatedList);
    } catch (err) {
      console.error('Gagal menyimpan informasi penting:', err);
      alert('Gagal menyimpan perubahan. Silakan coba kembali.');
    } finally {
      setSaving(false);
    }
  }

  function handleAddContact() {
    if (!newContact.label.trim() || !newContact.phone.trim()) {
      alert('Nama kontak dan nomor telepon wajib diisi.');
      return;
    }
    const updated = [...contacts, { ...newContact, label: newContact.label.trim(), phone: newContact.phone.trim(), note: newContact.note.trim() }];
    persistContacts(updated);
    setNewContact(emptyContactForm);
    setShowAddForm(false);
  }

  function startEdit(index) {
    setEditingIndex(index);
    setEditForm(contacts[index]);
  }

  function saveEdit(index) {
    if (!editForm.label.trim() || !editForm.phone.trim()) {
      alert('Nama kontak dan nomor telepon wajib diisi.');
      return;
    }
    const updated = [...contacts];
    updated[index] = { ...editForm, label: editForm.label.trim(), phone: editForm.phone.trim(), note: editForm.note.trim() };
    persistContacts(updated);
    setEditingIndex(null);
  }

  function handleDelete(index) {
    const confirmed = window.confirm(`Hapus kontak "${contacts[index].label}"?`);
    if (!confirmed) return;
    const updated = contacts.filter((_, i) => i !== index);
    persistContacts(updated);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Informasi Penting</h1>
            <p className="text-sm text-slate-600 mt-1">
              Daftar kontak darurat dan layanan penting Valencia Residence AA6.
            </p>
          </div>

          {isSuperAdmin && (
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="text-xs font-medium bg-teal-800 hover:bg-teal-900 text-white px-4 py-2 rounded-lg transition-colors self-start"
            >
              {showAddForm ? 'Batal' : '+ Tambah Kontak'}
            </button>
          )}
        </div>

        {kelolaMode && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-2.5 rounded-lg">
            Kamu masuk melalui mode kelola. Klik "Edit" pada tiap kontak untuk mengubah, atau tambahkan kontak baru.
          </div>
        )}

        {/* Form Tambah Kontak */}
        {isSuperAdmin && showAddForm && (
          <div className="bg-white border border-teal-200 rounded-xl p-5 shadow-sm space-y-3">
            <p className="text-xs font-semibold text-teal-800 uppercase tracking-wide">Kontak Baru</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Kontak / Layanan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  list="suggested-categories"
                  value={newContact.label}
                  onChange={(e) => setNewContact((f) => ({ ...f, label: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-800"
                  placeholder="Contoh: Keamanan / Satpam"
                />
                <datalist id="suggested-categories">
                  {SUGGESTED_CATEGORIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nomor Telepon <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newContact.phone}
                  onChange={(e) => setNewContact((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-800"
                  placeholder="+62812xxxxxxxx"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Catatan (opsional)</label>
              <input
                type="text"
                value={newContact.note}
                onChange={(e) => setNewContact((f) => ({ ...f, note: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-800"
                placeholder="Contoh: Aktif 24 jam"
              />
            </div>
            <button
              onClick={handleAddContact}
              disabled={saving}
              className="text-xs font-medium bg-teal-800 hover:bg-teal-900 text-white px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan Kontak'}
            </button>
          </div>
        )}

        {/* Daftar Kontak */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <p className="px-6 py-10 text-sm text-slate-400 text-center">Memuat data...</p>
          ) : contacts.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm text-slate-400">Belum ada informasi penting yang tercatat.</p>
              {isSuperAdmin && (
                <p className="text-xs text-slate-400 mt-1">Klik "+ Tambah Kontak" untuk mulai menambahkan.</p>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {contacts.map((c, index) => (
                <li key={index} className="px-4 sm:px-6 py-4">
                  {editingIndex === index ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={editForm.label}
                          onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                          className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                          placeholder="Nama kontak"
                        />
                        <input
                          type="text"
                          value={editForm.phone}
                          onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                          className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                          placeholder="Nomor telepon"
                        />
                      </div>
                      <input
                        type="text"
                        value={editForm.note}
                        onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                        placeholder="Catatan (opsional)"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(index)}
                          disabled={saving}
                          className="text-xs font-medium bg-teal-800 hover:bg-teal-900 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                        >
                          {saving ? '...' : 'Simpan'}
                        </button>
                        <button
                          onClick={() => setEditingIndex(null)}
                          className="text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                          📞
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{c.label}</p>
                          <p className="text-sm text-teal-800 font-medium">{c.phone}</p>
                          {c.note && <p className="text-xs text-slate-400 mt-0.5">{c.note}</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <a
                          href={`tel:${c.phone.replace(/\s+/g, '')}`}
                          className="text-xs font-medium bg-teal-800 hover:bg-teal-900 text-white px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Hubungi
                        </a>
                        {isSuperAdmin && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => startEdit(index)}
                              className="text-[11px] font-medium text-teal-800 hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(index)}
                              className="text-[11px] font-medium text-red-600 hover:underline"
                            >
                              Hapus
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

      </main>
    </div>
  );
}