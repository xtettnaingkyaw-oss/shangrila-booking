import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  disableNetwork,
  enableNetwork,
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

// Firebase v10 standard offline cache with multi-tab support + auto-detect long polling
// (prevents 10s+ WebChannel stalls on iOS Safari Standalone PWAs & Myanmar mobile networks without VPN)
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    }),
    experimentalAutoDetectLongPolling: true
  });
} catch {
  firestoreInstance = getFirestore(app);
}

export const db = firestoreInstance;
export const auth = getAuth(app);
export const secondaryAuth = getAuth(secondaryApp);
export const storage = getStorage(app);

// 🌟 iOS Safari / PWA Resume Recovery: drops half-open/zombied WebChannel streams after app-switching (e.g. Telegram <-> Safari) 🌟
let reconnectInFlight: Promise<void> | null = null;
let lastReconnectAt = 0;

export const reconnectFirestoreNetwork = async (force: boolean = false): Promise<void> => {
  const now = Date.now();
  if (!force && now - lastReconnectAt < 2500) return;
  if (reconnectInFlight) return reconnectInFlight;

  lastReconnectAt = now;
  reconnectInFlight = (async () => {
    try {
      await Promise.race([
        disableNetwork(db),
        new Promise<void>((r) => setTimeout(r, 1200))
      ]);
      await Promise.race([
        enableNetwork(db),
        new Promise<void>((r) => setTimeout(r, 1500))
      ]);
    } catch {
      try {
        await enableNetwork(db);
      } catch {}
    } finally {
      reconnectInFlight = null;
    }
  })();

  return reconnectInFlight;
};

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
    } else if (document.visibilityState === 'visible') {
      const awayMs = hiddenAt ? Date.now() - hiddenAt : 0;
      hiddenAt = 0;
      if (awayMs >= 1500) {
        reconnectFirestoreNetwork().catch(() => {});
      }
    }
  });
  window.addEventListener('pageshow', (evt: PageTransitionEvent) => {
    if (evt.persisted) {
      reconnectFirestoreNetwork(true).catch(() => {});
    }
  });
  window.addEventListener('online', () => {
    reconnectFirestoreNetwork(true).catch(() => {});
  });
}

// 🌟 Stateless HTTPS Firestore REST PATCH Fallback (100% immune to iOS WebKit suspended WebChannel sockets) 🌟
const toFirestoreRestValue = (val: unknown): Record<string, unknown> => {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  return { stringValue: String(val) };
};

export const patchFirestoreDocumentFast = async (
  collectionPath: string,
  docId: string,
  data: Record<string, string | number | boolean | null>,
  timeoutMs: number = 6000
): Promise<boolean> => {
  const keys = Object.keys(data);
  if (!docId || keys.length === 0) return false;

  const projectId = firebaseConfig.projectId;
  const apiKey = firebaseConfig.apiKey;
  const maskQuery = keys
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join('&');
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/(default)/documents/${collectionPath}/${encodeURIComponent(
    docId
  )}?${maskQuery}&key=${encodeURIComponent(apiKey)}`;

  const fields: Record<string, unknown> = {};
  for (const k of keys) {
    fields[k] = toFirestoreRestValue(data[k]);
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const idToken = await auth.currentUser?.getIdToken?.();
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  } catch {}

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ fields }),
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

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
