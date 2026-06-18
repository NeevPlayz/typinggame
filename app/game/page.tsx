"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const WORDS = [
  "swift","blast","dodge","flame","ghost","hyper","laser","ninja","orbit",
  "power","quest","radar","storm","turbo","ultra","venom","warp","xenon",
  "blaze","crash","drive","elite","forge","haste","jump","kinetic","neon",
  "pulse","rush","surge","thunder","vault","wild","zoom","ace","bolt",
  "dash","echo","fury","glide","heat","ignite","jolt","keen","lock","mach",
];

function rnd(min: number, max: number) { return min + Math.random() * (max - min); }

interface Particle { x:number; y:number; vx:number; vy:number; life:number; maxLife:number; color:string; size:number; }

function getWord() { return WORDS[Math.floor(Math.random() * WORDS.length)]; }

export default function GamePage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wordRef = useRef("swift");
  const animRef = useRef<number>(0);

  const g = useRef({
    trainX: -600, charX: 0, groundY: 0,
    speed: 28, bgOff1: 0, bgOff2: 0, groundOff: 0,
    charAnim: 0, charBounce: 0,
    particles: [] as Particle[],
    shake: 0, shakeX: 0, shakeY: 0,
    started: false, over: false, score: 0, streak: 0,
    stars: [] as {x:number;y:number;r:number;phase:number}[],
    buildings1: [] as {x:number;h:number;w:number}[],
    buildings2: [] as {x:number;h:number;w:number}[],
    initialized: false,
  });

  const [word, setWord] = useState("swift");
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [danger, setDanger] = useState(0);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  // Randomize first word on client only (avoids hydration mismatch)
  useEffect(() => {
    const w = getWord();
    wordRef.current = w;
    setWord(w);
  }, []);

  const spawnParticles = (x: number, y: number) => {
    const colors = ["#00ffaa","#7c3aed","#ff6b6b","#ffd93d","#6bceff","#ff6ef7"];
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const speed = rnd(60, 200);
      g.current.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        life: 1, maxLife: 1,
        color: colors[i % colors.length],
        size: rnd(2, 5),
      });
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      g.current.charX = canvas.width * 0.38;
      g.current.groundY = canvas.height * 0.74;
      // Train starts ~1 full screen width behind character
      if (!g.current.started) {
        g.current.trainX = -(canvas.width * 0.7 + 130);
      }

      if (!g.current.initialized) {
        g.current.initialized = true;
        // Stars
        for (let i = 0; i < 80; i++) {
          g.current.stars.push({ x: rnd(0,canvas.width), y: rnd(0, canvas.height*0.65), r: rnd(0.5,2), phase: rnd(0,Math.PI*2) });
        }
        // Buildings far
        for (let i = 0; i < 30; i++) {
          g.current.buildings1.push({ x: i * 50, h: rnd(40,100), w: rnd(30,50) });
        }
        // Buildings near
        for (let i = 0; i < 20; i++) {
          g.current.buildings2.push({ x: i * 70, h: rnd(20,70), w: rnd(40,65) });
        }
      }
    };
    resize();
    window.addEventListener("resize", resize);

    let last = 0;

    const drawSky = (W: number, H: number, t: number) => {
      const sky = ctx.createLinearGradient(0,0,0,H*0.74);
      sky.addColorStop(0,"#04000d");
      sky.addColorStop(0.5,"#0c0020");
      sky.addColorStop(1,"#18003a");
      ctx.fillStyle = sky;
      ctx.fillRect(0,0,W,H*0.74);
    };

    const drawStars = (W: number, H: number, t: number) => {
      for (const s of g.current.stars) {
        const alpha = 0.3 + 0.5 * Math.sin(t*0.8 + s.phase);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const drawBuildings = (W:number, H:number, buildings:{x:number;h:number;w:number}[], color:string, groundFrac:number, scrollSpeed:number, off:number) => {
      const gY = H * groundFrac;
      ctx.fillStyle = color;
      for (const b of buildings) {
        const bx = ((b.x - off) % (W + 80) + W + 80) % (W + 80) - 40;
        ctx.fillRect(bx, gY - b.h, b.w, b.h);
        // windows
        ctx.fillStyle = "rgba(255,220,80,0.15)";
        for (let wy = gY - b.h + 6; wy < gY - 4; wy += 10) {
          for (let wx = bx + 4; wx < bx + b.w - 6; wx += 9) {
            if ((Math.floor(wy/10) + Math.floor(wx/9)) % 3 !== 0) ctx.fillRect(wx, wy, 5, 6);
          }
        }
        ctx.fillStyle = color;
      }
    };

    const drawGround = (W:number, H:number, off:number) => {
      const gY = H * 0.74;
      // Ground fill
      const grd = ctx.createLinearGradient(0, gY, 0, H);
      grd.addColorStop(0, "#0c0030");
      grd.addColorStop(1, "#040010");
      ctx.fillStyle = grd;
      ctx.fillRect(0, gY, W, H - gY);

      // Neon grid — horizontal
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 6; i++) {
        const y = gY + (H - gY) * (i/6)**1.8;
        const alpha = 0.15 + (i/6)*0.25;
        ctx.strokeStyle = `rgba(124,58,237,${alpha})`;
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
      }

      // Neon grid — vertical (perspective)
      const vCount = 14;
      const vSpacing = W / vCount;
      for (let i = 0; i <= vCount; i++) {
        const xTop = (i * vSpacing - off % vSpacing);
        const xBot = W/2 + (xTop - W/2) * 0.12;
        const alpha = 0.1 + 0.2 * Math.abs(Math.sin(i));
        ctx.strokeStyle = `rgba(124,58,237,${alpha})`;
        ctx.beginPath(); ctx.moveTo(xTop, gY); ctx.lineTo(xBot, H); ctx.stroke();
      }

      // Glowing horizon line
      ctx.shadowColor = "#7c3aed";
      ctx.shadowBlur = 12;
      ctx.strokeStyle = "#7c3aed";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, gY); ctx.lineTo(W, gY); ctx.stroke();
      ctx.shadowBlur = 0;
    };

    const drawTrain = (x:number, gY:number) => {
      const W = 130, H = 60;
      const y = gY - H;

      // Headlight beam
      const beam = ctx.createLinearGradient(x+W, y+H/2, x+W+120, y+H/2);
      beam.addColorStop(0, "rgba(255,200,50,0.25)");
      beam.addColorStop(1, "rgba(255,200,50,0)");
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(x+W, y+5);
      ctx.lineTo(x+W+110, y+H/2-30);
      ctx.lineTo(x+W+110, y+H/2+30);
      ctx.closePath();
      ctx.fill();

      // Body shadow/glow
      ctx.shadowColor = "#ff2200";
      ctx.shadowBlur = 25;

      // Main body
      const bodyGrad = ctx.createLinearGradient(x, y, x, y+H);
      bodyGrad.addColorStop(0, "#1a0800");
      bodyGrad.addColorStop(0.5, "#220a00");
      bodyGrad.addColorStop(1, "#0a0400");
      ctx.fillStyle = bodyGrad;
      ctx.roundRect(x, y, W, H, 4);
      ctx.fill();

      // Red stripes
      ctx.fillStyle = "#cc2200";
      ctx.fillRect(x, y+8, W, 5);
      ctx.fillRect(x, y+H-13, W, 5);

      // Windows (orange-red glow)
      ctx.fillStyle = "rgba(255,80,0,0.35)";
      for (let i = 0; i < 3; i++) ctx.fillRect(x+8+i*32, y+15, 24, 18);

      // Front face
      ctx.fillStyle = "#1a0800";
      ctx.fillRect(x+W-14, y, 14, H);
      ctx.fillStyle = "#ff2200";
      ctx.fillRect(x+W-14, y, 3, H);

      // Headlights
      ctx.shadowColor = "#ffcc00";
      ctx.shadowBlur = 20;
      ctx.fillStyle = "#ffdd44";
      ctx.fillRect(x+W-10, y+12, 8, 10);
      ctx.fillRect(x+W-10, y+H-22, 8, 10);

      // Wheels
      ctx.shadowColor = "#ff4400";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#111";
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(x+18+i*42, y+H+4, 8, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = "#ff4400";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    };

    const drawChar = (x:number, gY:number, t:number) => {
      const bounce = Math.sin(t*10)*3;
      const leg = Math.sin(t*10);
      const arm = Math.cos(t*10);

      ctx.shadowColor = "#00ffaa";
      ctx.shadowBlur = 15;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Head
      ctx.fillStyle = "#00ffaa";
      ctx.beginPath();
      ctx.arc(x, gY-48+bounce, 8, 0, Math.PI*2);
      ctx.fill();

      // Body
      ctx.strokeStyle = "#00ffaa";
      ctx.beginPath(); ctx.moveTo(x, gY-40+bounce); ctx.lineTo(x, gY-20+bounce); ctx.stroke();

      // Arms
      ctx.beginPath(); ctx.moveTo(x, gY-34+bounce); ctx.lineTo(x-12*arm, gY-24+bounce); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, gY-34+bounce); ctx.lineTo(x+12*arm, gY-24+bounce); ctx.stroke();

      // Legs
      ctx.beginPath(); ctx.moveTo(x, gY-20+bounce); ctx.lineTo(x-10*leg, gY+bounce); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, gY-20+bounce); ctx.lineTo(x+10*leg, gY+bounce); ctx.stroke();

      // Glow halo
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = "#00ffaa";
      ctx.beginPath();
      ctx.arc(x, gY-34+bounce, 18, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    };

    const drawParticles = (dt:number) => {
      g.current.particles = g.current.particles.filter(p => p.life > 0);
      for (const p of g.current.particles) {
        p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 300*dt; p.life -= dt*1.8;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size*(0.5+p.life*0.5), 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    };

    const loop = (ts:number) => {
      const dt = Math.min((ts - last)/1000, 0.05);
      last = ts;
      const st = g.current;
      const W = canvas.width, H = canvas.height;

      if (st.started && !st.over) {
        st.trainX += st.speed * dt;
        st.speed = Math.min(220, st.speed + dt*4);
        st.bgOff1 += 20*dt;
        st.bgOff2 += 70*dt;
        st.groundOff += 180*dt;
        st.charAnim += dt;
        if (st.shake > 0) {
          st.shake -= dt*4;
          st.shakeX = (Math.random()-0.5)*st.shake*10;
          st.shakeY = (Math.random()-0.5)*st.shake*5;
        } else { st.shakeX=0; st.shakeY=0; }

        const gap = st.charX - (st.trainX + 130);
        const d = Math.max(0, Math.min(100, 100 - (gap / (st.charX*0.6))*100));
        setDanger(Math.round(d));
        if (gap <= 0) { st.over = true; setGameOver(true); }
      }

      ctx.clearRect(0,0,W,H);
      ctx.save();
      ctx.translate(st.shakeX, st.shakeY);

      drawSky(W,H,ts/1000);
      drawStars(W,H,ts/1000);
      drawBuildings(W,H,st.buildings1,"#12083a",0.58, 20, st.bgOff1);
      drawBuildings(W,H,st.buildings2,"#0a0520",0.68, 70, st.bgOff2);
      drawGround(W,H,st.groundOff);

      if (st.trainX + 130 > -50) drawTrain(st.trainX, st.groundY);
      drawChar(st.charX, st.groundY, st.charAnim);
      drawParticles(dt);

      // Danger red vignette
      const gap2 = st.charX - (st.trainX+130);
      if (st.started && !st.over && gap2 < W*0.2) {
        const intensity = (1 - gap2/(W*0.2))*0.35;
        const vigGrad = ctx.createRadialGradient(W/2,H/2,H*0.3,W/2,H/2,H);
        vigGrad.addColorStop(0,"rgba(255,0,0,0)");
        vigGrad.addColorStop(1,`rgba(255,0,0,${intensity})`);
        ctx.fillStyle = vigGrad;
        ctx.fillRect(0,0,W,H);
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener("resize", resize); };
  }, []);

  const handleInput = (val: string) => {
    if (gameOver) return;
    if (!g.current.started) { g.current.started=true; setStarted(true); }
    setInput(val);

    if (val.toLowerCase() === wordRef.current.toLowerCase()) {
      const gl = g.current;
      const pushBack = wordRef.current.length * 20 + gl.streak * 5;
      gl.trainX -= pushBack;
      spawnParticles(gl.charX, gl.groundY - 40);
      gl.score += wordRef.current.length*10 + gl.streak*8;
      gl.streak += 1;
      setScore(gl.score);
      setStreak(gl.streak);
      const nw = getWord();
      wordRef.current = nw;
      setWord(nw);
      setInput("");
    } else {
      // Wrong char shake
      if (val.length > 0 && val[val.length-1] !== wordRef.current[val.length-1]) {
        g.current.shake = Math.min(g.current.shake + 0.4, 1.2);
      }
    }
  };

  const reset = () => {
    const gl = g.current;
    const W = canvasRef.current?.width ?? 400;
    gl.trainX = -(W * 0.7 + 130); gl.speed=28; gl.bgOff1=0; gl.bgOff2=0; gl.groundOff=0;
    gl.charAnim=0; gl.particles=[]; gl.shake=0; gl.shakeX=0; gl.shakeY=0;
    gl.started=false; gl.over=false; gl.score=0; gl.streak=0;
    const nw = getWord(); wordRef.current=nw;
    setWord(nw); setInput(""); setScore(0); setStreak(0);
    setGameOver(false); setStarted(false); setDanger(0);
  };

  const dangerColor = danger>70?"#ff4444":danger>40?"#ffaa00":"#00ffaa";

  return (
    <div className="h-dvh flex flex-col select-none overflow-hidden" style={{ background:"#04000d" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-1 shrink-0" style={{ zIndex:10 }}>
        <button onClick={() => router.push("/")} className="active:opacity-60 transition-opacity" style={{color:"#4a5568",fontSize:14}}>
          ← LOBBY
        </button>
        <div className="flex items-center gap-4">
          {streak >= 3 && <span className="text-xs font-bold" style={{color:"#ffd93d"}}>🔥 {streak}x STREAK</span>}
          <div className="text-right">
            <div className="font-bold text-lg glow-green" style={{color:"#00ffaa"}}>{score.toLocaleString()}</div>
            <div className="text-[10px]" style={{color:"#4a5568"}}>SCORE</div>
          </div>
        </div>
      </div>

      {/* Danger bar */}
      <div className="px-4 py-1 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{color:"#4a5568"}}>🚂</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.06)"}}>
            <div className="h-full rounded-full transition-all duration-200" style={{width:`${danger}%`,background:dangerColor,boxShadow:`0 0 8px ${dangerColor}`}} />
          </div>
          <span className="text-[10px] font-bold w-16 text-right" style={{color:dangerColor}}>
            {danger>70?"⚠ RUN!":danger>40?"FASTER!":"SAFE"}
          </span>
        </div>
      </div>

      {/* Game canvas */}
      <div className="flex-1 relative overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full block" />

        {!started && !gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{background:"rgba(0,0,0,0.5)",backdropFilter:"blur(4px)"}}>
            <div className="text-5xl mb-3 float">🏃</div>
            <div className="text-white font-bold text-xl mb-1 tracking-widest">OUTRUN THE TRAIN</div>
            <div className="mb-8 text-sm" style={{color:"#4a5568"}}>Type fast. Stay alive.</div>
            <div className="px-4 py-2 rounded-xl text-xs tracking-widest animate-pulse"
              style={{border:"1px solid rgba(0,255,170,0.4)",color:"#00ffaa"}}
              onClick={() => inputRef.current?.focus()}>
              TAP TO START
            </div>
          </div>
        )}

        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center slide-up" style={{background:"rgba(0,0,0,0.75)",backdropFilter:"blur(6px)"}}>
            <div className="text-6xl mb-3">💥</div>
            <div className="font-bold text-2xl mb-1 tracking-widest glow-red" style={{color:"#ff4444"}}>CAUGHT!</div>
            <div className="text-4xl font-bold mb-1 glow-green" style={{color:"#00ffaa"}}>{score.toLocaleString()}</div>
            <div className="text-sm mb-6" style={{color:"#4a5568"}}>STREAK: {streak}x</div>
            <button onClick={reset} className="px-10 py-3.5 rounded-2xl font-bold tracking-widest text-black active:scale-95 transition-transform"
              style={{background:"linear-gradient(135deg,#00ffaa,#00cc88)",boxShadow:"0 0 30px rgba(0,255,170,0.4)"}}>
              TRY AGAIN
            </button>
          </div>
        )}
      </div>

      {/* Word + Input */}
      {!gameOver && (
        <div className="px-4 pb-4 pt-3 safe-bottom shrink-0">
          <div className="text-center mb-3">
            <div className="text-3xl font-bold tracking-[0.25em]">
              {word.split("").map((ch, i) => {
                const typed = input[i];
                const color = typed===undefined ? "rgba(255,255,255,0.85)" : typed===ch ? "#00ffaa" : "#ff4444";
                const shadow = typed===ch ? "0 0 10px #00ffaa88" : typed!==undefined ? "0 0 10px #ff444488" : "none";
                return <span key={i} style={{color,textShadow:shadow,transition:"color 0.1s"}}>{ch}</span>;
              })}
            </div>
          </div>
          <input
            ref={inputRef}
            value={input}
            onChange={e => handleInput(e.target.value)}
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="type to run..."
            className="w-full rounded-2xl px-5 py-4 text-white text-base outline-none text-center tracking-widest"
            style={{
              background:"rgba(255,255,255,0.05)",
              border:"1px solid rgba(255,255,255,0.1)",
              fontSize:16,
            }}
            onFocus={e => e.currentTarget.style.borderColor="rgba(0,255,170,0.4)"}
            onBlur={e => e.currentTarget.style.borderColor="rgba(255,255,255,0.1)"}
          />
        </div>
      )}
    </div>
  );
}
