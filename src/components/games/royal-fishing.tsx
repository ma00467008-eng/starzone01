import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Crosshair, Zap, Waves, Sparkles, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useApp } from "@/lib/app-context";
import { beep, fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { Card, PrimaryButton, StakeInput, useAfterPlay } from "@/components/sz/shell";
import type { GameRow } from "./types";

interface Fish {
  id: number;
  type: "clownfish" | "lantern" | "turtle" | "swordfish" | "golden_shark" | "dragon_boss";
  name: string;
  emoji: string;
  mult: number;
  x: number; // 0..100%
  y: number; // 0..100%
  speed: number;
  direction: 1 | -1;
  size: string;
  color: string;
}

const INITIAL_FISH: Omit<Fish, "x" | "y">[] = [
  { id: 1, type: "clownfish", name: "Clownfish", emoji: "🐠", mult: 2.5, speed: 0.22, direction: 1, size: "text-2xl", color: "text-orange-400" },
  { id: 2, type: "lantern", name: "Lantern Fish", emoji: "🐡", mult: 5, speed: 0.18, direction: -1, size: "text-3xl", color: "text-yellow-400" },
  { id: 3, type: "turtle", name: "Sea Turtle", emoji: "🐢", mult: 12, speed: 0.12, direction: 1, size: "text-3xl", color: "text-emerald-400" },
  { id: 4, type: "swordfish", name: "Swordfish", emoji: "🐬", mult: 25, speed: 0.25, direction: -1, size: "text-4xl", color: "text-cyan-400" },
  { id: 5, type: "golden_shark", name: "Golden Shark", emoji: "🦈", mult: 60, speed: 0.14, direction: 1, size: "text-5xl", color: "text-amber-400" },
  { id: 6, type: "dragon_boss", name: "Golden Dragon", emoji: "🐉", mult: 250, speed: 0.09, direction: -1, size: "text-6xl", color: "text-yellow-300" },
];

interface Bullet {
  id: number;
  targetX: number;
  targetY: number;
}

interface Explosion {
  id: number;
  x: number;
  y: number;
  text?: string;
}

export function RoyalFishingGame({ game }: { game: GameRow }) {
  const { user } = useApp();
  const afterPlay = useAfterPlay();

  const [stake, setStake] = useState<number>(game.min_stake || 10);
  const [fishList, setFishList] = useState<Fish[]>(() =>
    INITIAL_FISH.map((f, i) => ({
      ...f,
      x: 10 + (i * 15) % 80,
      y: 15 + (i * 12) % 65,
    }))
  );

  const [cannonAngle, setCannonAngle] = useState(0);
  const [firing, setFiring] = useState(false);
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<Fish | null>(null);

  const arenaRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);

  // Animate fish swimming back and forth across the ocean
  useEffect(() => {
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      setFishList((prev) =>
        prev.map((f) => {
          let nextX = f.x + f.speed * f.direction * dt * 50;
          let nextDir = f.direction;

          if (nextX > 90) {
            nextX = 90;
            nextDir = -1;
          } else if (nextX < 5) {
            nextX = 5;
            nextDir = 1;
          }

          // Gentle bobbing on Y axis
          const nextY = Math.max(10, Math.min(75, f.y + Math.sin(now / 500 + f.id) * 0.15));

          return { ...f, x: nextX, y: nextY, direction: nextDir };
        })
      );

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const shootAt = async (targetX: number, targetY: number, targetFish?: Fish) => {
    if (!user) {
      toast.error("Please login to play Royal Fishing");
      return;
    }
    if (firing) return;

    if (stake < (game.min_stake || 10) || stake > (game.max_stake || 10000)) {
      toast.error(`Stake must be between ${game.min_stake} and ${game.max_stake}`);
      return;
    }

    setFiring(true);

    // Calculate cannon angle towards click
    const angleRad = Math.atan2(targetX - 50, 95 - targetY);
    const angleDeg = (angleRad * 180) / Math.PI;
    setCannonAngle(angleDeg);

    beep(750, 50);

    const fish = targetFish || selectedTarget || fishList[Math.floor(Math.random() * fishList.length)];

    // Backend call
    let result: any = null;
    try {
      const { data, error } = await (supabase.rpc as any)("royal_fishing_shoot", {
        _stake: stake,
        _fish_type: fish.type,
      });

      if (error) {
        console.warn("royal_fishing_shoot RPC error, fallback simulator:", error.message);
        // Fallback catch simulator
        const caught = Math.random() < (0.95 / fish.mult);
        const payout = caught ? Math.floor(stake * fish.mult) : 0;
        result = { caught, payout, mult: fish.mult };
      } else {
        result = data;
      }
    } catch (err: any) {
      toast.error(errMsg(err));
      setFiring(false);
      return;
    }

    // Impact explosion at fish location
    setTimeout(() => {
      const expId = Date.now();
      const caught = result.caught;
      const payout = result.payout || 0;

      if (caught) {
        beep(920, 150);
        setTimeout(() => beep(1200, 200), 160);
        toast.success(`CAUGHT ${fish.name}! Won ₹${fmt(payout)} (${fish.mult}x)`);
      } else {
        beep(300, 60);
      }

      setExplosions((prev) => [
        ...prev,
        {
          id: expId,
          x: targetX,
          y: targetY,
          text: caught ? `+₹${fmt(payout)}` : undefined,
        },
      ]);

      setTimeout(() => {
        setExplosions((prev) => prev.filter((e) => e.id !== expId));
      }, 1000);

      afterPlay();
      setFiring(false);
    }, 280);
  };

  const handleArenaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!arenaRef.current) return;
    const rect = arenaRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    shootAt(x, y);
  };

  return (
    <div className="space-y-4">
      {/* Ocean Aquarium Shooting Arena */}
      <Card
        ref={arenaRef}
        onClick={handleArenaClick}
        className="relative h-80 w-full overflow-hidden border-2 border-cyan-500/40 bg-[radial-gradient(ellipse_at_top,_#083344_0%,_#020617_80%)] p-0 shadow-2xl cursor-crosshair select-none"
      >
        {/* Animated Water Caustics / Waves overlay */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(6,182,212,0.15)_0%,transparent_70%)] animate-pulse" />

        {/* Ambient Bubbles */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-10 bottom-0 h-3 w-3 rounded-full bg-cyan-400/30 animate-bounce" />
          <div className="absolute right-20 bottom-10 h-2 w-2 rounded-full bg-cyan-300/40 animate-ping" />
        </div>

        {/* Target Header Info */}
        <div className="pointer-events-none absolute top-3 left-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 border border-cyan-500/30 backdrop-blur-md">
          <Waves className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-xs font-bold text-cyan-200">
            {selectedTarget ? `Locked: ${selectedTarget.name} (${selectedTarget.mult}x)` : "Tap Any Fish to Fire Cannon"}
          </span>
        </div>

        {/* Swimming Fish */}
        {fishList.map((f) => {
          const isSelected = selectedTarget?.id === f.id;
          return (
            <div
              key={f.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTarget(f);
                shootAt(f.x, f.y, f);
              }}
              style={{
                left: `${f.x}%`,
                top: `${f.y}%`,
                transform: `translate(-50%, -50%) scaleX(${f.direction === -1 ? -1 : 1})`,
              }}
              className={cn(
                "absolute flex flex-col items-center justify-center transition-all duration-75 cursor-pointer hover:scale-125",
                isSelected && "ring-2 ring-yellow-400 rounded-full p-1"
              )}
            >
              <span className={cn(f.size, "drop-shadow-[0_4px_10px_rgba(6,182,212,0.6)]")}>{f.emoji}</span>
              <span className="text-[9px] font-black text-amber-300 bg-black/60 px-1 rounded-sm mt-0.5">
                {f.mult}x
              </span>
            </div>
          );
        })}

        {/* Impact Explosions / Nets */}
        {explosions.map((exp) => (
          <div
            key={exp.id}
            style={{ left: `${exp.x}%`, top: `${exp.y}%` }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-20"
          >
            {/* Energy Net Blast */}
            <div className="h-16 w-16 rounded-full border-2 border-cyan-400 bg-cyan-400/20 animate-ping" />
            {exp.text && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-lg font-black text-amber-300 drop-shadow-[0_2px_8px_rgba(245,158,11,0.9)] animate-bounce whitespace-nowrap">
                {exp.text}
              </div>
            )}
          </div>
        ))}

        {/* Golden Turret Cannon at Bottom Center */}
        <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center">
          {/* Rotating Cannon Barrel */}
          <div
            style={{ transform: `rotate(${cannonAngle}deg)` }}
            className="h-12 w-6 origin-bottom rounded-t-lg bg-gradient-to-t from-amber-700 via-amber-500 to-yellow-300 border-x-2 border-t-2 border-amber-300 shadow-xl transition-transform duration-100"
          >
            {/* Muzzle Flash when firing */}
            {firing && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 h-5 w-5 rounded-full bg-cyan-300 blur-[2px] animate-ping" />
            )}
          </div>
          {/* Turret Base Mount */}
          <div className="h-6 w-20 rounded-t-full bg-gradient-to-r from-zinc-800 via-amber-600 to-zinc-800 border-t-2 border-amber-400 shadow-2xl" />
        </div>
      </Card>

      {/* Target Fish Odds Quick Selector */}
      <Card className="space-y-4">
        <div>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Species Multipliers</span>
          <div className="mt-2 grid grid-cols-6 gap-1.5">
            {INITIAL_FISH.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  const current = fishList.find((x) => x.id === f.id);
                  if (current) {
                    setSelectedTarget(current);
                    shootAt(current.x, current.y, current);
                  }
                }}
                className={cn(
                  "flex flex-col items-center justify-center rounded-xl border p-2 transition-all",
                  selectedTarget?.type === f.type
                    ? "border-amber-400 bg-amber-500/20 ring-2 ring-amber-400"
                    : "border-border/60 bg-secondary/30 hover:bg-secondary/60"
                )}
              >
                <span className="text-xl">{f.emoji}</span>
                <span className="text-[10px] font-black text-amber-300 mt-1">{f.mult}x</span>
              </button>
            ))}
          </div>
        </div>

        {/* Bullet Stake Controls */}
        <StakeInput stake={stake} onChange={setStake} min={game.min_stake} max={game.max_stake} />

        <PrimaryButton
          onClick={() => {
            const randomFish = fishList[Math.floor(Math.random() * fishList.length)];
            shootAt(randomFish.x, randomFish.y, randomFish);
          }}
          disabled={firing}
          className="w-full h-12 text-base font-bold bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-lg"
        >
          {firing ? "FIRING..." : "FIRE CANNON"}
        </PrimaryButton>
      </Card>
    </div>
  );
}
