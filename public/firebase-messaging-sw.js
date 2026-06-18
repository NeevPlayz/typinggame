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
  "🚂 The train is catching up — jump back in the race!",
  "⚡ A new move dropped. Don't fall behind!",
  "🔥 The track is heating up. Sprint!",
  "🏃 Someone just made their move. Stay ahead!",
  "💨 The race continues... your turn!",
  "🎮 New action on the track. Check it out!",
  "🌀 Something big just happened in the game!",
  "⚠️ Danger ahead — get back in the race!",
];

messaging.onBackgroundMessage((payload) => {
  const body = payload.data?.body ||
    CREATIVE_BODIES[Math.floor(Math.random() * CREATIVE_BODIES.length)];
  self.registration.showNotification("TypeBattle 🎮", {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'typebattle-msg',
    renotify: true,
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
