"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const NAMES = [
  "xX_BladeRunner_Xx","NightOwl99","QuantumDash","ShadowStrike","NeonPhantom",
  "CyberWolf47","VoidHunter","PixelNinja","StormBreaker","IronGhost",
  "DarkMatter_7","UltraViper","LaserKnight","ByteAssassin","GridRunner",
  "TurboFlash","CodeBeast","NovaPulse","RedShift_X","HyperZero",
  "GlitchKing","SteelStorm","PhantomByte","NeonWraith","VoltFury",
  "DriftMaster","SkullCrusher","RocketFist","ZeroGravity","DarkFlame",
  "SwiftBlade","CryptoKid","NightFury_9","OmegaStrike","ThunderBolt",
  "SilentKiller","AcidRain_X","DeepSpace7","VenomCoil","FirestormZ",
];

const COLORS = ["#7c3aed","#06b6d4","#f59e0b","#ec4899","#10b981","#ef4444","#8b5cf6","#f97316","#14b8a6","#a855f7"];

function makeFakePlayers() {
  const shuffled = [...NAMES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 12).map((name, i) => ({
    name,
    score: Math.floor(38000 - i * 2800 + Math.random() * 500),
    wpm: Math.max(18, Math.floor(92 - i * 5 + Math.random() * 8)),
    color: COLORS[i % COLORS.length],
  }));
}

export default function Home() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scores, setScores] = useState(() => makeFakePlayers());
  const [myScore] = useState(42100);
  const [onlineCount, setOnlineCount] = useState(143);
  const [showLobby, setShowLobby] = useState(false);

  // Particle background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;

    const particles: { x: number; y: number; vx: number; vy: number; size: number; opacity: number; color: string }[] = [];
    const colors = ["#00ffaa", "#7c3aed", "#06b6d4", "#f59e0b"];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.5 + 0.1,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  // Animate fake scores
  useEffect(() => {
    const t = setInterval(() => {
      setScores(p => p.map(s => ({
        ...s,
        score: s.score + Math.floor(Math.random() * 300),
        wpm: Math.max(18, s.wpm + Math.floor(Math.random() * 5) - 2),
      })));
      setOnlineCount(c => Math.max(100, c + Math.floor(Math.random() * 7) - 3));
    }, 2500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="hero-bg h-dvh flex flex-col relative overflow-hidden select-none">
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }} />

      <div className="relative z-10 flex flex-col h-full">

        {/* LOBBY VIEW */}
        {showLobby ? (
          <>
            {/* Lobby header */}
            <div className="flex items-center gap-3 px-5 pt-5 pb-3 shrink-0">
              <button onClick={() => setShowLobby(false)}
                className="active:opacity-60 text-sm" style={{ color: "#4a5568" }}>←</button>
              <div className="font-bold tracking-widest text-sm" style={{ color: "#00ffaa" }}>LOBBY</div>
              <div className="ml-auto flex items-center gap-2">
                <div className="w-2 h-2 rounded-full animate-ping" style={{ background: "#00ffaa", opacity: 0.6 }} />
                <span className="text-[10px] tracking-widest" style={{ color: "#00ffaa" }}>{onlineCount}+ ONLINE</span>
              </div>
            </div>

            {/* Leaderboard */}
            <div className="flex-1 overflow-y-auto px-4 chat-scroll">
              <div className="text-[10px] tracking-widest mb-3 px-1" style={{ color: "#4a5568" }}>── TOP PLAYERS TODAY ──</div>

              <div className="mb-2 p-3 rounded-2xl lb-row"
                style={{
                  background: "linear-gradient(135deg, rgba(0,255,170,0.08), rgba(0,255,170,0.03))",
                  border: "1px solid rgba(0,255,170,0.25)",
                }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: "rgba(0,255,170,0.15)", color: "#00ffaa", border: "1px solid rgba(0,255,170,0.3)" }}>
                      #1
                    </div>
                    <div>
                      <div className="text-white text-sm font-bold">Player 01</div>
                      <div className="text-[10px] tracking-widest" style={{ color: "#00ffaa" }}>● YOU</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-base" style={{ color: "#00ffaa" }}>{myScore.toLocaleString()}</div>
                    <div className="text-[10px]" style={{ color: "#4a5568" }}>102 WPM</div>
                  </div>
                </div>
              </div>

              {scores.map((p, i) => (
                <div key={p.name} className="mb-2 p-3 rounded-2xl lb-row"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: `${p.color}15`, color: p.color, border: `1px solid ${p.color}30` }}>
                        #{i + 2}
                      </div>
                      <div className="text-sm" style={{ color: "#718096" }}>{p.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold" style={{ color: "#e2e8f0" }}>{p.score.toLocaleString()}</div>
                      <div className="text-[10px]" style={{ color: "#4a5568" }}>{p.wpm} WPM</div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-center gap-2 py-3">
                <div className="flex -space-x-1">
                  {["#7c3aed","#06b6d4","#f59e0b","#ec4899"].map((c, i) => (
                    <div key={i} className="w-5 h-5 rounded-full border-2"
                      style={{ background: c, borderColor: "#07000f" }} />
                  ))}
                </div>
                <span className="text-[10px] tracking-widest" style={{ color: "#4a5568" }}>
                  +{onlineCount - 13} more players competing
                </span>
              </div>
              <div className="h-4" />
            </div>

            {/* Play from lobby */}
            <div className="px-5 pb-6 safe-bottom">
              <button onClick={() => router.push("/game")}
                className="w-full py-4 rounded-2xl font-bold text-base tracking-widest text-black active:scale-[0.97] transition-transform pulse-btn"
                style={{
                  background: "linear-gradient(135deg, #00ffaa, #00cc88)",
                  boxShadow: "0 0 30px rgba(0,255,170,0.3), 0 4px 20px rgba(0,0,0,0.5)",
                }}>
                ▶ &nbsp; PLAY NOW
              </button>
            </div>
          </>
        ) : (
          /* HOME VIEW */
          <div className="flex flex-col items-center justify-center flex-1 px-8">
            {/* Title */}
            <div className="text-center mb-2">
              <div className="text-5xl font-black tracking-widest mb-2">
                <span style={{ color: "#00ffaa", textShadow: "0 0 24px #00ffaa99, 0 0 60px #00ffaa33" }}>TYPE</span>
                <span className="text-white" style={{ textShadow: "0 0 10px rgba(255,255,255,0.1)" }}>BATTLE</span>
              </div>
              <div className="text-[10px] tracking-[0.4em]" style={{ color: "#4a5568" }}>MULTIPLAYER · v2.4</div>
            </div>

            {/* Online pill */}
            <div className="flex items-center gap-2 mb-12 mt-4">
              <div className="relative w-2 h-2">
                <div className="w-2 h-2 rounded-full" style={{ background: "#00ffaa" }} />
                <div className="absolute inset-0 w-2 h-2 rounded-full animate-ping" style={{ background: "#00ffaa", opacity: 0.4 }} />
              </div>
              <span className="text-[10px] tracking-widest" style={{ color: "#00ffaa" }}>{onlineCount}+ PLAYERS ONLINE</span>
            </div>

            {/* Buttons */}
            <div className="w-full flex flex-col gap-3">
              <button onClick={() => setShowLobby(true)}
                className="w-full py-4 rounded-2xl font-bold text-sm tracking-widest active:scale-[0.97] transition-transform"
                style={{
                  background: "rgba(0,255,170,0.07)",
                  border: "1px solid rgba(0,255,170,0.2)",
                  color: "#00ffaa",
                }}>
                🏆 &nbsp; LOBBY
              </button>

              <button onClick={() => router.push("/game")}
                className="w-full py-4 rounded-2xl font-bold text-base tracking-widest text-black active:scale-[0.97] transition-transform pulse-btn"
                style={{
                  background: "linear-gradient(135deg, #00ffaa, #00cc88)",
                  boxShadow: "0 0 30px rgba(0,255,170,0.3), 0 4px 20px rgba(0,0,0,0.5)",
                }}>
                ▶ &nbsp; PLAY NOW
              </button>

              <button onClick={() => router.push("/settings")}
                className="w-full py-3 rounded-2xl font-bold text-sm tracking-widest active:scale-[0.97] transition-transform"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  color: "#4a5568",
                }}>
                ⚙ &nbsp; SETTINGS
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
