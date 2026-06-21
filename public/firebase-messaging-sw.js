importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyB9pmumLDbHzVN586jv7iwspSkz6Ngh670",
  authDomain: "type-battle-game.firebaseapp.com",
  projectId: "type-battle-game",
  storageBucket: "type-battle-game.firebasestorage.app",
  messagingSenderId: "917333974088",
  appId: "1:917333974088:web:d23b352a3bc76f2555cc7d",
});

const messaging = firebase.messaging();

const CREATIVE_BODIES = [
  "⌨️ It's time to increase your typing speed!",
  "🚂 The train is catching up — get back in the race!",
  "⚡ It's time to increase your typing speed!",
  "🔥 New move on the track. Sprint back!",
  "💨 It's time to increase your typing speed!",
  "🎮 The race continues... your turn!",
  "⚠️ It's time to increase your typing speed!",
  "🌀 Don't fall behind — jump back in!",
];

messaging.onBackgroundMessage((payload) => {
  const body = payload.data?.body ||
    CREATIVE_BODIES[Math.floor(Math.random() * CREATIVE_BODIES.length)];
  self.registration.showNotification("TypeBattle 🎮", {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'typebattle-' + Date.now(),
    silent: false,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/chat') && 'focus' in client) return client.focus();
      }
      return clients.openWindow('/settings');
    })
  );
});
