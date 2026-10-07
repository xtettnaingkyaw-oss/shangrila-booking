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

import { getMessaging, getToken, onMessage } from 'firebase/messaging';
// (အပေါ်မှာ အစ်ကို့ရဲ့ ရှိပြီးသား Firebase Config နဲ့ app တွေ ရှိရပါမည်)

// Messaging Service အား Initialize လုပ်ခြင်း
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

// User ထံမှ Notification ခွင့်ပြုချက်တောင်းပြီး FCM Token ယူမည့် Function
export const requestNotificationPermission = async () => {
  try {
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notification');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted' && messaging) {
      const token = await getToken(messaging, {
        // 🌟 အစ်ကိုပေးထားသော VAPID Key ကို ဤနေရာတွင် ထည့်သွင်းထားပါသည် 🌟
        vapidKey: 'BNYy7H0Fu754PLYQJmo_3Zx9qEmn44r_7xX4zosbpDIDIFe6rI1lgrayPntQfA9PhKEZy7NaWgIUvIFKTS3J54U' 
      });
      console.log('FCM Token Generated:', token);
      return token;
    } else {
      console.log('Notification permission denied by user.');
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
