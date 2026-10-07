import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage'; // 👈 အသစ်ထည့်ထားသည်

const firebaseConfig = {
  apiKey: "AIzaSyD72t-U4ZQY1DVmsxj9O2Vu_XXXXKxwlKo",
  authDomain: "shangrila-online-booking-app.firebaseapp.com",
  projectId: "shangrila-online-booking-app",
  storageBucket: "shangrila-online-booking-app.firebasestorage.app",
  messagingSenderId: "696764910771",
  appId: "1:696764910771:web:04fb68544c4db32ff9b4c6"
};

import { getMessaging, getToken, isSupported } from 'firebase/messaging';

// 🌟 FIX: Browser က Support လုပ်မှသာ Initialize လုပ်ပါမည် (App White Screen မဖြစ်စေရန်) 🌟
export let messaging: any = null;

if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      messaging = getMessaging(app);
    }
  }).catch(console.error);
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
    console.error('Error getting notification token:', error);
  }
  return null;
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const secondaryAuth = getAuth(app); // သင့် မူလ Code အရ ပါဝင်သည်ဟု ယူဆပါသည်
export const storage = getStorage(app); // 👈 အသစ်ထည့်ထားသည်
