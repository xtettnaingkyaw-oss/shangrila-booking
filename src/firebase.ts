import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD72t-U4ZQY1DVmsxj9O2Vu_XXXXKxwlKo",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "shangrila-online-booking-app.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "shangrila-online-booking-app",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "shangrila-online-booking-app.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "696764910771",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:696764910771:web:04fb68544c4db32ff9b4c6"
};

// Initialize primary Firebase app first
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Dedicated secondary app instance so creating staff/admin accounts never overwrites the active Admin Auth session
const secondaryApp =
  getApps().find((a) => a.name === 'secondary') ||
  initializeApp(firebaseConfig, 'secondary');

// Firebase v10 standard offline cache with multi-tab support (replaces deprecated enableIndexedDbPersistence)
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch {
  firestoreInstance = getFirestore(app);
}

export const db = firestoreInstance;
export const auth = getAuth(app);
export const secondaryAuth = getAuth(secondaryApp);
export const storage = getStorage(app);

// Initialize Firebase Cloud Messaging only if browser supports it
export let messaging: any = null;

if (typeof window !== 'undefined') {
  isSupported()
    .then((supported) => {
      if (supported) {
        messaging = getMessaging(app);
      }
    })
    .catch((err) => {
      console.warn('FCM messaging not supported in this browser:', err);
    });
}

export const requestNotificationPermission = async () => {
  try {
    if (!('Notification' in window) || !messaging) return null;

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: 'BNYy7H0Fu754PLYQJmo_3Zx9qEmn44r_7xX4zosbpDIDIFe6rI1lgrayPntQfA9PhKEZy7NaWgIUvIFKTS3J54U'
      });
      return token;
    }
  } catch (error) {
    console.warn('Notification token warning:', error);
  }
  return null;
};
