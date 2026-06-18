import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const ONE_HOUR = 60 * 60 * 1000;

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

export async function POST(req: NextRequest) {
  try {
    const { roomCode, senderId } = await req.json();
    if (!roomCode) return NextResponse.json({ ok: false }, { status: 400 });

    const app = getAdminApp();
    const db = getFirestore(app);

    // Rate limit: 1 notification per hour per room
    const roomRef = db.collection("rooms").doc(roomCode);
    const roomSnap = await roomRef.get();
    if (!roomSnap.exists) return NextResponse.json({ ok: false, reason: "no room" });

    const roomData = roomSnap.data()!;
    const lastSent: number = roomData.lastNotificationSent || 0;

    if (Date.now() - lastSent < ONE_HOUR) {
      return NextResponse.json({ ok: true, skipped: true, reason: "rate limited" });
    }

    // Fixed player IDs — derive other player directly
    const otherId = senderId === "ragini" ? "neev" : senderId === "neev" ? "ragini" : null;
    if (!otherId) return NextResponse.json({ ok: true, skipped: true, reason: "no other player" });

    const tokenSnap = await db
      .collection("rooms")
      .doc(roomCode)
      .collection("fcmTokens")
      .doc(otherId)
      .get();

    if (!tokenSnap.exists) {
      // Still update timestamp so we don't spam attempts
      await roomRef.update({ lastNotificationSent: Date.now() });
      return NextResponse.json({ ok: true, skipped: true, reason: "no token" });
    }

    const fcmToken = (tokenSnap.data() as { token: string }).token;
    const body = CREATIVE_BODIES[Math.floor(Math.random() * CREATIVE_BODIES.length)];

    await getMessaging(app).send({
      token: fcmToken,
      notification: {
        title: "TypeBattle 🎮",
        body,
      },
      data: { body, roomCode },
      webpush: {
        notification: {
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: "typebattle-msg",
          renotify: true,
        },
        fcmOptions: { link: "/settings" },
      },
    });

    await roomRef.update({ lastNotificationSent: Date.now() });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Notify error:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
