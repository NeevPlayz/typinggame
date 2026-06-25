import {
  collection, addDoc, onSnapshot, query, orderBy, where,
  doc, updateDoc, getDoc, getDocs, setDoc, deleteDoc,
  serverTimestamp, Timestamp, deleteField,
} from "firebase/firestore";
import { db } from "./firebase";

export interface ReplyTo {
  id: string;
  text: string;
  senderName: string;
}

export interface Message {
  id: string;
  text?: string;
  senderId: string;
  senderName: string;
  timestamp: Timestamp;
  status: "sent" | "delivered" | "seen";
  seenAt?: Timestamp;
  expireAt?: Timestamp;
  type?: "text" | "image" | "audio";
  deleted?: boolean;
  reactions?: Record<string, string>;
  replyTo?: ReplyTo;
  mediaUrl?: string;
  cloudinaryId?: string;
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
  typing?: boolean;
  panic?: boolean;
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

// Send message — local timestamp to avoid UI delay
export async function sendMessage(
  roomCode: string,
  text: string,
  senderId: string,
  senderName: string,
  replyTo?: ReplyTo,
  media?: { url: string; publicId: string; type: "image" | "audio" }
): Promise<void> {
  const now = Timestamp.fromMillis(Date.now());
  const expireAt = Timestamp.fromMillis(Date.now() + 4 * 60 * 60 * 1000);
  await addDoc(collection(db, "rooms", roomCode, "messages"), {
    text, senderId, senderName,
    type: media?.type ?? "text",
    timestamp: now,
    status: "sent", expireAt,
    ...(replyTo ? { replyTo } : {}),
    ...(media ? { mediaUrl: media.url, cloudinaryId: media.publicId } : {}),
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
  await Promise.all(snap.docs.map(async (d) => {
    const data = d.data();
    if (data.cloudinaryId) {
      const resourceType = data.type === "audio" ? "video" : "image";
      fetch("/api/delete-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId: data.cloudinaryId, resourceType }),
      }).catch(() => {});
    }
    return deleteDoc(d.ref);
  }));
}

// React to a message with an emoji (null removes reaction)
export async function reactToMessage(
  roomCode: string,
  messageId: string,
  playerId: string,
  emoji: string | null
): Promise<void> {
  const ref = doc(db, "rooms", roomCode, "messages", messageId);
  await updateDoc(ref, {
    [`reactions.${playerId}`]: emoji ?? deleteField(),
  });
}

// Delete message for everyone — keeps doc but marks deleted
export async function deleteMessage(
  roomCode: string,
  messageId: string
): Promise<void> {
  await updateDoc(doc(db, "rooms", roomCode, "messages", messageId), {
    deleted: true,
    text: "",
  });
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
  }, { merge: true });
}

// Typing indicator
export async function updateTyping(
  roomCode: string,
  playerId: string,
  isTyping: boolean
): Promise<void> {
  await setDoc(doc(db, "rooms", roomCode, "presence", playerId), {
    typing: isTyping,
  }, { merge: true });
}

// Panic button — force other player to game screen
export async function triggerPanic(roomCode: string, targetPlayerId: string): Promise<void> {
  await setDoc(doc(db, "rooms", roomCode, "presence", targetPlayerId), {
    panic: true,
  }, { merge: true });
}

// Clear panic signal (called by the target after receiving it)
export async function clearPanic(roomCode: string, playerId: string): Promise<void> {
  await setDoc(doc(db, "rooms", roomCode, "presence", playerId), {
    panic: false,
  }, { merge: true });
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
