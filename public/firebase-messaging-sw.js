// Firebase Messaging Service Worker — handles background push notifications
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAo635pLShsyf0VbS0ApvfTeLnh6yQnao0",
  authDomain: "hardyhub-7b30d.firebaseapp.com",
  projectId: "hardyhub-7b30d",
  storageBucket: "hardyhub-7b30d.firebasestorage.app",
  messagingSenderId: "1091933059563",
  appId: "1:1091933059563:web:88a262227dcaa9247dc1ae",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'Household Reminder';
  const body  = payload.notification?.body  ?? '';
  self.registration.showNotification(title, { body, icon: '/favicon.ico' });
});
