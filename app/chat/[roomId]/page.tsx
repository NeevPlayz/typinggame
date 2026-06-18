"use client";
export const dynamic = "force-dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  listenMessages, sendMessage,
  markSeen, markDelivered, cleanupExpired, Message,
} from "@/lib/firestore";
import { registerPushToken } from "@/lib/notifications";
import { extractLinks } from "@/lib/utils";

function Tick({ status }: { status: Message["status"] }) {
  if (status === "sent") return <span style={{ color: "#4a5568", fontSize: 10 }}>✓</span>;
  if (status === "delivered") return <span style={{ color: "#718096", fontSize: 10 }}>✓✓</span>;
  return <span style={{ color: "#00ffaa", fontSize: 10, textShadow: "0 0 5px #00ffaa66" }}>✓✓</span>;
}

function Bubble({ msg, isMe, onSeen }: { msg: Message; isMe: boolean; onSeen: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isMe || msg.status === "seen") return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { onSeen(); obs.disconnect(); } },
      { threshold: 0.8 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [isMe, msg.status, onSeen]);

  const time = msg.timestamp?.toDate
    ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className={`flex mb-3 slide-up ${isMe ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
        {!isMe && (
          <span className="text-[10px] mb-1 ml-2 tracking-wide" style={{ color: "#4a5568" }}>
            {msg.senderName}
          </span>
        )}
        <div
          ref={ref}
          style={{
            padding: "10px 14px",
            borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
            fontSize: 14,
            lineHeight: 1.55,
            color: "#e2e8f0",
            wordBreak: "break-word",
            ...(isMe
              ? { background: "linear-gradient(135deg,#6d28d9,#4c1d95)", boxShadow: "0 2px 14px rgba(109,40,217,0.35)" }
              : { background: "#12102a", border: "1px solid rgba(255,255,255,0.06)" }),
          }}
        >
          {extractLinks(msg.text || "").map((part, i) =>
            part.isLink ? (
              <a key={i} href={part.url} target="_blank" rel="noopener noreferrer"
                style={{ color: "#00ffaa", textDecoration: "underline", wordBreak: "break-all" }}
                onClick={e => e.stopPropagation()}>
                {part.text}
              </a>
            ) : <span key={i}>{part.text}</span>
          )}
        </div>
        <div className={`flex items-center gap-1.5 mt-1 ${isMe ? "flex-row-reverse" : ""}`}
          style={{ paddingInline: 4 }}>
          <span style={{ fontSize: 10, color: "#4a5568" }}>{time}</span>
          {isMe && <Tick status={msg.status} />}
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const playerIdRef = useRef("");

  useEffect(() => {
    const id = localStorage.getItem("playerId") || "";
    const pn = localStorage.getItem("playerName") || "Player 01";
    const rc = localStorage.getItem("roomCode") || "";
    setPlayerId(id);
    playerIdRef.current = id;
    setPlayerName(pn);
    setOtherName(pn === "Player 01" ? "Player 02" : "Player 01");
    setRoomCode(rc);
    if (!roomId || !id) return;
    const rid = roomId as string;
    cleanupExpired(rid).catch(() => {});
    registerPushToken(rid, id).catch(() => {});
  }, [roomId]);

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

  const handleSend = async () => {
    const t = text.trim();
    if (!t || !playerId) return;
    setText("");
    if (inputRef.current) inputRef.current.style.height = "48px";
    await sendMessage(roomId as string, t, playerId, playerName);
    fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomCode: roomId, senderId: playerId }),
    }).catch(() => {});
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="h-dvh flex flex-col" style={{ background: "#07000f" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: "linear-gradient(135deg,#6d28d9,#4c1d95)", boxShadow: "0 0 14px rgba(109,40,217,0.4)" }}>
            {otherName.slice(-2)}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
              style={{ background: "#00ffaa", borderColor: "#07000f" }} />
          </div>
          <div>
            <div className="font-bold text-sm text-white">{otherName}</div>
            <div className="text-[10px] tracking-wide" style={{ color: "#00ffaa" }}>● in game</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[10px] tracking-widest px-2 py-1 rounded-lg"
            style={{ border: "1px solid rgba(255,255,255,0.05)", color: "#2d3748" }}>
            {roomCode}
          </div>
          <button onClick={() => router.push("/game")}
            className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-transform"
            style={{ background: "rgba(0,255,170,0.07)", border: "1px solid rgba(0,255,170,0.18)", fontSize: 18 }}>
            🎮
          </button>
        </div>
      </div>

      {/* Notice */}
      <div className="flex items-center justify-center py-1.5"
        style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <span style={{ fontSize: 10, color: "#2d3748" }}>
          ⏱ Read → 1hr · Unread → 4hr
        </span>
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
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 safe-bottom shrink-0"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Message..."
            rows={1}
            className="flex-1 text-white text-sm outline-none resize-none"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              padding: "12px 14px",
              minHeight: 48,
              maxHeight: 120,
              lineHeight: 1.5,
              fontFamily: "inherit",
              fontSize: 14,
              color: "#e2e8f0",
            }}
            onFocus={e => e.currentTarget.style.borderColor = "rgba(0,255,170,0.3)"}
            onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 120) + "px";
            }}
          />
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
    </div>
  );
}
