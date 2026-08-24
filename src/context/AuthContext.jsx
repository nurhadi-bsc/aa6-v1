import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fungsi Register User Baru
  const register = async (email, password, name, phone) => {
    const res = await createUserWithEmailAndPassword(auth, email, password);
    const user = res.user;

    // Simpan data tambahan ke Firestore koleksi 'users'
    const userDocRef = doc(db, 'users', user.uid);
    const initialData = {
      uid: user.uid,
      name: name,
      email: email,
      phone: phone || '',
      role: 'user', // Default role V1
      status: 'pending', // Menunggu persetujuan Pengurus/Super Admin sebelum bisa akses aplikasi
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    await setDoc(userDocRef, initialData);
    return user;
  };

  // Fungsi Login
  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  // Fungsi Logout
  const logout = () => {
    return signOut(auth);
  };

  // Monitor perubahan status autentikasi Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Ambil data profile dari Firestore
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        } else {
          setUserData(null);
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userData,
    register,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};