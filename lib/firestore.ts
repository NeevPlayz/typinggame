import {
  collection, addDoc, onSnapshot, query, orderBy, where,
  doc, updateDoc, getDoc, getDocs, setDoc, deleteDoc,
  serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export interface Message {
  id: string;
  text?: string;
  senderId: string;
  senderName: string;
  timestamp: Timestamp;
  status: "sent" | "delivered" | "seen";
  seenAt?: Timestamp;
  expireAt?: Timestamp;
  type?: "text";
}

export interface Room {
  code: string;
  player1: string;
  player2?: string;
  lastNotificationSent?: number;
  createdAt: Timestamp;
}

export interface Presence {
  online: boolean;
  lastSeen: Timestamp | null;
}

// Join or create room, return which player number you are
export async function joinRoom(
  code: string,
  playerId: string
): Promise<{ room: Room; playerNum: 1 | 2 } | null> {
  const roomRef = doc(db, "rooms", code);
  const snap = await getDoc(roomRef);

  if (!snap.exists()) {
    await setDoc(roomRef, {
      code, player1: playerId,
      createdAt: serverTimestamp(),
      lastNotificationSent: 0,
    });
    return { room: { code, player1: playerId } as Room, playerNum: 1 };
  }

  const data = snap.data() as Room;
  if (data.player1 === playerId) return { room: data, playerNum: 1 };
  if (!data.player2 || data.player2 === playerId) {
    if (!data.player2) await updateDoc(roomRef, { player2: playerId });
    return { room: data, playerNum: 2 };
  }
  return { room: data, playerNum: 2 };
}

// Listen to messages in real time
export function listenMessages(
  roomCode: string,
  callback: (msgs: Message[]) => void
) {
  const q = query(
    collection(db, "rooms", roomCode, "messages"),
    orderBy("timestamp", "asc")
  );
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message));
    callback(msgs);
  });
}

// Send text message — local timestamp to avoid UI delay
export async function sendMessage(
  roomCode: string,
  text: string,
  senderId: string,
  senderName: string
): Promise<void> {
  const now = Timestamp.fromMillis(Date.now());
  const expireAt = Timestamp.fromMillis(Date.now() + 4 * 60 * 60 * 1000);
  await addDoc(collection(db, "rooms", roomCode, "messages"), {
    text, senderId, senderName, type: "text",
    timestamp: now,
    status: "sent", expireAt,
  });
}

// Mark message as seen + set 1hr expiry from now
export async function markSeen(roomCode: string, messageId: string): Promise<void> {
  const expireAt = Timestamp.fromMillis(Date.now() + 60 * 60 * 1000);
  await updateDoc(doc(db, "rooms", roomCode, "messages", messageId), {
    status: "seen",
    seenAt: serverTimestamp(),
    expireAt,
  });
}

// Mark message as delivered (called when recipient opens chat)
export async function markDelivered(
  roomCode: string,
  messageId: string
): Promise<void> {
  await updateDoc(doc(db, "rooms", roomCode, "messages", messageId), {
    status: "delivered",
  });
}

// Delete all messages whose expireAt has passed
export async function cleanupExpired(roomCode: string): Promise<void> {
  const now = Timestamp.now();
  const q = query(
    collection(db, "rooms", roomCode, "messages"),
    where("expireAt", "<=", now)
  );
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
}

// Presence — mark yourself online/offline
export async function updatePresence(
  roomCode: string,
  playerId: string,
  online: boolean
): Promise<void> {
  await setDoc(doc(db, "rooms", roomCode, "presence", playerId), {
    online,
    lastSeen: serverTimestamp(),
  });
}

// Presence — listen to other player's status
export function listenPresence(
  roomCode: string,
  playerId: string,
  callback: (data: Presence) => void
) {
  return onSnapshot(doc(db, "rooms", roomCode, "presence", playerId), (snap) => {
    if (!snap.exists()) callback({ online: false, lastSeen: null });
    else callback(snap.data() as Presence);
  });
}

// Get other player's FCM token
export async function getOtherPlayerToken(
  roomCode: string,
  myPlayerId: string
): Promise<string | null> {
  const roomSnap = await getDoc(doc(db, "rooms", roomCode));
  if (!roomSnap.exists()) return null;
  const room = roomSnap.data() as Room;

  const otherId =
    room.player1 === myPlayerId ? room.player2 : room.player1;
  if (!otherId) return null;

  const tokenSnap = await getDoc(
    doc(db, "rooms", roomCode, "fcmTokens", otherId)
  );
  if (!tokenSnap.exists()) return null;
  return (tokenSnap.data() as { token: string }).token ?? null;
}

export async function updateLastNotification(roomCode: string): Promise<void> {
  await updateDoc(doc(db, "rooms", roomCode), {
    lastNotificationSent: Date.now(),
  });
}
