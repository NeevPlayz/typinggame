import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export async function registerPushToken(roomCode: string, playerId: string): Promise<void> {
  try {
    if (!("Notification" in window)) return;
    if (!VAPID_KEY) return;
    if (Notification.permission === "denied") return;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    await navigator.serviceWorker.ready;

    const messaging = getMessaging();
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: reg,
    });

    if (token) {
      await setDoc(doc(db, "rooms", roomCode, "fcmTokens", playerId), {
        token,
        updatedAt: Date.now(),
      });
    }
  } catch {
    // silent fail
  }
}

// Call once on app load — shows notifications even when app is in foreground
export function setupForegroundNotifications() {
  if (typeof window === "undefined") return;
  try {
    const messaging = getMessaging();
    onMessage(messaging, async (payload) => {
      const body =
        payload.data?.body ||
        payload.notification?.body ||
        "New message";
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification("TypeBattle 🎮", {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: `typebattle-${Date.now()}`,
        silent: false,
      } as NotificationOptions);
    });
  } catch {
    // silent fail
  }
}
