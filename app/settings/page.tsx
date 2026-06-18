"use client";
export const dynamic = "force-dynamic";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { signInAnonymously } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { joinRoom } from "@/lib/firestore";

const SETTINGS = [
  { label: "Sound FX",         value: "ON",        icon: "🔊" },
  { label: "Vibration",        value: "ON",        icon: "📳" },
  { label: "Theme",            value: "NEON DARK", icon: "🎨" },
  { label: "Language",         value: "ENGLISH",   icon: "🌐" },
  { label: "Region",           value: "AUTO",      icon: "📍" },
  { label: "Notifications",    value: "GAME ONLY", icon: "🔔" },
  { label: "Auto-save Replay", value: "OFF",       icon: "📹" },
  { label: "Show WPM",         value: "ON",        icon: "⚡" },
  { label: "Keyboard Layout",  value: "QWERTY",    icon: "⌨" },
  { label: "Graphics Quality", value: "HIGH",      icon: "🖥" },
  { label: "App Version",      value: "v2.4.1",    icon: "ℹ" },
];

const PRIVATE_CODE = "000111";

export default function SettingsPage() {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPlayers, setShowPlayers] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const playersRef = useRef<HTMLDivElement>(null);

  const code = digits.join("");

  const handleDigit = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const digit = val.slice(-1);
    const newDigits = [...digits];
    newDigits[i] = digit;
    setDigits(newDigits);
    setError("");
    if (digit && i < 5) {
      inputRefs.current[i + 1]?.focus();
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[i]) {
        const d = [...digits]; d[i] = ""; setDigits(d);
      } else if (i > 0) {
        const d = [...digits]; d[i - 1] = ""; setDigits(d);
        inputRefs.current[i - 1]?.focus();
      }
    }
    if (e.key === "Enter") handleSubmit();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length > 0) {
      const newDigits = Array(6).fill("");
      pasted.split("").forEach((ch, i) => { newDigits[i] = ch; });
      setDigits(newDigits);
      const nextFocus = Math.min(pasted.length, 5);
      inputRefs.current[nextFocus]?.focus();
    }
    e.preventDefault();
  };

  const handleSubmit = async () => {
    if (code.length !== 6) { setError("Enter all 6 digits"); return; }
    if (code !== PRIVATE_CODE) {
      setError("Room not found. Check your code.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const cred = await signInAnonymously(auth);
      const uid = cred.user.uid;
      const result = await joinRoom(PRIVATE_CODE, uid);
      if (!result) { setError("Could not connect. Try again."); setLoading(false); return; }
      localStorage.setItem("playerId", uid);
      localStorage.setItem("playerName", `Player 0${result.playerNum}`);
      localStorage.setItem("roomCode", PRIVATE_CODE);
      router.push(`/chat/${PRIVATE_CODE}`);
    } catch {
      setError("Something went wrong. Try again.");
    }
    setLoading(false);
  };

  const openPlayers = () => {
    setShowPlayers(true);
    setTimeout(() => {
      playersRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRefs.current[0]?.focus();
    }, 100);
  };

  return (
    <div className="h-dvh flex flex-col select-none" style={{ background: "#07000f" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <button onClick={() => router.push("/")} className="active:opacity-60"
          style={{ color: "#4a5568", fontSize: 14 }}>←</button>
        <div className="font-bold tracking-widest"
          style={{ color: "#00ffaa", textShadow: "0 0 8px #00ffaa55" }}>SETTINGS</div>
      </div>

      <div className="flex-1 chat-scroll">
        <div className="px-5 py-2">
          {SETTINGS.map((item) => (
            <div key={item.label} className="flex items-center justify-between py-3.5"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div className="flex items-center gap-3">
                <span>{item.icon}</span>
                <span className="text-sm" style={{ color: "#718096" }}>{item.label}</span>
              </div>
              <span className="text-sm font-bold" style={{ color: "#e2e8f0" }}>{item.value}</span>
            </div>
          ))}

          {/* Players — hidden section at bottom */}
          <div ref={playersRef} className="pt-8 pb-4">
            <div className="text-[10px] tracking-widest mb-4" style={{ color: "#2d3748" }}>
              ── PLAYERS ──
            </div>

            {!showPlayers ? (
              <button onClick={openPlayers}
                className="w-full py-3 rounded-xl text-xs tracking-widest active:opacity-70"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", color: "#2d3748" }}>
                Private Match
              </button>
            ) : (
              <div className="slide-up rounded-2xl p-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="font-bold text-sm text-white mb-1">Enter Room Code</div>
                <div className="text-[11px] mb-5" style={{ color: "#4a5568" }}>
                  6-digit private match code required
                </div>

                {/* 6-box PIN input */}
                <div className="flex gap-2 mb-4" onPaste={handlePaste}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <input
                      key={i}
                      ref={el => { inputRefs.current[i] = el; }}
                      type="number"
                      inputMode="numeric"
                      maxLength={1}
                      value={digits[i]}
                      onChange={e => handleDigit(i, e.target.value)}
                      onKeyDown={e => handleKeyDown(i, e)}
                      onFocus={e => e.target.select()}
                      className="flex-1 h-14 text-center text-xl font-bold outline-none rounded-xl"
                      style={{
                        background: digits[i] ? "rgba(0,255,170,0.08)" : "rgba(255,255,255,0.05)",
                        border: `2px solid ${digits[i] ? "rgba(0,255,170,0.5)" : "rgba(255,255,255,0.08)"}`,
                        color: "#00ffaa",
                        WebkitAppearance: "none",
                        MozAppearance: "textfield",
                        transition: "all 0.15s",
                      }}
                    />
                  ))}
                </div>

                {error && (
                  <div className="text-xs text-center py-2 mb-3 rounded-xl slide-up"
                    style={{ background: "rgba(255,68,68,0.08)", color: "#ff6666", border: "1px solid rgba(255,68,68,0.15)" }}>
                    {error}
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={loading || code.length !== 6}
                  className="w-full py-4 rounded-xl font-bold text-sm tracking-widest text-black active:scale-95 transition-transform disabled:opacity-30"
                  style={{ background: "linear-gradient(135deg,#00ffaa,#00cc88)" }}>
                  {loading ? "CONNECTING..." : "JOIN MATCH"}
                </button>

                <button onClick={() => { setShowPlayers(false); setDigits(Array(6).fill("")); setError(""); }}
                  className="w-full mt-2 py-2 text-xs" style={{ color: "#2d3748" }}>
                  Cancel
                </button>
              </div>
            )}
          </div>
          <div className="h-16" />
        </div>
      </div>
    </div>
  );
}
