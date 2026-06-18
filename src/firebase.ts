import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD72t-U4ZQY1DVmsxj9O2Vu_XXXXXxw1Ko",
  authDomain: "shangrila-online-booking-app.firebaseapp.com",
  projectId: "shangrila-online-booking-app",
  storageBucket: "shangrila-online-booking-app.firebasestorage.app",
  messagingSenderId: "696764910771",
  appId: "1:696764910771:web:04fb68544c4db32ff9b4c6"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
