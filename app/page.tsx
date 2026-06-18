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
      {/* Particle canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }} />

      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="flex flex-col items-center pt-8 pb-2">
          <div className="text-4xl font-black tracking-widest mb-1">
            <span style={{ color: "#00ffaa", textShadow: "0 0 20px #00ffaa88, 0 0 40px #00ffaa44" }}>TYPE</span>
            <span className="text-white" style={{ textShadow: "0 0 10px rgba(255,255,255,0.15)" }}>BATTLE</span>
          </div>
          <div className="text-[10px] tracking-[0.35em]" style={{ color: "#4a5568" }}>MULTIPLAYER · v2.4</div>
        </div>

        {/* Online bar */}
        <div className="px-5 py-2 flex items-center gap-2">
          <div className="relative flex items-center justify-center w-4 h-4">
            <div className="w-2 h-2 rounded-full" style={{ background: "#00ffaa" }} />
            <div className="absolute w-2 h-2 rounded-full animate-ping" style={{ background: "#00ffaa", opacity: 0.4 }} />
          </div>
          <span className="text-[10px] tracking-widest font-bold" style={{ color: "#00ffaa" }}>
            {onlineCount}+ PLAYERS ONLINE
          </span>
          <div className="ml-auto text-[10px]" style={{ color: "#4a5568" }}>RANKED · GLOBAL</div>
        </div>

        {/* Leaderboard */}
        <div className="flex-1 overflow-hidden px-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="text-[10px] tracking-widest" style={{ color: "#4a5568" }}>── TOP PLAYERS TODAY ──</div>
            <div className="text-[10px] tracking-widest" style={{ color: "#2d3748" }}>{onlineCount}+ active</div>
          </div>

          {/* #1 YOU */}
          <div
            className="mb-2 p-3 rounded-2xl lb-row"
            style={{
              background: "linear-gradient(135deg, rgba(0,255,170,0.08), rgba(0,255,170,0.03))",
              border: "1px solid rgba(0,255,170,0.25)",
              boxShadow: "0 0 20px rgba(0,255,170,0.05)",
            }}
          >
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
                <div className="font-bold text-base glow-green" style={{ color: "#00ffaa" }}>
                  {myScore.toLocaleString()}
                </div>
                <div className="text-[10px]" style={{ color: "#4a5568" }}>102 WPM</div>
              </div>
            </div>
          </div>

          {/* Fake players */}
          {scores.map((p, i) => (
            <div
              key={p.name}
              className="mb-2 p-3 rounded-2xl lb-row"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
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

          {/* More players indicator */}
          <div className="flex items-center justify-center gap-2 py-2 mb-1">
            <div className="flex -space-x-1">
              {["#7c3aed","#06b6d4","#f59e0b","#ec4899"].map((c,i) => (
                <div key={i} className="w-5 h-5 rounded-full border-2"
                  style={{ background: c, borderColor: "#07000f" }} />
              ))}
            </div>
            <span className="text-[10px] tracking-widest" style={{ color: "#4a5568" }}>
              +{onlineCount - 13} more players competing
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="px-5 pb-6 safe-bottom flex flex-col gap-3">
          <button
            onClick={() => router.push("/game")}
            className="w-full py-4 rounded-2xl font-bold text-base tracking-widest text-black active:scale-[0.97] transition-transform pulse-btn"
            style={{
              background: "linear-gradient(135deg, #00ffaa, #00cc88)",
              boxShadow: "0 0 30px rgba(0,255,170,0.3), 0 4px 20px rgba(0,0,0,0.5)",
            }}
          >
            ▶ &nbsp; PLAY NOW
          </button>
          <button
            onClick={() => router.push("/settings")}
            className="w-full py-3 rounded-2xl font-bold text-sm tracking-widest active:scale-[0.97] transition-transform"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#718096",
            }}
          >
            ⚙ &nbsp; SETTINGS
          </button>
        </div>
      </div>
    </div>
  );
}
