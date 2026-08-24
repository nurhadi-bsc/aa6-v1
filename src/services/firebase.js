import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Konfigurasi Firebase langsung dimasukkan di sini
const firebaseConfig = {
  apiKey: "AIzaSyBruKL_3zecF1v_vhL1LVbKw44zk8gJl-s",
  authDomain: "valres-aa6.firebaseapp.com",
  projectId: "valres-aa6",
  storageBucket: "valres-aa6.firebasestorage.app",
  messagingSenderId: "636562695269",
  appId: "1:636562695269:web:6df53236c344212d72528c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);