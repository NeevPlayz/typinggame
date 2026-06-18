import { getMessaging, getToken } from "firebase/messaging";
import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export async function registerPushToken(roomCode: string, playerId: string): Promise<void> {
  try {
    if (!("Notification" in window)) return;
    if (!VAPID_KEY) return;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    // Register service worker
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
    // Notification setup failed silently — app still works
  }
}
