import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Flame, Trophy, ShieldCheck, Sparkles, Wind, Gauge, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp, errMsg } from "@/lib/app-context";
import { beep, fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { Card, PrimaryButton, StakeInput, useAfterPlay } from "@/components/sz/shell";
import type { GameRow } from "./types";

/* =========================================================================
   Realistic Olympic Competition Javelin & Athletic Arena
   ========================================================================= */

function JavelinArena({
  phase,
  progress,
  mult,
  crashed,
  windSpeed,
}: {
  phase: "countdown" | "flying" | "crashed";
  progress: number;
  mult: number;
  crashed: boolean;
  windSpeed: string;
}) {
  // Angle of javelin: ascending 35deg at start, leveling to 12deg, plunging -68deg when hitting turf
  const angle = crashed ? -68 : Math.max(12, 38 - progress * 26);

  // Position across the stadium: X from 12% to 84%, Y from 75% down to 22%
  const posX = crashed ? Math.min(86, 18 + progress * 68) : 12 + Math.min(1, progress) * 72;
  const posY = crashed ? 78 : Math.max(20, 75 - Math.sin(Math.min(1, progress) * Math.PI * 0.88) * 54);

  return (
    <div className="relative h-72 sm:h-80 w-full overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-[#031526] via-[#061e1a] to-[#041a0d] shadow-2xl select-none">
      {/* Stadium Floodlights & Sky Glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-8 top-0 h-48 w-36 -rotate-12 bg-gradient-to-b from-amber-100/25 via-emerald-400/10 to-transparent blur-lg" />
        <div className="absolute right-8 top-0 h-48 w-36 rotate-12 bg-gradient-to-b from-amber-100/25 via-emerald-400/10 to-transparent blur-lg" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-sky-400/10 to-transparent" />

        {/* Stadium Grandstand Crowd Silhouette */}
        <div className="absolute inset-x-0 bottom-20 h-14 opacity-25">
          <svg viewBox="0 0 500 40" preserveAspectRatio="none" className="h-full w-full fill-slate-700">
            <path d="M0 40 L0 18 Q25 22 50 16 T100 20 T150 15 T200 19 T250 14 T300 18 T350 15 T400 19 T450 16 T500 18 L500 40 Z" />
          </svg>
        </div>

        {/* Olympic Tartan Track & Grass Turf Infield */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-emerald-950 via-emerald-900 to-emerald-800/90 border-t-2 border-emerald-500/40">
          {/* Distance marking arc lines */}
          <div className="absolute inset-0 flex justify-around items-end pb-1.5 text-[11px] font-mono font-bold text-emerald-300/50 uppercase tracking-widest">
            <span>20m</span>
            <span>40m</span>
            <span>60m</span>
            <span>80m</span>
            <span>100m</span>
            <span>120m</span>
          </div>
          {/* Official Sector White Boundary Arcs */}
          <div className="absolute left-4 top-2 h-0.5 w-32 bg-white/40 rounded" />
          <div className="absolute left-12 bottom-4 h-0.5 w-24 bg-amber-400/50 rounded" />
        </div>
      </div>

      {/* Flight trajectory arc trace */}
      {phase !== "countdown" && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="javelinTrail" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
              <stop offset="60%" stopColor="#facc15" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.95" />
            </linearGradient>
          </defs>
          <path
            d={`M 12 75 Q ${posX * 0.45} ${posY * 0.6}, ${posX} ${posY}`}
            fill="none"
            stroke="url(#javelinTrail)"
            strokeWidth="3"
            strokeDasharray="5 5"
            className="animate-pulse"
          />
        </svg>
      )}

      {/* Center Real-Time Multiplier Display */}
      <div className="absolute inset-x-0 top-6 flex flex-col items-center justify-center text-center">
        {phase === "countdown" ? (
          <div className="rounded-full bg-slate-950/80 px-5 py-2 backdrop-blur border border-white/10 shadow-2xl">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              OLYMPIC THROW IN
            </span>
            <div className="font-mono text-2xl sm:text-3xl font-black text-amber-400 mt-0.5">
              PREPARING
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <span
              className={cn(
                "font-mono text-5xl sm:text-6xl font-black tracking-tight drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)] transition-colors",
                crashed ? "text-red-500 animate-bounce" : "text-emerald-400"
              )}
            >
              {mult.toFixed(2)}×
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-300 mt-1">
              {crashed ? "Landed on Turf" : "In Flight"}
            </span>
          </div>
        )}
      </div>

      {/* Live Stadium Wind Telemetry HUD */}
      <div className="absolute top-4 left-4 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 border border-white/10 text-xs font-mono text-emerald-300 backdrop-blur-sm">
        <Wind className="h-3.5 w-3.5 text-emerald-400" />
        <span>WIND: {windSpeed}</span>
      </div>

      {/* Realistic Competition Javelin Spear Flying */}
      {phase !== "countdown" && (
        <div
          className="absolute pointer-events-none transition-all duration-75 ease-linear will-change-transform"
          style={{
            left: `${posX}%`,
            top: `${posY}%`,
            transform: `translate(-50%, -50%) rotate(${angle}deg)`,
          }}
        >
          {/* Carbon Fiber Competition Javelin with Titanium Tip */}
          <div className="relative flex items-center">
            {/* Speed trail glow */}
            <div className="h-1 w-14 bg-gradient-to-r from-transparent to-amber-400/80 blur-[1px]" />
            <svg viewBox="0 0 140 24" className="h-6 w-32 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]" fill="none">
              <defs>
                <linearGradient id="javelinShaft" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#475569" />
                  <stop offset="35%" stopColor="#e2e8f0" />
                  <stop offset="70%" stopColor="#0f172a" />
                  <stop offset="100%" stopColor="#f8fafc" />
                </linearGradient>
              </defs>
              {/* Shaft */}
              <line x1="8" y1="12" x2="128" y2="12" stroke="url(#javelinShaft)" strokeWidth="3" strokeLinecap="round" />
              {/* Cord Grip at center of gravity */}
              <rect x="62" y="10" width="22" height="4" rx="1" fill="#ea580c" stroke="#c2410c" strokeWidth="0.5" />
              {/* Titanium Spearhead Tip */}
              <polygon points="128,10 138,12 128,14" fill="#f8fafc" stroke="#94a3b8" strokeWidth="0.8" />
              {/* Tail Cap */}
              <circle cx="8" cy="12" r="1.5" fill="#334155" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   Main Component: Realistic Javelin Olympic Crash Game
   ========================================================================= */

export function JavelinGame({ game }: { game: GameRow }) {
  const { session } = useApp();
  const afterPlay = useAfterPlay(game.slug);

  const [stake, setStake] = useState<number>(game.min_stake || 10);
  const [autoCashout, setAutoCashout] = useState<string>("2.00");
  const [phase, setPhase] = useState<"countdown" | "flying" | "crashed">("countdown");
  const [progress, setProgress] = useState(0);
  const [mult, setMult] = useState(1.0);
  const [inRound, setInRound] = useState(false);
  const [cashedOut, setCashedOut] = useState(false);
  const [cashedOutMult, setCashedOutMult] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pastThrows, setPastThrows] = useState<number[]>([2.14, 1.45, 8.20, 1.12, 3.85, 12.40, 1.88]);

  const animRef = useRef<number | null>(null);
  const roundStartRef = useRef<number>(0);
  const crashPointRef = useRef<number>(2.0);

  // Auto round cycle when not in player round
  useEffect(() => {
    let t: NodeJS.Timeout;
    if (phase === "countdown") {
      t = setTimeout(() => {
        startRound();
      }, 3500);
    }
    return () => clearTimeout(t);
  }, [phase]);

  const startRound = async () => {
    setPhase("flying");
    setProgress(0);
    setMult(1.0);
    setCashedOut(false);
    setCashedOutMult(null);
    roundStartRef.current = performance.now();

    // Call Supabase RPC if player bet
    let finalTarget = 1.05 + Math.random() * 3.5;
    if (inRound && session?.user) {
      try {
        const { data, error } = await (supabase.rpc as any)("javelin_start", {
          _stake: stake,
          _auto: autoCashout ? Number(autoCashout) : null,
        });
        if (error) {
          console.warn("javelin_start RPC error, simulator mode:", error.message);
        } else {
          setSessionId((data as any)?.session);
          afterPlay((data as any)?.balance);
        }
      } catch (e: any) {
        toast.error(errMsg(e));
      }
    }

    crashPointRef.current = finalTarget;
    beep("bet");

    const duration = 6500;
    const step = (now: number) => {
      const elapsed = (now - roundStartRef.current) / 1000;
      const currentMult = Math.floor(Math.exp(0.18 * elapsed) * 100) / 100;
      const p = Math.min(1, elapsed / (duration / 1000));

      setProgress(p);
      setMult(currentMult);

      // Auto cashout check
      const autoVal = autoCashout ? Number(autoCashout) : 0;
      if (inRound && !cashedOut && autoVal > 1 && currentMult >= autoVal) {
        handleCashout(currentMult);
      }

      if (currentMult >= crashPointRef.current || p >= 1) {
        // Crashed
        setPhase("crashed");
        beep("explode");
        setPastThrows((prev) => [currentMult, ...prev.slice(0, 12)]);
        if (inRound && !cashedOut) {
          toast.error(`Landed at ${currentMult.toFixed(2)}×! Bet Lost`);
        }
        setInRound(false);

        // Reset to countdown after 2.8s
        setTimeout(() => {
          setPhase("countdown");
        }, 2800);
      } else {
        animRef.current = requestAnimationFrame(step);
      }
    };

    animRef.current = requestAnimationFrame(step);
  };

  const handleCashout = async (cashMult?: number) => {
    if (!inRound || cashedOut || phase !== "flying") return;
    const finalMult = cashMult || mult;
    setCashedOut(true);
    setCashedOutMult(finalMult);
    beep("bigwin");

    const wonAmount = Math.floor(stake * finalMult);
    toast.success(`CASHOUT SUCCESSFUL! Won ₹${fmt(wonAmount)} (${finalMult.toFixed(2)}×)`);

    // Settle in Supabase
    if (sessionId) {
      try {
        const { data } = await (supabase.rpc as any)("javelin_cashout", {
          _session_id: sessionId,
          _mult: finalMult,
        });
        if (data?.balance !== undefined) afterPlay(data.balance);
      } catch { /* ignore */ }
    }
  };

  const handlePlaceBet = () => {
    if (!session?.user) {
      toast.error("Please login to place bets");
      return;
    }
    if (stake < game.min_stake || stake > game.max_stake) {
      toast.error(`Stake must be between ${game.min_stake} and ${game.max_stake}`);
      return;
    }
    setInRound(true);
    toast.success(`Bet of ₹${fmt(stake)} placed for next throw!`);
  };

  return (
    <div className="space-y-4 font-sans select-none">
      {/* Top Past Multipliers History Pill Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl bg-black/60 px-3 py-2 border border-border/40 backdrop-blur-sm">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0 flex items-center gap-1">
          <Trophy className="h-3 w-3 text-amber-400" /> Recent
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {pastThrows.map((pt, idx) => (
            <span
              key={idx}
              className={cn(
                "rounded-full px-2 py-0.5 font-mono text-[11px] font-bold transition shadow-sm",
                pt >= 10
                  ? "bg-gradient-to-r from-red-600 to-amber-500 text-white"
                  : pt >= 2
                  ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40"
                  : "bg-blue-600/20 text-blue-300 border border-blue-500/30"
              )}
            >
              {pt.toFixed(2)}×
            </span>
          ))}
        </div>
      </div>

      {/* Stadium Arena Display */}
      <JavelinArena
        phase={phase}
        progress={progress}
        mult={mult}
        crashed={phase === "crashed"}
        windSpeed="+1.4 m/s"
      />

      {/* Betting & Cashout Controller */}
      <Card className="space-y-4 p-4 border-border/40 bg-card shadow-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Stake Input */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
              Bet Amount
            </label>
            <StakeInput
              value={stake}
              onChange={setStake}
              min={game.min_stake}
              max={game.max_stake}
              disabled={inRound && phase === "flying"}
            />
          </div>

          {/* Auto Cashout Multiplier */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
              Auto Cashout (e.g. 2.00×)
            </label>
            <input
              type="number"
              step="0.1"
              min="1.1"
              value={autoCashout}
              onChange={(e) => setAutoCashout(e.target.value)}
              disabled={inRound && phase === "flying"}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-mono font-bold"
              placeholder="e.g. 2.00"
            />
          </div>
        </div>

        {/* Quick Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {[10, 50, 100, 500, 1000].map((amt) => (
            <button
              key={amt}
              onClick={() => setStake(amt)}
              disabled={inRound && phase === "flying"}
              className="rounded-lg bg-secondary/60 px-2.5 py-1 text-xs font-mono font-bold text-muted-foreground hover:bg-secondary hover:text-foreground transition shrink-0"
            >
              +{amt}
            </button>
          ))}
          <button
            onClick={() => setStake((s) => Math.floor(s * 2))}
            disabled={inRound && phase === "flying"}
            className="rounded-lg bg-secondary/80 px-2.5 py-1 text-xs font-mono font-bold text-foreground hover:bg-secondary transition shrink-0"
          >
            2X
          </button>
          <button
            onClick={() => setStake((s) => Math.max(game.min_stake, Math.floor(s / 2)))}
            disabled={inRound && phase === "flying"}
            className="rounded-lg bg-secondary/80 px-2.5 py-1 text-xs font-mono font-bold text-foreground hover:bg-secondary transition shrink-0"
          >
            1/2
          </button>
        </div>

        {/* Dual-State CTA: Bet or Cashout */}
        {inRound && phase === "flying" && !cashedOut ? (
          <PrimaryButton
            onClick={() => handleCashout()}
            className="w-full h-14 text-lg font-black bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-black shadow-2xl animate-pulse"
          >
            CASHOUT ₹{fmt(Math.floor(stake * mult))} ({mult.toFixed(2)}×)
          </PrimaryButton>
        ) : (
          <PrimaryButton
            onClick={handlePlaceBet}
            disabled={inRound}
            className="w-full h-14 text-base font-black bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-xl"
          >
            {inRound ? "BET QUEUED FOR THROW..." : "PLACE BET"}
          </PrimaryButton>
        )}
      </Card>
    </div>
  );
}
