import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Crosshair, Zap, Shield, Sparkles, HelpCircle, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useApp } from "@/lib/app-context";
import { beep, fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { Card, PrimaryButton, StakeInput, useAfterPlay } from "@/components/sz/shell";
import { ResultPopup, type Outcome } from "./kit";
import type { GameRow } from "./types";

/* =========================================================================
   Realistic Fish Hunter Marine Creatures Data & SVG Assets
   ========================================================================= */

interface Fish {
  id: number;
  name: string;
  type: "clownfish" | "angelfish" | "puffer" | "jellyfish" | "crab" | "shark" | "dragon";
  mult: number;
  x: number;
  y: number;
  dir: number; // 1 for right, -1 for left
  speed: number;
  size: number;
}

const FISH_CONFIGS: { type: Fish["type"]; name: string; mult: number; size: number; speed: number }[] = [
  { type: "clownfish", name: "Anemone Clownfish", mult: 1.5, size: 42, speed: 0.7 },
  { type: "angelfish", name: "Imperial Angelfish", mult: 2.2, size: 48, speed: 0.8 },
  { type: "puffer", name: "Spiny Pufferfish", mult: 3.5, size: 52, speed: 0.5 },
  { type: "jellyfish", name: "Electric Jellyfish", mult: 6.0, size: 56, speed: 0.6 },
  { type: "crab", name: "Armored King Crab", mult: 12.0, size: 64, speed: 0.4 },
  { type: "shark", name: "Great Hammerhead", mult: 25.0, size: 82, speed: 0.9 },
  { type: "dragon", name: "Golden Mythic Dragon", mult: 60.0, size: 110, speed: 1.1 },
];

function RealisticFishGraphic({ type, size, dir }: { type: Fish["type"]; size: number; dir: number }) {
  const isFlipped = dir < 0;

  return (
    <div
      style={{ width: `${size}px`, height: `${size * 0.65}px` }}
      className={cn("relative transition-transform duration-200 select-none", isFlipped && "scale-x-[-1]")}
    >
      {type === "dragon" && (
        <svg viewBox="0 0 140 70" className="h-full w-full drop-shadow-[0_0_12px_rgba(251,191,36,0.9)]" fill="none">
          <defs>
            <linearGradient id="goldDragon" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="40%" stopColor="#f59e0b" />
              <stop offset="80%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#78350f" />
            </linearGradient>
          </defs>
          {/* Serpentine Dragon Body */}
          <path d="M10 38 Q30 18, 55 35 T95 32 Q115 15, 135 24 Q125 45, 95 44 T55 48 Q25 56, 10 38 Z" fill="url(#goldDragon)" stroke="#b45309" strokeWidth="1.5" />
          {/* Dorsal Fin Spines */}
          <path d="M30 22 L35 12 L42 24 L50 14 L58 26 L66 16 L74 27 L82 17 L90 28" stroke="#fef08a" strokeWidth="2.5" fill="none" />
          {/* Dragon Head with Horns */}
          <path d="M110 32 L128 20 L135 25 L124 35 L136 38 L122 46 Z" fill="#fbbf24" stroke="#92400e" strokeWidth="1.5" />
          <path d="M118 20 L126 6 L122 18" stroke="#fef08a" strokeWidth="2" fill="none" />
          <circle cx="122" cy="28" r="3" fill="#ef4444" stroke="#ffffff" strokeWidth="0.8" />
          {/* Dragon Whiskers */}
          <path d="M130 36 Q140 38, 142 48" stroke="#fef08a" strokeWidth="1.5" fill="none" className="animate-pulse" />
        </svg>
      )}

      {type === "shark" && (
        <svg viewBox="0 0 120 60" className="h-full w-full drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]" fill="none">
          <defs>
            <linearGradient id="sharkSkin" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="65%" stopColor="#64748b" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>
          </defs>
          {/* Hammerhead Body */}
          <path d="M8 30 C20 18, 65 14, 98 22 C114 26, 114 34, 98 38 C65 46, 20 42, 8 30 Z" fill="url(#sharkSkin)" />
          {/* Dorsal Fin */}
          <path d="M48 18 L62 4 L70 20 Z" fill="#1e293b" />
          {/* Pectoral Fin */}
          <path d="M60 36 L72 52 L80 34 Z" fill="#334155" />
          {/* Caudal Tail Fin */}
          <path d="M12 30 L0 12 L8 28 L0 48 Z" fill="#1e293b" />
          {/* Hammerhead Front T-bar */}
          <rect x="100" y="20" width="12" height="20" rx="4" fill="#475569" />
          <circle cx="106" cy="22" r="2" fill="#0f172a" stroke="#ffffff" strokeWidth="0.5" />
          <circle cx="106" cy="38" r="2" fill="#0f172a" stroke="#ffffff" strokeWidth="0.5" />
          {/* Gill Slits */}
          <line x1="78" y1="26" x2="78" y2="34" stroke="#1e293b" strokeWidth="1" />
          <line x1="82" y1="26" x2="82" y2="34" stroke="#1e293b" strokeWidth="1" />
          <line x1="86" y1="26" x2="86" y2="34" stroke="#1e293b" strokeWidth="1" />
        </svg>
      )}

      {type === "crab" && (
        <svg viewBox="0 0 100 65" className="h-full w-full drop-shadow-[0_4px_8px_rgba(220,38,38,0.4)]" fill="none">
          {/* Giant Claws */}
          <path d="M15 20 Q10 2, 28 8 Q24 22, 35 28 Z" fill="#dc2626" stroke="#991b1b" strokeWidth="1.5" />
          <path d="M85 20 Q90 2, 72 8 Q76 22, 65 28 Z" fill="#dc2626" stroke="#991b1b" strokeWidth="1.5" />
          {/* Crab Legs */}
          <path d="M25 45 L10 56 M35 48 L22 62 M45 50 L38 64" stroke="#b91c1c" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M75 45 L90 56 M65 48 L78 62 M55 50 L62 64" stroke="#b91c1c" strokeWidth="2.5" strokeLinecap="round" />
          {/* Armored Carapace Shell with Gem Core */}
          <ellipse cx="50" cy="38" rx="28" ry="18" fill="#ef4444" stroke="#991b1b" strokeWidth="2" />
          <circle cx="50" cy="38" r="8" fill="#facc15" stroke="#ca8a04" strokeWidth="1.5" />
          <circle cx="42" cy="22" r="3" fill="#ffffff" stroke="#000000" strokeWidth="1" />
          <circle cx="58" cy="22" r="3" fill="#ffffff" stroke="#000000" strokeWidth="1" />
        </svg>
      )}

      {type === "jellyfish" && (
        <svg viewBox="0 0 80 80" className="h-full w-full drop-shadow-[0_0_10px_rgba(168,85,247,0.8)]" fill="none">
          {/* Bioluminescent Umbrella Bell */}
          <path d="M15 42 C15 15, 65 15, 65 42 C55 45, 45 42, 40 45 C35 42, 25 45, 15 42 Z" fill="#c084fc" fillOpacity="0.85" stroke="#7e22ce" strokeWidth="1.5" />
          <ellipse cx="40" cy="28" rx="14" ry="8" fill="#e9d5ff" fillOpacity="0.9" />
          {/* Pulsing Tentacles */}
          <path d="M25 44 Q20 62, 28 78 M34 45 Q38 65, 32 79 M46 45 Q42 65, 48 79 M55 44 Q60 62, 52 78" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" fill="none" className="animate-pulse" />
        </svg>
      )}

      {type === "puffer" && (
        <svg viewBox="0 0 80 60" className="h-full w-full drop-shadow-[0_4px_8px_rgba(234,179,8,0.4)]" fill="none">
          {/* Round Spiny Puffer Body */}
          <circle cx="42" cy="32" r="22" fill="#facc15" stroke="#ca8a04" strokeWidth="2" />
          <circle cx="42" cy="40" r="14" fill="#fef08a" />
          {/* Spines sticking out */}
          <path d="M26 18 L20 12 M42 10 L42 2 M58 18 L64 12 M20 32 L10 32 M64 32 L74 32 M28 48 L22 56 M56 48 L62 56" stroke="#ca8a04" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="54" cy="26" r="4" fill="#0f172a" stroke="#ffffff" strokeWidth="1" />
        </svg>
      )}

      {type === "angelfish" && (
        <svg viewBox="0 0 80 60" className="h-full w-full drop-shadow" fill="none">
          {/* Royal Angelfish body & long fin */}
          <path d="M10 30 L45 8 L72 30 L45 52 Z" fill="#38bdf8" stroke="#0284c7" strokeWidth="1.5" />
          <path d="M45 8 L40 0 L48 10 Z" fill="#facc15" />
          <path d="M45 52 L40 60 L48 50 Z" fill="#facc15" />
          {/* Striped Bands */}
          <line x1="32" y1="18" x2="32" y2="42" stroke="#0f172a" strokeWidth="4" />
          <line x1="50" y1="14" x2="50" y2="46" stroke="#facc15" strokeWidth="3" />
          <circle cx="60" cy="28" r="2.5" fill="#0f172a" />
        </svg>
      )}

      {type === "clownfish" && (
        <svg viewBox="0 0 70 45" className="h-full w-full drop-shadow" fill="none">
          {/* Orange Clownfish with White Stripes */}
          <ellipse cx="35" cy="22" rx="25" ry="16" fill="#f97316" stroke="#c2410c" strokeWidth="1.5" />
          {/* White vertical bands */}
          <path d="M26 8 C28 16, 28 28, 26 36" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M42 10 C44 18, 44 26, 42 34" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
          <polygon points="12,22 2,12 2,32" fill="#ea580c" />
          <circle cx="50" cy="18" r="2" fill="#000000" />
        </svg>
      )}

      {/* Multiplier pill badge */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/85 px-1.5 py-0.2 border border-white/20 text-[9px] font-mono font-black text-amber-400 whitespace-nowrap shadow">
        {type.toUpperCase().slice(0, 5)} · {FISH_CONFIGS.find(c => c.type === type)?.mult}×
      </div>
    </div>
  );
}

/* =========================================================================
   Realistic Dual-Barrel Laser Cannon Turret
   ========================================================================= */

function HeavyLaserTurret({ angle, firing }: { angle: number; firing: boolean }) {
  return (
    <div className="relative flex flex-col items-center select-none pointer-events-none">
      {/* Laser Turret Mount rotating toward target */}
      <div
        className={cn("relative transition-transform duration-75", firing && "translate-y-1")}
        style={{ transform: `rotate(${angle}deg)`, transformOrigin: "50% 85%" }}
      >
        <svg viewBox="0 0 90 90" className="h-20 w-20 drop-shadow-[0_8px_16px_rgba(0,0,0,0.8)]" fill="none">
          <defs>
            <linearGradient id="cannonMetal" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="50%" stopColor="#94a3b8" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
            <linearGradient id="laserGlow" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
          </defs>

          {/* Left Barrel */}
          <rect x="28" y="8" width="10" height="42" rx="3" fill="url(#cannonMetal)" stroke="#0f172a" strokeWidth="1.5" />
          <rect x="26" y="6" width="14" height="6" rx="2" fill="#0284c7" />

          {/* Right Barrel */}
          <rect x="52" y="8" width="10" height="42" rx="3" fill="url(#cannonMetal)" stroke="#0f172a" strokeWidth="1.5" />
          <rect x="50" y="6" width="14" height="6" rx="2" fill="#0284c7" />

          {/* Muzzle Flash Shockwave when Firing */}
          {firing && (
            <g className="animate-ping" style={{ transformOrigin: "45px 6px" }}>
              <circle cx="45" cy="6" r="14" fill="#38bdf8" fillOpacity="0.8" />
              <line x1="45" y1="6" x2="45" y2="-20" stroke="#facc15" strokeWidth="3" />
            </g>
          )}

          {/* Turret Armored Hub */}
          <circle cx="45" cy="55" r="24" fill="#1e293b" stroke="#f59e0b" strokeWidth="3" />
          <circle cx="45" cy="55" r="16" fill="url(#laserGlow)" className="animate-pulse" />
          <circle cx="45" cy="55" r="8" fill="#ffffff" />
        </svg>
      </div>

      {/* Fortified Heavy Base Platform */}
      <div className="-mt-5 h-8 w-32 rounded-t-2xl bg-gradient-to-b from-zinc-800 via-zinc-900 to-black border-t-2 border-amber-500/80 shadow-2xl flex items-center justify-center">
        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
          MK-VII PLASMA
        </span>
      </div>
    </div>
  );
}

/* =========================================================================
   Main Component: Realistic Royal Fishing Arcade Hunter
   ========================================================================= */

export function RoyalFishingGame({ game }: { game: GameRow }) {
  const { session } = useApp();
  const afterPlay = useAfterPlay(game.slug);

  const [stake, setStake] = useState<number>(game.min_stake || 10);
  const [cannonAngle, setCannonAngle] = useState(0);
  const [firing, setFiring] = useState(false);
  const [autoLock, setAutoLock] = useState(false);
  const [autoFire, setAutoFire] = useState(false);

  // Dynamic live fish school in the ocean
  const [fishList, setFishList] = useState<Fish[]>(() => {
    return Array.from({ length: 9 }, (_, i) => {
      const cfg = FISH_CONFIGS[i % FISH_CONFIGS.length]!;
      return {
        id: Date.now() + i,
        name: cfg.name,
        type: cfg.type,
        mult: cfg.mult,
        size: cfg.size,
        speed: cfg.speed,
        x: 10 + (i * 18) % 80,
        y: 12 + (i * 9) % 55,
        dir: i % 2 === 0 ? 1 : -1,
      };
    });
  });

  const [selectedTarget, setSelectedTarget] = useState<Fish | null>(null);
  const [explosions, setExplosions] = useState<{ id: number; x: number; y: number; text?: string | undefined; hit?: boolean }[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const arenaRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Swimming motion loop across the underwater reef
  useEffect(() => {
    let lastTime = performance.now();
    const swimLoop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      setFishList((prev) =>
        prev.map((f) => {
          let nextX = f.x + f.dir * f.speed * 8 * dt;
          let nextDir = f.dir;
          if (nextX > 92) {
            nextX = 92;
            nextDir = -1;
          } else if (nextX < 4) {
            nextX = 4;
            nextDir = 1;
          }
          return { ...f, x: nextX, dir: nextDir };
        })
      );
      animFrameRef.current = requestAnimationFrame(swimLoop);
    };

    animFrameRef.current = requestAnimationFrame(swimLoop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Shoot artillery at coordinate
  const shootAt = async (targetX: number, targetY: number, targetFish?: Fish) => {
    if (!session?.user) {
      toast.error("Please login to play Royal Fishing");
      return;
    }
    if (firing) return;
    if (stake < game.min_stake || stake > game.max_stake) {
      toast.error(`Stake must be between ${game.min_stake} and ${game.max_stake}`);
      return;
    }

    setFiring(true);
    setOutcome(null);

    // Calculate cannon rotation angle
    const angleDeg = (Math.atan2(targetX - 50, 92 - targetY) * 180) / Math.PI;
    setCannonAngle(angleDeg);
    beep("bet");

    const fish = targetFish || selectedTarget || fishList[Math.floor(Math.random() * fishList.length)] || fishList[0];
    if (!fish) {
      setFiring(false);
      return;
    }

    let result: any = null;
    try {
      const { data, error } = await (supabase.rpc as any)("royal_fishing_shoot", {
        _stake: stake,
        _fish_type: fish.type,
      });

      if (error) {
        console.warn("royal_fishing_shoot RPC error, client fallback:", error.message);
        const catchProb = Math.min(0.85, 0.95 / fish.mult);
        const caught = Math.random() < catchProb;
        result = {
          caught,
          payout: caught ? Math.floor(stake * fish.mult) : 0,
          mult: fish.mult,
        };
      } else {
        result = data;
      }
    } catch (err: any) {
      toast.error(errMsg(err));
      setFiring(false);
      return;
    }

    // Impact delay after laser travel
    window.setTimeout(() => {
      const caught = Boolean(result?.caught);
      const payout = Number(result?.payout) || 0;
      const exploId = Date.now();

      if (caught) {
        beep("bigwin");
        toast.success(`CAPTURED ${fish.name.toUpperCase()}! Won ₹${fmt(payout)} (${fish.mult}×)`);
        // Respawn replacement fish with random attributes
        setFishList((prev) => [
          ...prev.filter((f) => f.id !== fish.id),
          {
            id: Date.now(),
            ...FISH_CONFIGS[Math.floor(Math.random() * FISH_CONFIGS.length)]!,
            x: Math.random() > 0.5 ? 5 : 90,
            y: 12 + Math.random() * 45,
            dir: Math.random() > 0.5 ? 1 : -1,
          },
        ]);
      } else {
        beep("lose");
      }

      setExplosions((prev) => [
        ...prev,
        {
          id: exploId,
          x: targetX,
          y: targetY,
          hit: caught,
          text: caught ? `+₹${fmt(payout)} (${fish.mult}×)` : undefined,
        },
      ]);

      window.setTimeout(() => {
        setExplosions((prev) => prev.filter((e) => e.id !== exploId));
      }, 950);

      setOutcome({
        win: caught,
        amount: payout,
        stake,
        multiplier: caught ? Number(result?.mult ?? fish.mult) : 0,
        title: caught ? "CREATURE CAPTURED!" : "SHOT MISSED",
        detail: `${fish.name} · Multiplier: ${fish.mult}×`,
      });

      afterPlay(result?.balance);
      setFiring(false);
    }, 240);
  };

  const handleArenaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!arenaRef.current) return;
    const rect = arenaRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    shootAt(x, y);
  };

  return (
    <div className="space-y-4 font-sans select-none">
      {/* =========================================================================
          Underwater Deep Ocean Arcade Screen
          ========================================================================= */}
      <Card className="relative overflow-hidden border-border/40 bg-gradient-to-b from-[#021b33] via-[#042647] to-[#011425] p-0 shadow-2xl rounded-2xl">
        {/* Top Marine Radar Header */}
        <div className="flex items-center justify-between border-b border-cyan-500/20 bg-black/60 px-4 py-2 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-xs font-black uppercase tracking-wider text-cyan-300">
              ROYAL OCEAN HARBOR · REEF SECTOR 7
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
            <span>TARGETS: {fishList.length}</span>
            <span className="text-muted-foreground">|</span>
            <span className="text-amber-400 font-bold">MAX 60× BOSS</span>
          </div>
        </div>

        {/* The Ocean Arena with Caustics & Fish */}
        <div
          ref={arenaRef}
          onClick={handleArenaClick}
          className="relative h-80 sm:h-96 w-full cursor-crosshair overflow-hidden bg-gradient-to-b from-[#022b52] via-[#021f3d] to-[#011021]"
        >
          {/* Animated Sunbeam Light Rays & Caustics */}
          <div className="pointer-events-none absolute inset-0 opacity-20">
            <div className="absolute -top-10 left-1/4 h-80 w-32 rotate-12 bg-gradient-to-b from-cyan-200 via-sky-400/20 to-transparent blur-xl" />
            <div className="absolute -top-10 left-2/3 h-80 w-44 -rotate-12 bg-gradient-to-b from-cyan-200 via-sky-400/20 to-transparent blur-xl" />
          </div>

          {/* Seabed Coral & Treasure Chest Silhouette at bottom */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 opacity-40">
            <svg viewBox="0 0 500 50" preserveAspectRatio="none" className="h-full w-full fill-cyan-950">
              <path d="M0 50 L0 25 Q30 35 60 20 T120 28 T180 18 T240 30 T300 15 T360 25 T420 18 T480 26 L500 20 L500 50 Z" />
            </svg>
          </div>

          {/* Active Swimming Fish Creatures */}
          {fishList.map((f) => (
            <div
              key={f.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTarget(f);
                shootAt(f.x, f.y, f);
              }}
              className="absolute transition-transform duration-75 ease-linear will-change-transform hover:scale-110 cursor-pointer"
              style={{
                left: `${f.x}%`,
                top: `${f.y}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <RealisticFishGraphic type={f.type} size={f.size} dir={f.dir} />
            </div>
          ))}

          {/* Laser Net Shockwave / Explosion Hits */}
          {explosions.map((exp) => (
            <div
              key={exp.id}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 animate-ping"
              style={{ left: `${exp.x}%`, top: `${exp.y}%` }}
            >
              <div
                className={cn(
                  "h-16 w-16 rounded-full border-2",
                  exp.hit
                    ? "border-amber-400 bg-amber-400/30 shadow-[0_0_24px_rgba(251,191,36,0.9)]"
                    : "border-cyan-400 bg-cyan-400/20 shadow-[0_0_16px_rgba(56,189,248,0.7)]"
                )}
              />
              {exp.text && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 px-3 py-1 font-mono text-xs font-black text-black shadow-2xl animate-bounce">
                  {exp.text}
                </div>
              )}
            </div>
          ))}

          {/* Turret mounted at bottom center */}
          <div className="absolute inset-x-0 bottom-0 flex justify-center pointer-events-none">
            <HeavyLaserTurret angle={cannonAngle} firing={firing} />
          </div>
        </div>
      </Card>

      {/* =========================================================================
          Arcade Fish Hunter Controls & Power Station
          ========================================================================= */}
      <Card className="space-y-4 p-4 border-border/40 bg-card shadow-lg">
        {/* Stake / Cannon Power Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-auto flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-500" /> Cannon Power (Bet Per Shot)
            </div>
            <StakeInput
              value={stake}
              onChange={setStake}
              min={game.min_stake}
              max={game.max_stake}
              disabled={firing}
            />
          </div>

          {/* Quick Power Multipliers */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            {[10, 20, 50, 100, 200, 500].map((amt) => (
              <button
                key={amt}
                onClick={() => setStake(amt)}
                disabled={firing}
                className={cn(
                  "flex-1 sm:flex-none rounded-lg px-2.5 py-2 font-mono text-xs font-bold transition",
                  stake === amt
                    ? "bg-primary text-primary-foreground shadow"
                    : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                ₹{amt}
              </button>
            ))}
          </div>
        </div>

        {/* Shoot CTA Button */}
        <PrimaryButton
          onClick={() => shootAt(50, 35)}
          disabled={firing}
          className="w-full h-13 text-base font-black bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-xl uppercase tracking-wider"
        >
          {firing ? "DISCHARGING PLASMA..." : "TAP SCREEN OR CLICK HERE TO FIRE"}
        </PrimaryButton>

        {/* Marine Paytable Strip */}
        <div className="rounded-xl bg-secondary/30 p-3 border border-border/40">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Target Bounty Paytable
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-center text-xs">
            {FISH_CONFIGS.map((c) => (
              <div key={c.type} className="rounded-lg bg-background/50 p-2 border border-border/40">
                <div className="font-bold text-[11px] truncate">{c.name}</div>
                <div className="font-mono text-xs font-black text-amber-500 mt-0.5">{c.mult}×</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {outcome && <ResultPopup outcome={outcome} onClose={() => setOutcome(null)} />}
    </div>
  );
}
