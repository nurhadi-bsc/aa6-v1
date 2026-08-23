import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Konfigurasi Firebase langsung dimasukkan di sini
const firebaseConfig = {
  apiKey: "MASUKKAN_API_KEY_ANDA_DI_SINI",
  authDomain: "MASUKKAN_AUTH_DOMAIN_ANDA_DI_SINI",
  projectId: "MASUKKAN_PROJECT_ID_ANDA_DI_SINI",
  storageBucket: "MASUKKAN_STORAGE_BUCKET_ANDA_DI_SINI",
  messagingSenderId: "MASUKKAN_MESSAGING_SENDER_ID_ANDA_DI_SINI",
  appId: "MASUKKAN_APP_ID_ANDA_DI_SINI"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);