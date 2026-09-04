import { collection, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const APP_URL = 'https://aa6-v1.vercel.app';

/**
 * Mengirim email via Firebase Extension "Trigger Email" (firestore-send-email).
 * Cukup menulis dokumen ke koleksi 'mail' — extension yang otomatis memproses &
 * mengirimkannya lewat SMTP yang sudah dikonfigurasi di Firebase Console.
 *
 * PENTING: Fungsi ini sengaja tidak melempar error ke pemanggil (fail-safe).
 * Kegagalan mengirim/mengantre email TIDAK BOLEH menggagalkan aksi utama
 * (approve/reject) — email cuma notifikasi tambahan, bukan syarat aksi.
 */
export async function sendMail(to, { subject, html }) {
  if (!to) {
    console.warn('sendMail: alamat email tujuan kosong, email tidak dikirim.');
    return;
  }
  try {
    await addDoc(collection(db, 'mail'), {
      to: [to],
      message: { subject, html },
    });
  } catch (err) {
    console.error('Gagal mengantre email notifikasi:', err);
  }
}

function emailWrapper(title, titleColor, bodyHtml) {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
      <h2 style="color: ${titleColor}; margin-bottom: 4px;">${title}</h2>
      ${bodyHtml}
      <p style="font-size:12px;color:#94a3b8;margin-top:32px;border-top:1px solid #e2e8f0;padding-top:16px;">
        Email ini dikirim otomatis oleh sistem SIWARA (Sistem Informasi Warga AA6 Valencia Residence).
        Mohon tidak membalas email ini.
      </p>
    </div>
  `;
}

function buttonHtml(href, label) {
  return `
    <p style="margin: 24px 0;">
      <a href="${href}" style="background:#0f766e;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;">${label}</a>
    </p>
  `;
}

export function accountApprovedEmail(name) {
  return {
    subject: 'Akun SIWARA Anda Telah Disetujui',
    html: emailWrapper(
      'Akun Anda Telah Disetujui',
      '#0f766e',
      `
        <p>Halo <strong>${name}</strong>,</p>
        <p>Kabar baik! Akun Anda di <strong>SIWARA (Sistem Informasi Warga AA6 Valencia Residence)</strong> telah disetujui oleh pengurus.</p>
        <p>Anda sekarang dapat masuk dan mengakses seluruh fitur aplikasi.</p>
        ${buttonHtml(`${APP_URL}/login`, 'Masuk ke SIWARA')}
      `
    ),
  };
}

export function accountRejectedEmail(name) {
  return {
    subject: 'Informasi Pendaftaran Akun SIWARA',
    html: emailWrapper(
      'Pendaftaran Belum Dapat Disetujui',
      '#b91c1c',
      `
        <p>Halo <strong>${name}</strong>,</p>
        <p>Mohon maaf, pendaftaran akun Anda di SIWARA belum dapat disetujui oleh pengurus.</p>
        <p>Jika Anda merasa ini keliru, silakan hubungi pengurus lingkungan Valencia Residence AA6 secara langsung.</p>
      `
    ),
  };
}

export function houseRequestApprovedEmail(name, houseNumber) {
  return {
    subject: `Pengajuan Data Rumah No. ${houseNumber} Disetujui`,
    html: emailWrapper(
      'Pengajuan Anda Disetujui',
      '#0f766e',
      `
        <p>Halo <strong>${name}</strong>,</p>
        <p>Pengajuan perubahan data untuk <strong>Rumah No. ${houseNumber}</strong> telah disetujui oleh pengurus dan sudah berlaku secara resmi.</p>
        ${buttonHtml(`${APP_URL}/database`, 'Lihat Data Rumah')}
      `
    ),
  };
}

export function houseRequestRejectedEmail(name, houseNumber) {
  return {
    subject: `Pengajuan Data Rumah No. ${houseNumber} Tidak Disetujui`,
    html: emailWrapper(
      'Pengajuan Belum Dapat Disetujui',
      '#b91c1c',
      `
        <p>Halo <strong>${name}</strong>,</p>
        <p>Mohon maaf, pengajuan perubahan data untuk <strong>Rumah No. ${houseNumber}</strong> belum dapat disetujui oleh pengurus.</p>
        <p>Silakan hubungi pengurus lingkungan untuk informasi lebih lanjut, atau ajukan kembali dengan data yang sesuai.</p>
      `
    ),
  };
}
