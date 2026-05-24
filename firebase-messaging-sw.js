// ============================================================
// firebase-messaging-sw.js – Firebase Cloud Messaging Service Worker
// ============================================================

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSy...", 
  authDomain: "todom-4e20d.firebaseapp.com",
  projectId: "todom-4e20d",
  storageBucket: "todom-4e20d.appspot.com",
  messagingSenderId: "966053138399",
  appId: "1:966053138399:web:99c9fb7d98b21066fe7e6a"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title || 'Nový úkol ToDoM';
  const notificationOptions = {
    body: payload.notification.body || 'Máte nový nebo upravený urgentní úkol.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
