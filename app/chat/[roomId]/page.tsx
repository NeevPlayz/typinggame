"use client";
export const dynamic = "force-dynamic";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  listenMessages, sendMessage,
  markSeen, markDelivered, cleanupExpired, Message, ReplyTo,
  updatePresence, listenPresence, updateTyping,
  triggerPanic, clearPanic,
  reactToMessage, deleteMessage,
} from "@/lib/firestore";
import { registerPushToken } from "@/lib/notifications";
import { extractLinks } from "@/lib/utils";
import { uploadMedia } from "@/lib/cloudinary";

const EMOJIS = ["❤️", "😂", "😮", "😢", "🔥", "👍"];

function formatLastSeen(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function Tick({ status }: { status: Message["status"] }) {
  if (status === "sent") return <span style={{ color: "#4a5568", fontSize: 10 }}>✓</span>;
  if (status === "delivered") return <span style={{ color: "#718096", fontSize: 10 }}>✓✓</span>;
  return <span style={{ color: "#00ffaa", fontSize: 10, textShadow: "0 0 5px #00ffaa66" }}>✓✓</span>;
}

function Bubble({
  msg, isMe, onSeen, onLongPress, onReply,
}: {
  msg: Message;
  isMe: boolean;
  onSeen: () => void;
  onLongPress: () => void;
  onReply: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef(0);
  const swiped = useRef(false);
  const repliedThisSwipe = useRef(false);

  useEffect(() => {
    if (isMe || msg.status === "seen") return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { onSeen(); obs.disconnect(); } },
      { threshold: 0.8 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [isMe, msg.status, onSeen]);

  const startHold = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    swiped.current = false;
    repliedThisSwipe.current = false;
    holdTimer.current = setTimeout(() => {
      if (!swiped.current) {
        onLongPress();
        if (navigator.vibrate) navigator.vibrate(30);
      }
    }, 500);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 20) {
      swiped.current = true;
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (dx > 50 && !msg.deleted && !repliedThisSwipe.current) {
        repliedThisSwipe.current = true;
        onReply();
        if (navigator.vibrate) navigator.vibrate(20);
      }
    }
  };

  const cancelHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  };

  const time = msg.timestamp?.toDate
    ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  const reactionGroups: Record<string, number> = {};
  if (msg.reactions) {
    Object.values(msg.reactions).forEach(e => {
      reactionGroups[e] = (reactionGroups[e] || 0) + 1;
    });
  }
  const hasReactions = Object.keys(reactionGroups).length > 0;

  return (
    <div className={`flex mb-3 slide-up ${isMe ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
        {!isMe && !msg.deleted && (
          <span className="text-[10px] mb-1 ml-2 tracking-wide" style={{ color: "#4a5568" }}>
            {msg.senderName}
          </span>
        )}
        <div
          ref={ref}
          onTouchStart={startHold}
          onTouchMove={onTouchMove}
          onTouchEnd={cancelHold}
          onContextMenu={e => { e.preventDefault(); onLongPress(); }}
          style={{
            padding: msg.deleted ? "8px 14px" : "10px 14px",
            borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
            fontSize: 14,
            lineHeight: 1.55,
            wordBreak: "break-word",
            userSelect: "none",
            WebkitUserSelect: "none",
            ...(msg.deleted
              ? { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", color: "#4a5568", fontStyle: "italic" }
              : isMe
              ? { background: "linear-gradient(135deg,#6d28d9,#4c1d95)", boxShadow: "0 2px 14px rgba(109,40,217,0.35)", color: "#e2e8f0" }
              : { background: "#12102a", border: "1px solid rgba(255,255,255,0.06)", color: "#e2e8f0" }),
          }}
        >
          {/* Quoted reply */}
          {msg.replyTo && !msg.deleted && (
            <div className="mb-2 px-2 py-1.5 rounded-lg"
              style={{
                borderLeft: "2px solid #00ffaa",
                background: "rgba(0,255,170,0.07)",
              }}>
              <div className="text-[10px] font-bold mb-0.5" style={{ color: "#00ffaa" }}>
                {msg.replyTo.senderName}
              </div>
              <div className="text-xs line-clamp-2" style={{ color: "#718096" }}>
                {msg.replyTo.text}
              </div>
            </div>
          )}

          {msg.deleted ? (
            <span>🚫 message deleted</span>
          ) : msg.type === "image" && msg.mediaUrl ? (
            <img src={msg.mediaUrl} alt="" className="rounded-xl max-w-full"
              style={{ maxHeight: 260, display: "block" }}
              onClick={e => { e.stopPropagation(); window.open(msg.mediaUrl, "_blank"); }} />
          ) : msg.type === "audio" && msg.mediaUrl ? (
            <audio controls src={msg.mediaUrl} style={{ width: "100%", minWidth: 200, accentColor: "#00ffaa" }} />
          ) : (
            extractLinks(msg.text || "").map((part, i) =>
              part.isLink ? (
                <a key={i} href={part.url} target="_blank" rel="noopener noreferrer"
                  style={{ color: "#00ffaa", textDecoration: "underline", wordBreak: "break-all" }}
                  onClick={e => e.stopPropagation()}>
                  {part.text}
                </a>
              ) : <span key={i}>{part.text}</span>
            )
          )}
        </div>

        {hasReactions && (
          <div className={`flex gap-1 mt-1 flex-wrap ${isMe ? "justify-end" : "justify-start"}`}>
            {Object.entries(reactionGroups).map(([emoji, count]) => (
              <span key={emoji} className="px-1.5 py-0.5 rounded-full text-xs"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
                {emoji}{count > 1 ? ` ${count}` : ""}
              </span>
            ))}
          </div>
        )}

        <div className={`flex items-center gap-1.5 mt-1 ${isMe ? "flex-row-reverse" : ""}`}
          style={{ paddingInline: 4 }}>
          <span style={{ fontSize: 10, color: "#4a5568" }}>{time}</span>
          {isMe && !msg.deleted && <Tick status={msg.status} />}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [playerName, setPlayerName] = useState("Player 01");
  const [otherName, setOtherName] = useState("Player 02");
  const [roomCode, setRoomCode] = useState("");
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherLastSeen, setOtherLastSeen] = useState<Date | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [activeMsg, setActiveMsg] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<ReplyTo | null>(null);
  const [otherId, setOtherId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const playerIdRef = useRef("");
  const roomIdRef = useRef("");
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    const id = localStorage.getItem("playerId") || "";
    const pn = localStorage.getItem("playerName") || "Player 01";
    const on = localStorage.getItem("otherName") || "Player 02";
    const rc = localStorage.getItem("roomCode") || "";
    const oid = localStorage.getItem("otherId") || (id === "ragini" ? "neev" : "ragini");
    setPlayerId(id);
    playerIdRef.current = id;
    setPlayerName(pn);
    setOtherName(on);
    setOtherId(oid);
    setRoomCode(rc);
    if (!roomId || !id) return;
    const rid = roomId as string;
    roomIdRef.current = rid;
    cleanupExpired(rid).catch(() => {});
    registerPushToken(rid, id).catch(() => {});

    updatePresence(rid, id, true).catch(() => {});
    const ping = setInterval(() => updatePresence(rid, id, true).catch(() => {}), 20000);
    const markOffline = () => {
      updatePresence(rid, id, false).catch(() => {});
      updateTyping(rid, id, false).catch(() => {});
    };
    const handleVisibility = () => {
      if (document.hidden) {
        updatePresence(rid, id, false).catch(() => {});
        updateTyping(rid, id, false).catch(() => {});
      } else {
        updatePresence(rid, id, true).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", markOffline);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(ping);
      markOffline();
      window.removeEventListener("beforeunload", markOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [roomId]);

  // Listen to other player's presence + typing
  useEffect(() => {
    if (!roomId || !playerId) return;
    const rid = roomId as string;
    const oid = localStorage.getItem("otherId") || (playerId === "ragini" ? "neev" : "ragini");
    const unsub = listenPresence(rid, oid, (data) => {
      setOtherOnline(data.online);
      setOtherTyping(!!data.typing);
      if (data.lastSeen) setOtherLastSeen(data.lastSeen.toDate());
    });
    return () => unsub();
  }, [roomId, playerId]);

  // Listen to OWN presence for panic signal
  useEffect(() => {
    if (!roomId || !playerId) return;
    const rid = roomId as string;
    const unsub = listenPresence(rid, playerId, (data) => {
      if (data.panic) {
        clearPanic(rid, playerId).catch(() => {});
        router.replace("/game");
      }
    });
    return () => unsub();
  }, [roomId, playerId, router]);

  useEffect(() => {
    if (!roomId) return;
    const rid = roomId as string;
    const unsub = listenMessages(rid, (msgs) => {
      setMessages(msgs);
      const myId = playerIdRef.current;
      msgs.forEach((msg) => {
        if (msg.senderId !== myId && msg.status === "sent") {
          markDelivered(rid, msg.id).catch(() => {});
        }
      });
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    });
    return () => unsub();
  }, [roomId]);

  const handleTyping = (val: string) => {
    setText(val);
    const rid = roomIdRef.current;
    const id = playerIdRef.current;
    if (!rid || !id) return;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (val.length > 0) {
      // Only write to Firestore if not already marked as typing
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        updateTyping(rid, id, true).catch(() => {});
      }
      typingTimer.current = setTimeout(() => {
        isTypingRef.current = false;
        updateTyping(rid, id, false).catch(() => {});
      }, 5000);
    } else {
      isTypingRef.current = false;
      updateTyping(rid, id, false).catch(() => {});
    }
  };

  const handleSend = async () => {
    const t = text.trim();
    if (!t || !playerId) return;
    const rid = roomId as string;
    setText("");
    if (inputRef.current) inputRef.current.style.height = "48px";
    const reply = replyingTo ?? undefined;
    setReplyingTo(null);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    isTypingRef.current = false;
    updateTyping(rid, playerId, false).catch(() => {});
    await sendMessage(rid, t, playerId, playerName, reply);
    fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomCode: roomId, senderId: playerId }),
    }).catch(() => {});
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleReact = useCallback(async (emoji: string) => {
    if (!activeMsg || !playerId || !roomId) return;
    const current = activeMsg.reactions?.[playerId];
    await reactToMessage(roomId as string, activeMsg.id, playerId, current === emoji ? null : emoji);
    setActiveMsg(null);
  }, [activeMsg, playerId, roomId]);

  const handleDelete = useCallback(async () => {
    if (!activeMsg || !roomId) return;
    await deleteMessage(roomId as string, activeMsg.id);
    setActiveMsg(null);
  }, [activeMsg, roomId]);

  const handleImageSend = async (file: File) => {
    if (!playerId || !roomId) return;
    setUploading(true);
    const reply = replyingTo ?? undefined;
    setReplyingTo(null);
    try {
      const { url, publicId } = await uploadMedia(file, "image");
      await sendMessage(roomId as string, "", playerId, playerName, reply, { url, publicId, type: "image" });
      fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode: roomId, senderId: playerId }) }).catch(() => {});
    } catch { /* silent */ }
    setUploading(false);
  };

  const startRecording = async () => {
    if (isRecordingRef.current || uploading) return;
    isRecordingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // user may have released the button before mic permission came back
      if (!isRecordingRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4"
        : "";
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const reply = replyingTo ?? undefined;
      setReplyingTo(null);
      audioChunksRef.current = [];
      mr.ondataavailable = e => audioChunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || "audio/webm" });
        if (blob.size < 1000) return; // too short / empty, don't send
        setUploading(true);
        try {
          const { url, publicId } = await uploadMedia(blob, "audio");
          await sendMessage(roomId as string, "", playerId, playerName, reply, { url, publicId, type: "audio" });
          fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomCode: roomId, senderId: playerId }) }).catch(() => {});
        } catch { /* silent */ }
        setUploading(false);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      isRecordingRef.current = false;
    }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setRecording(false);
  };

  const handleReply = useCallback((msg: Message) => {
    if (msg.deleted) return;
    const previewText = msg.type === "image" ? "📷 Image"
      : msg.type === "audio" ? "🎙️ Voice message"
      : msg.text || "";
    setReplyingTo({ id: msg.id, text: previewText, senderName: msg.senderName });
    setActiveMsg(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const statusText = otherTyping ? "typing..."
    : otherOnline ? "● online"
    : otherLastSeen ? `last seen ${formatLastSeen(otherLastSeen)}` : "● offline";
  const statusColor = otherTyping ? "#a78bfa"
    : otherOnline ? "#00ffaa" : "#4a5568";
  const avatarLetter = otherName.charAt(0).toUpperCase();

  return (
    <div className="h-dvh flex flex-col" style={{ background: "#07000f" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: "linear-gradient(135deg,#6d28d9,#4c1d95)", boxShadow: "0 0 14px rgba(109,40,217,0.4)", color: "#fff" }}>
            {avatarLetter}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 transition-colors duration-500"
              style={{ background: otherOnline ? "#00ffaa" : "#4a5568", borderColor: "#07000f" }} />
          </div>
          <div>
            <div className="font-bold text-sm text-white">{otherName}</div>
            <div className="text-[10px] tracking-wide transition-colors duration-300 flex items-center gap-1" style={{ color: statusColor }}>
              {otherTyping && (
                <span className="inline-flex gap-0.5">
                  <span className="w-1 h-1 rounded-full animate-bounce" style={{ background: "#a78bfa", animationDelay: "0ms" }} />
                  <span className="w-1 h-1 rounded-full animate-bounce" style={{ background: "#a78bfa", animationDelay: "150ms" }} />
                  <span className="w-1 h-1 rounded-full animate-bounce" style={{ background: "#a78bfa", animationDelay: "300ms" }} />
                </span>
              )}
              {statusText}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => otherId && roomId && triggerPanic(roomId as string, otherId).catch(() => {})}
            className="w-10 h-10 rounded-xl flex items-center justify-center active:scale-90 transition-transform"
            style={{ background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.15)", fontSize: 18 }}
            title="Switch to game">
            🎮
          </button>
          <div className="text-[10px] tracking-widest px-2 py-1 rounded-lg"
            style={{ border: "1px solid rgba(255,255,255,0.05)", color: "#2d3748" }}>
            {roomCode}
          </div>
        </div>
      </div>

      {/* Notice */}
      <div className="flex items-center justify-center py-1.5"
        style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <span style={{ fontSize: 10, color: "#2d3748" }}>⏱ Read → 1hr · Unread → 4hr</span>
      </div>

      {/* Messages */}
      <div className="flex-1 chat-scroll px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="text-5xl float" style={{ opacity: 0.25 }}>🎮</div>
            <div className="text-xs tracking-widest text-center" style={{ color: "#2d3748" }}>
              PRIVATE ROOM READY<br />start the conversation
            </div>
          </div>
        )}
        {messages.map(msg => (
          <Bubble
            key={msg.id}
            msg={msg}
            isMe={msg.senderId === playerId}
            onSeen={() => markSeen(roomId as string, msg.id)}
            onLongPress={() => setActiveMsg(msg)}
            onReply={() => handleReply(msg)}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 safe-bottom shrink-0"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>

        {/* Reply preview */}
        {replyingTo && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl"
            style={{ background: "rgba(0,255,170,0.05)", borderLeft: "2px solid #00ffaa" }}>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold mb-0.5" style={{ color: "#00ffaa" }}>
                Replying to {replyingTo.senderName}
              </div>
              <div className="text-xs truncate" style={{ color: "#718096" }}>{replyingTo.text}</div>
            </div>
            <button onClick={() => setReplyingTo(null)}
              className="text-xl leading-none active:opacity-60 shrink-0" style={{ color: "#4a5568" }}>
              ×
            </button>
          </div>
        )}

        {/* Hidden image input */}
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleImageSend(f); e.target.value = ""; }} />

        <div className="flex items-end gap-2">
          <button onClick={() => router.replace("/game")}
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 active:scale-90 transition-transform"
            style={{ background: "rgba(0,255,170,0.07)", border: "1px solid rgba(0,255,170,0.18)", fontSize: 18 }}>
            🎮
          </button>
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => handleTyping(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Message..."
            rows={1}
            className="flex-1 text-white text-sm outline-none resize-none"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16, padding: "12px 14px",
              minHeight: 48, maxHeight: 120, lineHeight: 1.5,
              fontFamily: "inherit", fontSize: 14, color: "#e2e8f0",
            }}
            onFocus={e => e.currentTarget.style.borderColor = "rgba(0,255,170,0.3)"}
            onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 120) + "px";
            }}
          />
          {/* Image button */}
          <button onClick={() => imageInputRef.current?.click()} disabled={uploading || recording}
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 active:scale-90 transition-transform disabled:opacity-40"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 18 }}>
            {uploading ? "⏳" : "🖼️"}
          </button>
          {/* Voice button */}
          <button
            onTouchStart={e => { e.preventDefault(); startRecording(); }}
            onTouchEnd={e => { e.preventDefault(); stopRecording(); }}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            disabled={uploading}
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-40"
            style={{
              background: recording ? "rgba(255,68,68,0.2)" : "rgba(255,255,255,0.04)",
              border: recording ? "1px solid rgba(255,68,68,0.5)" : "1px solid rgba(255,255,255,0.08)",
              fontSize: 18,
              transform: recording ? "scale(1.1)" : "scale(1)",
            }}>
            {recording ? "🔴" : "🎙️"}
          </button>
          <button onClick={handleSend} disabled={!text.trim()}
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 active:scale-90 transition-transform disabled:opacity-25"
            style={{
              background: text.trim() ? "linear-gradient(135deg,#6d28d9,#4c1d95)" : "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              fontSize: 18, color: "white",
            }}>
            ↑
          </button>
        </div>
      </div>

      {/* Action sheet */}
      {activeMsg && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setActiveMsg(null)}>
          <div className="w-full slide-up pb-safe" onClick={e => e.stopPropagation()}
            style={{ background: "#12102a", borderRadius: "24px 24px 0 0", border: "1px solid rgba(255,255,255,0.08)", paddingBottom: "env(safe-area-inset-bottom, 16px)" }}>

            {/* Emoji reactions */}
            <div className="flex justify-center gap-3 px-6 pt-5 pb-4">
              {EMOJIS.map(emoji => {
                const myReaction = activeMsg.reactions?.[playerId];
                const selected = myReaction === emoji;
                return (
                  <button key={emoji} onClick={() => handleReact(emoji)}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl active:scale-90 transition-all"
                    style={{
                      background: selected ? "rgba(0,255,170,0.15)" : "rgba(255,255,255,0.06)",
                      border: selected ? "2px solid rgba(0,255,170,0.5)" : "2px solid transparent",
                    }}>
                    {emoji}
                  </button>
                );
              })}
            </div>

            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 16px" }} />

            {/* Reply */}
            {!activeMsg.deleted && (
              <button onClick={() => handleReply(activeMsg)}
                className="w-full px-6 py-4 flex items-center gap-3 active:opacity-60"
                style={{ color: "#a78bfa" }}>
                <span className="text-lg">↩️</span>
                <span className="text-sm font-medium">Reply</span>
              </button>
            )}

            {/* Delete — only own messages */}
            {activeMsg.senderId === playerId && !activeMsg.deleted && (
              <button onClick={handleDelete}
                className="w-full px-6 py-4 flex items-center gap-3 active:opacity-60"
                style={{ color: "#ff4444" }}>
                <span className="text-lg">🗑️</span>
                <span className="text-sm font-medium">Delete for everyone</span>
              </button>
            )}

            <button onClick={() => setActiveMsg(null)}
              className="w-full px-6 py-4 flex items-center justify-center active:opacity-60"
              style={{ color: "#4a5568", fontSize: 14 }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
