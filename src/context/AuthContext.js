import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext();
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export function AuthProvider({ children }) {
  const [user, setUser]                 = useState(null);
  const [role, setRole]                 = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));

          if (!snap.exists()) {
            // Not on allowlist — record attempt then sign out
            try {
              await setDoc(doc(db, 'pending_logins', firebaseUser.uid), {
                email:       firebaseUser.email       || '',
                displayName: firebaseUser.displayName || '',
                photoURL:    firebaseUser.photoURL    || '',
                attemptedAt: new Date().toISOString(),
              });
            } catch (_) { /* ignore if rules not yet deployed */ }

            await signOut(auth);
            setUser(null);
            setRole(null);
            setAccessDenied(true);
            setLoading(false);
            return;
          }

          const data = snap.data();
          setRole(data.role || 'viewer');
          setUser({
            uid:         firebaseUser.uid,
            email:       firebaseUser.email,
            displayName: data.displayName || firebaseUser.displayName || firebaseUser.email,
            photoURL:    firebaseUser.photoURL || data.photoURL || '',
          });
          setAccessDenied(false);

        } catch (err) {
          console.error('Profile load error:', err.message);
          // If Firestore is unreachable, don't sign the user out —
          // just show the login page and let them try again.
          setUser(null);
          setRole(null);
          setAccessDenied(false);
        }
      } else {
        setUser(null);
        setRole(null);
        setAccessDenied(false);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const loginWithGoogle = async () => {
    setAccessDenied(false);
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged above handles everything after this
    } catch (err) {
      // Re-throw so LoginPage can show user-friendly messages
      throw err;
    }
  };

  const logout = () => {
    setAccessDenied(false);
    return signOut(auth);
  };

  const setUserProfile = async (uid, { email, displayName, role: userRole }) => {
    await setDoc(doc(db, 'users', uid), {
      email,
      displayName: displayName || email,
      role:        userRole || 'viewer',
      createdAt:   new Date().toISOString(),
      addedBy:     user?.email || 'admin',
    });
  };

  const updateUserProfile = async (uid, updates) => {
    const { updateDoc } = await import('firebase/firestore');
    await updateDoc(doc(db, 'users', uid), updates);
  };

  const isAdmin = role === 'admin';

  return (
    <AuthContext.Provider value={{
      user, role, isAdmin, loading, accessDenied,
      loginWithGoogle, logout,
      setUserProfile, updateUserProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
