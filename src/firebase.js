import { initializeApp } from 'firebase/app';
import {
  getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// ─────────────────────────────────────────────────────────────
//  Replace these values with your Firebase project credentials.
//  In Netlify: set them as environment variables with the
//  REACT_APP_ prefix so they are embedded at build time.
// ─────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain:        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.REACT_APP_FIREBASE_APP_ID,
};

const app  = initializeApp(firebaseConfig);

// Keep a copy of the data on the device so entries can be made with no signal
// and are sent when the connection returns. Falls back to the plain online
// database where the browser does not allow local storage (private windows).
let database;
try {
  database = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch (e) {
  database = getFirestore(app);
}

export const db   = database;
export const auth = getAuth(app);
export default app;
