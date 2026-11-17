import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Trophy, Wind, Sparkles, Zap, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { beep, fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { Card, PrimaryButton, StakeInput, useAfterPlay } from "@/components/sz/shell";
import type { GameRow } from "./types";

/* =========================================================================
   Realistic Olympic Athlete Javelin Thrower
   ========================================================================= */

function OlympicAthlete({
  state,
}: {
  state: "poised" | "runup" | "throw" | "released";
}) {
  return (
    <div className="relative flex flex-col items-center select-none transition-transform duration-200">
      <svg
        viewBox="0 0 120 120"
        className={cn(
          "h-24 w-24 sm:h-28 sm:w-28 drop-shadow-[0_8px_16px_rgba(0,0,0,0.8)] transition-all duration-300",
          state === "runup" && "translate-x-3 -rotate-6",
          state === "throw" && "translate-x-6 rotate-12 scale-105",
          state === "released" && "translate-x-8 rotate-0"
        )}
        fill="none"
      >
        <defs>
          <linearGradient id="athleteSkin" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f6d5b8" />
            <stop offset="60%" stopColor="#d49a75" />
            <stop offset="100%" stopColor="#a36340" />
          </linearGradient>
          <linearGradient id="singletGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="60%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#172554" />
          </linearGradient>
          <linearGradient id="shortsGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="100%" stopColor="#991b1b" />
          </linearGradient>
        </defs>

        {/* Dynamic Ground Shadow */}
        <ellipse cx="60" cy="114" rx="28" ry="5" fill="#000000" opacity="0.6" />

        {/* Legs with Athletic Spikes */}
        {state === "poised" && (
          <>
            {/* Left Leg */}
            <path d="M 52 74 L 46 95 L 42 112" stroke="url(#athleteSkin)" strokeWidth="7" strokeLinecap="round" />
            <path d="M 40 112 L 48 112" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
            {/* Right Leg */}
            <path d="M 64 74 L 68 95 L 72 112" stroke="url(#athleteSkin)" strokeWidth="7" strokeLinecap="round" />
            <path d="M 70 112 L 78 112" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
          </>
        )}

        {state === "runup" && (
          <>
            {/* High Knee Sprinting Legs */}
            <path d="M 52 74 L 38 88 L 32 104" stroke="url(#athleteSkin)" strokeWidth="7" strokeLinecap="round" />
            <path d="M 30 104 L 38 104" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
            <path d="M 64 74 L 78 84 L 84 98" stroke="url(#athleteSkin)" strokeWidth="7" strokeLinecap="round" />
            <path d="M 82 98 L 90 98" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
          </>
        )}

        {state === "throw" && (
          <>
            {/* Powerful Planting Front Leg & Driven Back Leg */}
            <path d="M 50 74 L 36 90 L 26 112" stroke="url(#athleteSkin)" strokeWidth="8" strokeLinecap="round" />
            <path d="M 22 112 L 32 112" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
            <path d="M 66 74 L 84 86 L 98 108" stroke="url(#athleteSkin)" strokeWidth="8" strokeLinecap="round" />
            <path d="M 96 108 L 106 108" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
          </>
        )}

        {state === "released" && (
          <>
            {/* Follow-Through Brace at Scratch Line */}
            <path d="M 52 74 L 48 94 L 44 112" stroke="url(#athleteSkin)" strokeWidth="7" strokeLinecap="round" />
            <path d="M 42 112 L 50 112" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
            <path d="M 64 74 L 76 92 L 86 110" stroke="url(#athleteSkin)" strokeWidth="7" strokeLinecap="round" />
            <path d="M 84 110 L 92 110" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
          </>
        )}

        {/* Running Shorts */}
        <path d="M 44 64 L 72 64 L 76 80 L 62 82 L 58 76 L 54 82 L 40 80 Z" fill="url(#shortsGrad)" />

        {/* Muscular Torso & Olympic National Singlet */}
        <path
          d={
            state === "throw"
              ? "M 46 36 L 72 32 L 68 66 L 46 66 Z" // Torso arched back
              : "M 48 36 L 68 36 L 66 66 L 48 66 Z"
          }
          fill="url(#singletGrad)"
          stroke="#1e293b"
          strokeWidth="1.5"
        />
        {/* Chest Gold Olympic Badge */}
        <circle cx="58" cy="46" r="3.5" fill="#facc15" stroke="#ca8a04" strokeWidth="0.8" />

        {/* Left Arm (Guidance / Balance Arm) */}
        {state === "poised" && (
          <path d="M 48 38 L 36 50 L 32 66" stroke="url(#athleteSkin)" strokeWidth="6" strokeLinecap="round" />
        )}
        {state === "runup" && (
          <path d="M 48 38 L 32 46 L 24 38" stroke="url(#athleteSkin)" strokeWidth="6" strokeLinecap="round" />
        )}
        {state === "throw" && (
          <path d="M 46 38 L 28 32 L 18 26" stroke="url(#athleteSkin)" strokeWidth="6.5" strokeLinecap="round" />
        )}
        {state === "released" && (
          <path d="M 48 38 L 30 42 L 20 54" stroke="url(#athleteSkin)" strokeWidth="6" strokeLinecap="round" />
        )}

        {/* Head & Neck */}
        <path d="M 56 36 L 56 28" stroke="url(#athleteSkin)" strokeWidth="7" strokeLinecap="round" />
        <circle cx="58" cy="20" r="11" fill="url(#athleteSkin)" stroke="#8d4925" strokeWidth="1" />
        {/* Athletic Hair & Gold Headband */}
        <path d="M 48 18 C 50 10, 68 8, 70 18 Z" fill="#1e1b4b" />
        <rect x="47" y="17" width="22" height="3" rx="1.5" fill="#facc15" />

        {/* Throwing Right Arm */}
        {state === "poised" && (
          <>
            {/* Holding spear level at ear */}
            <path d="M 68 38 L 78 28 L 84 20" stroke="url(#athleteSkin)" strokeWidth="6" strokeLinecap="round" />
            <circle cx="84" cy="20" r="4" fill="url(#athleteSkin)" />
            {/* Held Javelin Shaft in Hand */}
            <line x1="42" y1="28" x2="114" y2="12" stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" />
            <polygon points="114,12 120,10 114,14" fill="#38bdf8" />
          </>
        )}

        {state === "runup" && (
          <>
            {/* Cocked arm behind */}
            <path d="M 68 38 L 82 34 L 94 28" stroke="url(#athleteSkin)" strokeWidth="6.5" strokeLinecap="round" />
            <circle cx="94" cy="28" r="4.2" fill="url(#athleteSkin)" />
            <line x1="48" y1="36" x2="122" y2="20" stroke="#e2e8f0" strokeWidth="3.2" strokeLinecap="round" />
            <polygon points="122,20 128,18 122,22" fill="#38bdf8" />
          </>
        )}

        {state === "throw" && (
          <>
            {/* Full recoil elastic whip arm */}
            <path d="M 68 38 L 88 26 L 104 14" stroke="url(#athleteSkin)" strokeWidth="7" strokeLinecap="round" />
            <circle cx="104" cy="14" r="4.5" fill="url(#athleteSkin)" />
            <line x1="56" y1="24" x2="126" y2="6" stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" />
            <polygon points="126,6 132,4 126,8" fill="#facc15" />
          </>
        )}

        {state === "released" && (
          <>
            {/* Arm whipped forward after release */}
            <path d="M 68 38 L 86 42 L 102 34" stroke="url(#athleteSkin)" strokeWidth="6" strokeLinecap="round" />
            <circle cx="102" cy="34" r="4" fill="url(#athleteSkin)" />
          </>
        )}
      </svg>
    </div>
  );
}

/* =========================================================================
   Realistic Olympic Competition Javelin & Athletic Arena
   ========================================================================= */

function JavelinArena({
  phase,
  progress,
  mult,
  crashed,
  windSpeed,
  athleteState,
}: {
  phase: "countdown" | "flying" | "crashed";
  progress: number;
  mult: number;
  crashed: boolean;
  windSpeed: string;
  athleteState: "poised" | "runup" | "throw" | "released";
}) {
  // Flight angle calculation
  const angle = crashed ? 62 : Math.max(-12, -36 + progress * 48);

  // Flight path coordinates across the arena:
  // Starts at the athlete release point (X: 18%, Y: 68%), arches up to apex (Y: 22%), and descends
  const posX = crashed ? Math.min(88, 22 + progress * 66) : 20 + Math.min(1, progress) * 68;
  const posY = crashed ? 78 : Math.max(18, 70 - Math.sin(Math.min(1, progress) * Math.PI * 0.92) * 52);

  return (
    <div className="relative h-72 sm:h-84 w-full overflow-hidden rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-b from-[#021220] via-[#041c19] to-[#031d10] shadow-2xl select-none">
      {/* Stadium Floodlights & Ambient Glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-10 top-0 h-52 w-40 -rotate-12 bg-gradient-to-b from-amber-200/25 via-emerald-400/10 to-transparent blur-xl" />
        <div className="absolute right-10 top-0 h-52 w-40 rotate-12 bg-gradient-to-b from-amber-200/25 via-emerald-400/10 to-transparent blur-xl" />
        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-sky-400/15 via-transparent to-transparent" />

        {/* Grandstand Crowd Silhouettes */}
        <div className="absolute inset-x-0 bottom-24 h-16 opacity-30">
          <svg viewBox="0 0 500 40" preserveAspectRatio="none" className="h-full w-full fill-slate-700">
            <path d="M0 40 L0 18 Q25 22 50 16 T100 20 T150 15 T200 19 T250 14 T300 18 T350 15 T400 19 T450 16 T500 18 L500 40 Z" />
          </svg>
        </div>

        {/* Realistic Mowed Emerald Lawn with Stripes */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-emerald-950 via-emerald-900 to-emerald-800 border-t-2 border-emerald-400/50">
          {/* Mower Turf Pattern (Alternating Lighter/Darker Grass Stripes) */}
          <div className="absolute inset-0 flex opacity-20">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "flex-1 h-full",
                  i % 2 === 0 ? "bg-white/10" : "bg-black/15"
                )}
              />
            ))}
          </div>

          {/* Distance marking arc lines */}
          <div className="absolute inset-0 flex justify-around items-end pb-2 text-[11px] font-mono font-bold text-emerald-200/70 uppercase tracking-widest z-10">
            <span className="flex items-center gap-0.5">🚩 20m</span>
            <span>40m</span>
            <span>60m</span>
            <span>80m</span>
            <span className="text-amber-300 font-extrabold">🚩 100m</span>
            <span>120m</span>
          </div>

          {/* Official Sector White Boundary Arcs */}
          <div className="absolute left-28 top-3 h-0.5 w-44 bg-white/40 rounded" />
          <div className="absolute left-40 bottom-6 h-0.5 w-36 bg-amber-400/50 rounded" />
        </div>

        {/* Red Tartan Runway for Athlete */}
        <div className="absolute left-0 bottom-0 h-28 w-28 sm:w-36 bg-gradient-to-r from-red-900 via-rose-800 to-red-950 border-r-4 border-white/80 shadow-2xl flex flex-col justify-end pb-1.5 px-2">
          {/* Runway Lane Chalk Lines */}
          <div className="h-0.5 w-full bg-white/60 mb-2" />
          <div className="h-0.5 w-full bg-white/60 mb-2" />
          <div className="text-[9px] font-mono font-black uppercase text-white/60 tracking-wider">
            RUNWAY · FOUL LINE
          </div>
        </div>
      </div>

      {/* Athlete on Runway */}
      <div className="absolute left-2 bottom-7 z-20">
        <OlympicAthlete state={athleteState} />
      </div>

      {/* Aerodynamic High-Visibility Contrail Trace */}
      {phase !== "countdown" && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full z-10">
          <defs>
            <linearGradient id="javelinTrailGlow" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.1" />
              <stop offset="40%" stopColor="#38bdf8" stopOpacity="0.8" />
              <stop offset="80%" stopColor="#facc15" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="1" />
            </linearGradient>
            <filter id="glowEffect">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            d={`M 22 70 Q ${posX * 0.45} ${posY * 0.65}, ${posX} ${posY}`}
            fill="none"
            stroke="url(#javelinTrailGlow)"
            strokeWidth="4"
            filter="url(#glowEffect)"
          />
        </svg>
      )}

      {/* Big, Visible, Glowing Olympic Javelin Spear in Flight */}
      {phase !== "countdown" && (
        <div
          className="absolute pointer-events-none transition-all duration-75 ease-linear will-change-transform z-30"
          style={{
            left: `${posX}%`,
            top: `${posY}%`,
            transform: `translate(-50%, -50%) rotate(${angle}deg)`,
          }}
        >
          {/* High-Visibility Competition Javelin Spear */}
          <div className="relative flex items-center">
            {/* Speed Contrail Particle Stream */}
            <div className="h-2 w-20 bg-gradient-to-r from-transparent via-cyan-400 to-amber-300 blur-[2px] opacity-80" />

            <svg
              viewBox="0 0 180 32"
              className="h-9 w-44 sm:h-11 sm:w-52 drop-shadow-[0_0_16px_rgba(56,189,248,0.95)]"
              fill="none"
            >
              <defs>
                <linearGradient id="spearShaft" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#94a3b8" />
                  <stop offset="20%" stopColor="#f8fafc" />
                  <stop offset="50%" stopColor="#38bdf8" />
                  <stop offset="80%" stopColor="#0284c7" />
                  <stop offset="100%" stopColor="#f8fafc" />
                </linearGradient>
                <linearGradient id="tipGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#facc15" />
                </linearGradient>
              </defs>

              {/* Glowing High-Tensile Shaft */}
              <line
                x1="12"
                y1="16"
                x2="158"
                y2="16"
                stroke="url(#spearShaft)"
                strokeWidth="5"
                strokeLinecap="round"
              />

              {/* Corded Center-of-Gravity Grip */}
              <rect x="76" y="12" width="28" height="8" rx="2" fill="#ea580c" stroke="#f97316" strokeWidth="1" />
              <line x1="82" y1="12" x2="82" y2="20" stroke="#fed7aa" strokeWidth="1" />
              <line x1="88" y1="12" x2="88" y2="20" stroke="#fed7aa" strokeWidth="1" />
              <line x1="94" y1="12" x2="94" y2="20" stroke="#fed7aa" strokeWidth="1" />

              {/* High-Contrast Luminous Titanium Tip */}
              <polygon points="156,11 176,16 156,21" fill="url(#tipGlow)" stroke="#ffffff" strokeWidth="1.2" />

              {/* Tail Aerodynamic Fin */}
              <polygon points="12,12 6,16 12,20" fill="#0284c7" />
            </svg>
          </div>
        </div>
      )}

      {/* Center Dynamic Multiplier HUD */}
      <div className="absolute inset-x-0 top-6 flex flex-col items-center justify-center text-center z-40">
        {phase === "countdown" ? (
          <div className="rounded-full bg-slate-950/85 px-6 py-2.5 backdrop-blur-md border border-emerald-500/30 shadow-2xl animate-pulse">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5 justify-center">
              <Sparkles className="h-3 w-3" /> NEXT THROW PREPARING
            </span>
            <div className="font-mono text-2xl sm:text-3xl font-black text-amber-400 mt-0.5">
              GET READY
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <span
              className={cn(
                "font-mono text-5xl sm:text-6xl font-black tracking-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)] transition-colors",
                crashed ? "text-red-500 animate-bounce" : "text-emerald-300"
              )}
            >
              {mult.toFixed(2)}×
            </span>
            <span
              className={cn(
                "text-xs font-bold uppercase tracking-widest mt-1 px-3 py-0.5 rounded-full border shadow-sm",
                crashed
                  ? "bg-red-950/80 text-red-200 border-red-500/50"
                  : "bg-emerald-950/80 text-emerald-300 border-emerald-500/40"
              )}
            >
              {crashed ? "📍 Landed on Turf" : "⚡ Soaring in Air"}
            </span>
          </div>
        )}
      </div>

      {/* Stadium HUD Information */}
      <div className="absolute top-4 left-4 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 border border-white/10 text-xs font-mono text-emerald-300 backdrop-blur-sm z-30">
        <Wind className="h-3.5 w-3.5 text-cyan-400" />
        <span>WIND: {windSpeed}</span>
      </div>

      <div className="absolute top-4 right-4 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 border border-white/10 text-xs font-mono text-amber-300 backdrop-blur-sm z-30">
        <Zap className="h-3.5 w-3.5 text-amber-400" />
        <span>OLYMPIC RECORD: 98.48m</span>
      </div>
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
  const [athleteState, setAthleteState] = useState<"poised" | "runup" | "throw" | "released">("poised");
  const [progress, setProgress] = useState(0);
  const [mult, setMult] = useState(1.0);
  const [inRound, setInRound] = useState(false);
  const [nextRoundCountdown, setNextRoundCountdown] = useState<number>(10);
  const [cashedOut, setCashedOut] = useState(false);
  const [cashedOutMult, setCashedOutMult] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pastThrows, setPastThrows] = useState<number[]>([2.14, 1.45, 8.20, 1.12, 3.85, 12.40, 1.88]);

  const animRef = useRef<number | null>(null);
  const crashPointRef = useRef<number>(2.0);
  const countdownTimerRef = useRef<any>(null);

  // 10-second countdown between rounds
  useEffect(() => {
    if (phase === "countdown") {
      setNextRoundCountdown(10);
      setAthleteState("poised");

      countdownTimerRef.current = setInterval(() => {
        setNextRoundCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimerRef.current);
            handleLaunchSequence();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [phase]);

  // Clean up animation frame
  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  const handleLaunchSequence = async () => {
    // Stage 1: Athlete Run-up
    setAthleteState("runup");
    beep("bet");

    // After 600ms runup, athlete prepares the explosive throw
    setTimeout(() => {
      setAthleteState("throw");
    }, 600);

    // After 900ms, javelin releases from hand and flight begins
    setTimeout(async () => {
      setAthleteState("released");
      setPhase("flying");
      setProgress(0);
      setMult(1.0);
      setCashedOut(false);
      setCashedOutMult(null);

      // Determine crash multiplier
      let crashMult = 1.05 + Math.random() * 4.5;
      if (Math.random() < 0.15) crashMult = 8 + Math.random() * 15;
      if (Math.random() < 0.35) crashMult = 1.1 + Math.random() * 0.7;

      try {
        const { data, error } = await (supabase.rpc as any)("javelin_launch", {
          _stake: stake,
        });
        if (!error && data?.crash_point) {
          crashMult = Number(data.crash_point);
          setSessionId(data.session_id);
        }
      } catch {
        // Safe fallback
      }

      crashPointRef.current = crashMult;
      startFlightAnimation(crashMult);
    }, 950);
  };

  const startFlightAnimation = (crashPoint: number) => {
    const startTime = performance.now();
    // Duration scales with multiplier: 1.0x to 10x takes 3 to 12 seconds
    const duration = Math.min(14000, 3200 + Math.log2(crashPoint + 1) * 3000);

    const step = (now: number) => {
      const elapsed = now - startTime;
      const p = Math.min(1, elapsed / duration);

      // Exponential crash multiplier curve
      const currentMult = +(1.0 + Math.pow(p, 1.8) * (crashPoint - 1)).toFixed(2);

      setProgress(p);
      setMult(currentMult);

      // Auto cashout check
      const autoVal = autoCashout ? Number(autoCashout) : 0;
      if (inRound && !cashedOut && autoVal > 1 && currentMult >= autoVal) {
        handleCashout(currentMult);
      }

      if (currentMult >= crashPointRef.current || p >= 1) {
        // Crashed on turf
        setPhase("crashed");
        beep("explode");
        setPastThrows((prev) => [currentMult, ...prev.slice(0, 12)]);
        if (inRound && !cashedOut) {
          toast.error(`Javelin Landed at ${currentMult.toFixed(2)}×! Bet Lost`);
        }
        setInRound(false);

        // Wait 3.5 seconds on turf then start 10s countdown for next round
        setTimeout(() => {
          setPhase("countdown");
        }, 3500);
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
    toast.success(`OLYMPIC CASHOUT! Won ₹${fmt(wonAmount)} (${finalMult.toFixed(2)}×)`);

    // Settle in Supabase
    if (sessionId) {
      try {
        const { data } = await (supabase.rpc as any)("javelin_cashout", {
          _session_id: sessionId,
          _mult: finalMult,
        });
        if (data?.balance !== undefined) afterPlay(data.balance);
      } catch {
        /* ignore */
      }
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
    toast.success(`Bet of ₹${fmt(stake)} locked in for next throw!`);
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
                "rounded-full px-2.5 py-0.5 font-mono text-[11px] font-black transition shadow-sm",
                pt >= 10
                  ? "bg-gradient-to-r from-red-600 to-amber-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]"
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
        athleteState={athleteState}
      />

      {/* 10-Second Countdown Banner between Rounds */}
      {phase === "countdown" && (
        <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-emerald-950/80 px-4 py-2.5 border border-emerald-500/30 shadow-md">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              Next Throw Countdown
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Launching in</span>
            <span className="font-mono text-lg font-black text-amber-400">
              {nextRoundCountdown}s
            </span>
          </div>
        </div>
      )}

      {/* Betting & Cashout Controller */}
      <Card className="space-y-4 p-4 border-border/40 bg-card shadow-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Stake Input */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
              Bet Amount
            </label>
            <StakeInput
              min={game.min_stake}
              max={game.max_stake}
              value={stake}
              onChange={setStake}
              disabled={phase === "flying" && inRound}
            />
          </div>

          {/* Auto Cashout */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
              Auto Cashout (Multiplier)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="1.01"
                max="1000"
                value={autoCashout}
                onChange={(e) => setAutoCashout(e.target.value)}
                placeholder="Disabled"
                disabled={phase === "flying" && inRound}
                className="w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm font-mono font-bold focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="absolute right-3 top-2.5 text-xs font-bold text-muted-foreground">
                ×
              </span>
            </div>
          </div>
        </div>

        {/* Action Button: Bet or Cashout */}
        {phase === "flying" && inRound && !cashedOut ? (
          <PrimaryButton
            onClick={() => handleCashout()}
            className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold text-base py-6 shadow-xl hover:brightness-110 active:scale-[0.99]"
          >
            CASHOUT ₹{fmt(Math.floor(stake * mult))} ({mult.toFixed(2)}×)
          </PrimaryButton>
        ) : inRound && cashedOut ? (
          <div className="w-full rounded-xl bg-emerald-950/60 border border-emerald-500/50 py-3 text-center">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest block">
              Cashed Out Successfully
            </span>
            <span className="text-lg font-mono font-black text-emerald-300">
              Won ₹{fmt(Math.floor(stake * (cashedOutMult || 1)))} (
              {(cashedOutMult || 1).toFixed(2)}×)
            </span>
          </div>
        ) : inRound ? (
          <div className="w-full rounded-xl bg-blue-950/60 border border-blue-500/40 py-3 text-center">
            <span className="text-xs font-bold text-blue-300 uppercase tracking-widest">
              Bet Locked In · Waiting for Throw
            </span>
          </div>
        ) : (
          <PrimaryButton
            onClick={handlePlaceBet}
            disabled={phase === "flying"}
            className="w-full py-6 text-base font-extrabold shadow-lg"
          >
            PLACE BET FOR NEXT THROW (₹{fmt(stake)})
          </PrimaryButton>
        )}
      </Card>
    </div>
  );
}
