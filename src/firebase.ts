import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// (နောက်ပိုင်းမှ မိမိရဲ့ Firebase အချက်အလက်အမှန်တွေ ပြန်ပြောင်းထည့်ပါ)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);