importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyD72t-U4ZQY1DVmsxj9O2Vu_XXXXKxwlKo",
  authDomain: "shangrila-online-booking-app.firebaseapp.com",
  projectId: "shangrila-online-booking-app",
  storageBucket: "shangrila-online-booking-app.firebasestorage.app",
  messagingSenderId: "696764910771",
  appId: "1:696764910771:web:04fb68544c4db32ff9b4c6",
  measurementId: "G-J2VVZ9S233"
});

const messaging = firebase.messaging();

// Background တွင် Noti ဝင်လာပါက ပြသပေးမည့် Logic
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || "The Shangri-La";
  const notificationOptions = {
    body: payload.notification?.body || "",
    icon: '/THE SHANGRI LA - LOGO.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
