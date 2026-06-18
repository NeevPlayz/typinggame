"use client";
export const dynamic = "force-dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

const ROOMS: Record<string, Record<string, { password: string; displayName: string; otherName: string }>> = {
  "000111": {
    ragini: { password: "ragini", displayName: "Ragini", otherName: "Neev" },
    neev:   { password: "neev",   displayName: "Neev",   otherName: "Ragini" },
  },
  "000000": {
    alex:  { password: "alex123",  displayName: "Alex",  otherName: "Sam" },
    sam:   { password: "sam123",   displayName: "Sam",   otherName: "Alex" },
  },
};

type Step = "hidden" | "pin" | "login" | "ready";

export default function SettingsPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("hidden");
  const [pinText, setPinText] = useState("");
  const [activeRoom, setActiveRoom] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loggedInAs, setLoggedInAs] = useState<string | null>(null);
  const playersRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const pid = localStorage.getItem("playerId");
    const pname = localStorage.getItem("playerName");
    const rc = localStorage.getItem("roomCode");
    if (pid && pname && rc && ROOMS[rc]?.[pid]) setLoggedInAs(pname);
  }, []);

  const checkPin = () => {
    const code = pinText.trim();
    if (code.length !== 6) { setError("Enter all 6 digits"); return; }
    if (!ROOMS[code]) { setError("Room not found. Check your code."); return; }
    setError("");
    setActiveRoom(code);
    const storedRoom = localStorage.getItem("roomCode");
    if (loggedInAs && storedRoom === code) setStep("ready");
    else { setStep("login"); setTimeout(() => usernameRef.current?.focus(), 100); }
  };

  const handleLogin = async () => {
    const u = username.trim().toLowerCase();
    const p = password.trim();
    const user = ROOMS[activeRoom]?.[u];
    if (!user || user.password !== p) { setError("Wrong player tag or access code."); return; }
    setLoading(true); setError("");
    try {
      await joinRoom(activeRoom, u);
      localStorage.setItem("playerId", u);
      localStorage.setItem("playerName", user.displayName);
      localStorage.setItem("otherName", user.otherName);
      localStorage.setItem("roomCode", activeRoom);
      router.push(`/chat/${activeRoom}`);
    } catch {
      setError("Could not connect. Try again.");
    }
    setLoading(false);
  };

  const openPlayers = () => {
    setStep("pin");
    setTimeout(() => {
      playersRef.current?.scrollIntoView({ behavior: "smooth" });
      pinRef.current?.focus();
    }, 100);
  };

  const reset = () => {
    setStep("hidden");
    setPinText(""); setUsername(""); setPassword(""); setError("");
  };

  const inputStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#e2e8f0",
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

          {/* Hidden players section */}
          <div ref={playersRef} className="pt-8 pb-4">
            <div className="text-[10px] tracking-widest mb-4" style={{ color: "#2d3748" }}>
              ── PLAYERS ──
            </div>

            {step === "hidden" && (
              <button onClick={openPlayers}
                className="w-full py-3 rounded-xl text-xs tracking-widest active:opacity-70"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", color: "#2d3748" }}>
                Private Match
              </button>
            )}

            {step === "pin" && (
              <div className="slide-up rounded-2xl p-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="font-bold text-sm text-white mb-1">Enter Room Code</div>
                <div className="text-[11px] mb-4" style={{ color: "#4a5568" }}>6-digit private match code</div>

                <input
                  ref={pinRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinText}
                  onChange={e => { setPinText(e.target.value.replace(/\D/g, "")); setError(""); }}
                  onKeyDown={e => e.key === "Enter" && checkPin()}
                  placeholder="000000"
                  className="w-full rounded-xl px-4 py-3 text-center text-xl font-bold outline-none tracking-[0.4em] mb-4"
                  style={{
                    ...inputStyle,
                    color: "#00ffaa",
                    letterSpacing: "0.4em",
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = "rgba(0,255,170,0.4)"}
                  onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
                />

                {error && (
                  <div className="text-xs text-center py-2 mb-3 rounded-xl"
                    style={{ background: "rgba(255,68,68,0.08)", color: "#ff6666", border: "1px solid rgba(255,68,68,0.15)" }}>
                    {error}
                  </div>
                )}

                <button onClick={checkPin} disabled={pinText.length !== 6}
                  className="w-full py-4 rounded-xl font-bold text-sm tracking-widest text-black active:scale-95 transition-transform disabled:opacity-30"
                  style={{ background: "linear-gradient(135deg,#00ffaa,#00cc88)" }}>
                  VERIFY CODE
                </button>
                <button onClick={reset} className="w-full mt-2 py-2 text-xs" style={{ color: "#2d3748" }}>
                  Cancel
                </button>
              </div>
            )}

            {step === "login" && (
              <div className="slide-up rounded-2xl p-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="font-bold text-sm text-white mb-1">Who are you?</div>
                <div className="text-[11px] mb-4" style={{ color: "#4a5568" }}>Enter your player credentials</div>

                <div className="flex flex-col gap-3 mb-4">
                  <input ref={usernameRef} type="text" value={username}
                    onChange={e => { setUsername(e.target.value); setError(""); }}
                    onKeyDown={e => e.key === "Enter" && handleLogin()}
                    placeholder="Player Tag"
                    autoCapitalize="none" autoCorrect="off"
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                    style={inputStyle}
                    onFocus={e => e.currentTarget.style.borderColor = "rgba(0,255,170,0.4)"}
                    onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
                  />
                  <input type="password" value={password}
                    onChange={e => { setPassword(e.target.value); setError(""); }}
                    onKeyDown={e => e.key === "Enter" && handleLogin()}
                    placeholder="Access Code"
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                    style={inputStyle}
                    onFocus={e => e.currentTarget.style.borderColor = "rgba(0,255,170,0.4)"}
                    onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
                  />
                </div>

                {error && (
                  <div className="text-xs text-center py-2 mb-3 rounded-xl"
                    style={{ background: "rgba(255,68,68,0.08)", color: "#ff6666", border: "1px solid rgba(255,68,68,0.15)" }}>
                    {error}
                  </div>
                )}

                <button onClick={handleLogin} disabled={loading || !username.trim() || !password.trim()}
                  className="w-full py-4 rounded-xl font-bold text-sm tracking-widest text-black active:scale-95 transition-transform disabled:opacity-30"
                  style={{ background: "linear-gradient(135deg,#00ffaa,#00cc88)" }}>
                  {loading ? "CONNECTING..." : "JOIN MATCH"}
                </button>
                <button onClick={reset} className="w-full mt-2 py-2 text-xs" style={{ color: "#2d3748" }}>
                  Cancel
                </button>
              </div>
            )}

            {step === "ready" && (
              <div className="slide-up rounded-2xl p-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="text-center mb-5">
                  <div className="text-xs mb-1" style={{ color: "#4a5568" }}>logged in as</div>
                  <div className="font-bold text-xl" style={{ color: "#00ffaa" }}>{loggedInAs}</div>
                </div>
                <button onClick={() => router.push(`/chat/${localStorage.getItem("roomCode")}`)}
                  className="w-full py-4 rounded-xl font-bold text-sm tracking-widest text-black active:scale-95 transition-transform"
                  style={{ background: "linear-gradient(135deg,#00ffaa,#00cc88)" }}>
                  START MATCH
                </button>
                <button onClick={() => {
                  localStorage.removeItem("playerId"); localStorage.removeItem("playerName");
                  localStorage.removeItem("otherName"); localStorage.removeItem("roomCode");
                  setLoggedInAs(null); reset();
                }} className="w-full mt-2 py-2 text-xs" style={{ color: "#2d3748" }}>
                  Switch player
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
