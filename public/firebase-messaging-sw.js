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
  // data.url (if the sender included one) is where a tap should land —
  // stashed as the notification's own `data` so notificationclick below can
  // read it back. Overriding onBackgroundMessage takes over display duties
  // entirely, which also means FCM's automatic link-opening no longer
  // applies, hence handling the click ourselves.
  self.registration.showNotification(title, {
    body,
    icon: '/favicon.ico',
    data: { url: payload.data?.url || '/' },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) return client.focus();
      }
      // No matching tab already open — reuse any app window if we have one,
      // navigating it, rather than always spawning a new tab/window.
      if (windowClients.length > 0 && 'navigate' in windowClients[0]) {
        return windowClients[0].focus().then(() => windowClients[0].navigate(targetUrl));
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
