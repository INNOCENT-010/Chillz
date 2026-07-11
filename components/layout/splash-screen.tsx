"use client";
import Image from "next/image";
import { useEffect, useState } from "react";

function ChillzIcon({ size = 130 }: { size?: number }) {
  return (
    <Image
      src="/chillz-icon.png"
      alt="Chillz"
      width={size}
      height={size}
      priority
      style={{ borderRadius: size * 0.22, display: "block" }}
    />
  );
}

// ── PERSON SILHOUETTE ─────────────────────────────────────────────────────
function Person({
  x, swayDeg, armAngle, cupSide, scaleY = 1,
  color = "#1a0040",
}: {
  x: number; swayDeg: number; armAngle: number;
  cupSide: "left"|"right"|"both"; scaleY?: number; color?: string;
}) {
  return (
    <g transform={`translate(${x},0) rotate(${swayDeg},0,10) scale(1,${scaleY})`}>
      {/* Body */}
      <rect x="-13" y="-48" width="26" height="52" rx="10" fill={color} />
      {/* Head */}
      <circle cx="0" cy="-62" r="16" fill={color} />
      {/* Left arm */}
      {(cupSide === "left" || cupSide === "both") && (
        <>
          <path
            d={`M -13,-28 C -30,-38 ${-38 - armAngle},-58 ${-42 - armAngle},-70`}
            stroke={color} strokeWidth="10" strokeLinecap="round" fill="none"
          />
          {/* Cup */}
          <rect
            x={-49 - armAngle} y="-82"
            width="13" height="16" rx="3"
            fill="#22C55E"
          />
        </>
      )}
      {/* Right arm */}
      {(cupSide === "right" || cupSide === "both") && (
        <>
          <path
            d={`M 13,-28 C 30,-38 ${38 + armAngle},-58 ${42 + armAngle},-70`}
            stroke={color} strokeWidth="10" strokeLinecap="round" fill="none"
          />
          {/* Cup */}
          <rect
            x={36 + armAngle} y="-82"
            width="13" height="16" rx="3"
            fill="#6B21D4"
          />
        </>
      )}
      {/* Legs */}
      <path d="M -7,4 L -11,42" stroke={color} strokeWidth="11" strokeLinecap="round" />
      <path d="M 7,4 L 11,42" stroke={color} strokeWidth="11" strokeLinecap="round" />
    </g>
  );
}

const PEOPLE = [
  { x:-230, cupSide:"left"  as const, scale:0.80, color:"#0d001e" },
  { x:-168, cupSide:"both"  as const, scale:0.92, color:"#130030" },
  { x:-104, cupSide:"right" as const, scale:1.05, color:"#090018" },
  { x: -42, cupSide:"both"  as const, scale:0.88, color:"#160040" },
  { x:  42, cupSide:"left"  as const, scale:1.00, color:"#0d001e" },
  { x: 104, cupSide:"both"  as const, scale:1.10, color:"#110028" },
  { x: 168, cupSide:"right" as const, scale:0.86, color:"#0a001a" },
  { x: 230, cupSide:"both"  as const, scale:0.94, color:"#150038" },
];

export function SplashScreen() {
  const [phase, setPhase] = useState<"hidden"|"scene"|"icon"|"wordmark"|"tagline"|"exit"|"done">("hidden");
  const [sway, setSway] = useState(0);
  const [noteY, setNoteY] = useState(0);
  const [beam, setBeam] = useState(0);

  useEffect(() => {
    if (sessionStorage.getItem("chillz_splash_shown")) {
      setPhase("done");
      return;
    }
    sessionStorage.setItem("chillz_splash_shown", "1");

    const t0 = setTimeout(() => setPhase("scene"),    60);
    const t1 = setTimeout(() => setPhase("icon"),     500);
    const t2 = setTimeout(() => setPhase("wordmark"), 1500);
    const t3 = setTimeout(() => setPhase("tagline"),  2100);
    const t4 = setTimeout(() => setPhase("exit"),     3600);
    const t5 = setTimeout(() => setPhase("done"),     4400);
    return () => [t0,t1,t2,t3,t4,t5].forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (phase === "done") return;
    let f = 0;
    const id = setInterval(() => {
      f += 0.055;
      setSway(Math.sin(f) * 5);
      setNoteY(v => (v + 1.4) % 130);
      setBeam(Math.sin(f * 0.65) * 14);
    }, 16);
    return () => clearInterval(id);
  }, [phase]);

  if (phase === "done") return null;

  const iconOn     = ["icon","wordmark","tagline","exit"].includes(phase);
  const wordmarkOn = ["wordmark","tagline","exit"].includes(phase);
  const taglineOn  = ["tagline","exit"].includes(phase);
  const exiting    = phase === "exit";

  return (
    <>
      <style>{`
        .csp-root {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100%;
          height: 100dvh;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: radial-gradient(ellipse at 50% 28%, #3D0880 0%, #1C0048 42%, #070012 100%);
          overflow: hidden;
        }
        .csp-root.out { animation: csp-out 0.8s ease-in forwards; }

        @keyframes csp-out { to { opacity:0; } }

        @keyframes csp-icon-in {
          0%   { opacity:0; transform:scale(0.15) rotate(-15deg); }
          58%  { opacity:1; transform:scale(1.13) rotate(3deg); }
          74%  { transform:scale(0.92) rotate(-1deg); }
          88%  { transform:scale(1.05); }
          100% { opacity:1; transform:scale(1) rotate(0deg); }
        }
        @keyframes csp-up {
          from { opacity:0; transform:translateY(22px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes csp-tag {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:0.65; transform:translateY(0); }
        }
        @keyframes csp-glow {
          0%   { transform:translate(-50%,-50%) scale(0.4); opacity:0.9; }
          100% { transform:translate(-50%,-50%) scale(3.2); opacity:0; }
        }
        @keyframes csp-scene-in {
          from { opacity:0; transform:translateY(30px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes csp-confetti-drop {
          0%   { opacity:1; transform:translateY(0) rotate(0deg) scale(1); }
          100% { opacity:0; transform:translateY(160px) rotate(600deg) scale(0.4); }
        }

        .csp-icon {
          opacity:0;
          transform:scale(0.15) rotate(-15deg);
          filter: drop-shadow(0 12px 40px rgba(34,197,94,0.5));
        }
        .csp-icon.on { animation:csp-icon-in 1s cubic-bezier(0.22,1.4,0.36,1) forwards; }

        .csp-glow {
          position:absolute;
          width:180px; height:180px;
          border-radius:50%;
          background:radial-gradient(circle, rgba(34,197,94,0.65) 0%, rgba(107,33,212,0.25) 55%, transparent 70%);
          top:50%; left:50%;
          transform:translate(-50%,-50%) scale(0.4);
          opacity:0;
          pointer-events:none;
        }
        .csp-glow.on { animation:csp-glow 1.8s ease-out 0.65s forwards; }

        .csp-word { opacity:0; transform:translateY(22px); }
        .csp-word.on { animation:csp-up 0.55s cubic-bezier(0.22,1,0.36,1) forwards; }

        .csp-tag { opacity:0; }
        .csp-tag.on { animation:csp-tag 0.5s ease-out forwards; }

        .csp-scene {
          opacity:0;
          animation:csp-scene-in 0.7s ease-out 0.1s forwards;
        }

        .csp-confetti {
          animation: csp-confetti-drop 1.3s ease-in forwards;
          opacity:0;
        }
      `}</style>

      <div className={`csp-root${exiting ? " out" : ""}`}>

        {/* Stage beams */}
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}
          viewBox="0 0 480 900" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="b1" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(107,33,212,0.4)"/>
              <stop offset="100%" stopColor="rgba(107,33,212,0)"/>
            </linearGradient>
            <linearGradient id="b2" x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="rgba(34,197,94,0.3)"/>
              <stop offset="100%" stopColor="rgba(34,197,94,0)"/>
            </linearGradient>
            <linearGradient id="b3" x1="50%" y1="100%" x2="50%" y2="0%">
              <stop offset="0%" stopColor="rgba(168,85,247,0.22)"/>
              <stop offset="100%" stopColor="rgba(168,85,247,0)"/>
            </linearGradient>
          </defs>
          <polygon points={`0,900 110,900 ${230+beam*2.5},180`} fill="url(#b1)" transform={`rotate(${beam*0.4},55,900)`}/>
          <polygon points={`480,900 370,900 ${250-beam*2.5},180`} fill="url(#b2)" transform={`rotate(${-beam*0.4},425,900)`}/>
          <polygon points={`190,900 290,900 ${240+beam*0.8},260`} fill="url(#b3)"/>
        </svg>

        {/* Music notes */}
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}
          viewBox="0 0 480 900" preserveAspectRatio="xMidYMid slice">
          {[
            {x:55,  base:730, spd:1.0, sz:26, col:"rgba(34,197,94,0.75)"},
            {x:120, base:710, spd:0.75,sz:20, col:"rgba(255,255,255,0.5)"},
            {x:195, base:745, spd:1.3, sz:28, col:"rgba(107,33,212,0.85)"},
            {x:285, base:720, spd:0.9, sz:22, col:"rgba(34,197,94,0.65)"},
            {x:355, base:735, spd:1.15,sz:18, col:"rgba(255,255,255,0.45)"},
            {x:425, base:705, spd:0.8, sz:24, col:"rgba(107,33,212,0.75)"},
          ].map((n,i) => {
            const y = n.base - ((noteY*n.spd + i*22) % 130);
            const op = Math.max(0, Math.min(1,(y-280)/200));
            return <text key={i} x={n.x} y={y} fontSize={n.sz} fill={n.col} opacity={op} fontFamily="serif">{i%2?"♫":"♪"}</text>;
          })}
        </svg>

        {/* Confetti on wordmark */}
        {wordmarkOn && (
          <div style={{position:"absolute",top:"38%",left:"50%",pointerEvents:"none"}}>
            {[
              {l:-130,col:"#22C55E", w:11,h:11,r:"50%",   cls:"csp-confetti",delay:"0s"},
              {l: -80,col:"#6B21D4", w:8, h:16,r:"2px",   cls:"csp-confetti",delay:"0.05s"},
              {l: -30,col:"#FFFFFF", w:11,h:11,r:"50%",   cls:"csp-confetti",delay:"0.02s"},
              {l:  20,col:"#22C55E", w:9, h:9, r:"2px",   cls:"csp-confetti",delay:"0.08s"},
              {l:  70,col:"#A855F7", w:11,h:11,r:"50%",   cls:"csp-confetti",delay:"0.03s"},
              {l: 120,col:"#6B21D4", w:8, h:16,r:"2px",   cls:"csp-confetti",delay:"0.06s"},
              {l:-160,col:"#FFFFFF", w:9, h:9, r:"50%",   cls:"csp-confetti",delay:"0.09s"},
              {l: 150,col:"#22C55E", w:11,h:11,r:"2px",   cls:"csp-confetti",delay:"0.01s"},
              {l: -55,col:"#A855F7", w:7, h:14,r:"2px",   cls:"csp-confetti",delay:"0.07s"},
              {l:  95,col:"#FFFFFF", w:10,h:10,r:"50%",   cls:"csp-confetti",delay:"0.04s"},
            ].map((c,i) => (
              <div key={i} className={c.cls} style={{
                position:"absolute", left:c.l, top:0,
                width:c.w, height:c.h,
                backgroundColor:c.col, borderRadius:c.r,
                animationDelay:c.delay,
              }}/>
            ))}
          </div>
        )}

        {/* ── CENTER ── */}
        <div style={{
          position:"relative",
          display:"flex",
          flexDirection:"column",
          alignItems:"center",
          zIndex:10,
          flex:1,
          justifyContent:"center",
          width:"100%",
          paddingBottom:"26vh",
        }}>
          {/* Glow */}
          <div style={{position:"relative", display:"flex", alignItems:"center", justifyContent:"center"}}>
            <div className={`csp-glow${iconOn?" on":""}`}/>
            <div className={`csp-icon${iconOn?" on":""}`}>
              <ChillzIcon size={140}/>
            </div>
          </div>

          {/* Wordmark */}
          <div className={`csp-word${wordmarkOn?" on":""}`} style={{marginTop:30}}>
            <span style={{
              fontSize:44, fontWeight:900, color:"#FFFFFF",
              letterSpacing:"0.22em",
              fontFamily:"var(--font-display,Syne,sans-serif)",
              textTransform:"uppercase", lineHeight:1,
              textShadow:"0 4px 32px rgba(107,33,212,0.7), 0 0 60px rgba(34,197,94,0.2)",
            }}>
              CHILLZ
            </span>
          </div>

          {/* Tagline */}
          <div className={`csp-tag${taglineOn?" on":""}`} style={{marginTop:13}}>
            <span style={{
              fontSize:13, fontWeight:500,
              color:"rgba(255,255,255,0.65)",
              letterSpacing:"0.3em",
              textTransform:"uppercase",
            }}>
              Discover · Book · Chill
            </span>
          </div>
        </div>

        {/* ── CROWD SCENE ── */}
        <div className="csp-scene" style={{
          position:"absolute",
          bottom:0, left:0, right:0,
          height:"28vh",
          minHeight:180,
          overflow:"hidden",
        }}>
          <svg
            viewBox="-260 -170 520 195"
            preserveAspectRatio="xMidYMax meet"
            style={{width:"100%",height:"100%"}}
          >
            {/* Stage floor */}
            <rect x="-260" y="20" width="520" height="50" fill="#06000F"/>
            {/* Stage edge glow line */}
            <rect x="-260" y="18" width="520" height="5" fill="rgba(107,33,212,0.7)"/>
            <rect x="-260" y="22" width="520" height="2" fill="rgba(168,85,247,0.4)"/>

            {/* Floor reflection */}
            <defs>
              <linearGradient id="flr" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="transparent"/>
                <stop offset="25%"  stopColor="rgba(107,33,212,0.3)"/>
                <stop offset="50%"  stopColor="rgba(34,197,94,0.2)"/>
                <stop offset="75%"  stopColor="rgba(107,33,212,0.3)"/>
                <stop offset="100%" stopColor="transparent"/>
              </linearGradient>
            </defs>
            <rect x="-260" y="23" width="520" height="44" fill="url(#flr)"/>

            {/* Crowd */}
            {PEOPLE.map((p,i) => {
              const sd = sway * (i%2===0?1:-1) * 0.7;
              const aa = Math.abs(sway) * 0.5;
              return (
                <Person
                  key={i}
                  x={p.x}
                  swayDeg={sd}
                  armAngle={aa}
                  cupSide={p.cupSide}
                  scaleY={p.scale}
                  color={p.color}
                />
              );
            })}
          </svg>

          {/* Fog at feet */}
          <div style={{
            position:"absolute", bottom:0, left:0, right:0, height:"45%",
            background:"linear-gradient(to top, rgba(7,0,18,0.97) 0%, transparent 100%)",
            pointerEvents:"none",
          }}/>

          {/* Top fog blend into background */}
          <div style={{
            position:"absolute", top:0, left:0, right:0, height:"30%",
            background:"linear-gradient(to bottom, rgba(7,0,18,0.6) 0%, transparent 100%)",
            pointerEvents:"none",
          }}/>
        </div>

        {/* Bottom accent pill */}
        <div style={{
          position:"absolute", bottom:32, left:"50%",
          transform:"translateX(-50%)",
          width:52, height:4, borderRadius:999,
          background:"linear-gradient(90deg,#22C55E,#6B21D4)",
          opacity:0.75,
          zIndex:20,
        }}/>
      </div>
    </>
  );
}