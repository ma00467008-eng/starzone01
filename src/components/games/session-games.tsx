import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bomb, Check, Gem, Minus, Plus, Shield, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp, errMsg } from "@/lib/app-context";
import { beep, fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { Card, PrimaryButton, StakeInput, useAfterPlay } from "@/components/sz/shell";
import type { GameRow } from "./types";

/* =========================================================================
   1. AVIATOR (SKY CRASH) - 10s CONTINUOUS ROUND LOOP
========================================================================= */

function RedAviatorPlane({ crashed }: { crashed?: boolean }) {
  return (
    <div className={cn("relative transition-transform duration-150", crashed && "opacity-0 scale-75")}>
      <svg
        viewBox="0 0 130 65"
        className="h-10 w-20 sm:h-12 sm:w-24 drop-shadow-[0_6px_14px_rgba(239,68,68,0.7)]"
      >
        <defs>
          <linearGradient id="bodyRed" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#991b1b" />
            <stop offset="45%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#f87171" />
          </linearGradient>
          <linearGradient id="wingRed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="100%" stopColor="#7f1d1d" />
          </linearGradient>
          <radialGradient id="exhaustGlow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#fb923c" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse cx="6" cy="33" rx="10" ry="4" fill="url(#exhaustGlow)" className="animate-pulse" />
        <path
          d="M14 31 Q45 22 92 27 Q114 29 122 33 Q114 37 92 39 Q45 44 14 35 Z"
          fill="url(#bodyRed)"
        />
        <path
          d="M62 26 Q74 19 88 26 Q74 29 62 26 Z"
          fill="#38bdf8"
          opacity="0.9"
        />
        <path
          d="M52 32 L26 52 Q30 55 42 51 L70 35 Z"
          fill="url(#wingRed)"
        />
        <path
          d="M56 29 L42 12 Q48 10 56 13 L68 28 Z"
          fill="url(#wingRed)"
          opacity="0.95"
        />
        <path
          d="M15 32 L3 13 Q9 11 18 18 L20 32 Z"
          fill="#b91c1c"
        />
        <ellipse cx="122" cy="33" rx="3.5" ry="4" fill="#f59e0b" />
        <line
          x1="122"
          y1="14"
          x2="122"
          y2="52"
          stroke="#fef08a"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="animate-spin origin-[122px_33px]"
        />
      </svg>
    </div>
  );
}

export function CrashGame({ game }: { game: GameRow }) {
  const { t } = useApp();
  const after = useAfterPlay(game.slug);

  const [stake, setStake] = useState(game.min_stake);
  const [auto, setAuto] = useState("");
  const [mult, setMult] = useState(1);
  const [past, setPast] = useState<number[]>([1.35, 2.14, 1.12, 6.42, 1.88, 14.2, 1.25, 3.8]);

  const [phase, setPhase] = useState<"betting" | "flying" | "crashed">("betting");
  const [countdown, setCountdown] = useState(10.0);

  const [betPlaced, setBetPlaced] = useState(false);
  const [queuedForNext, setQueuedForNext] = useState(false);
  const [hasCashedOut, setHasCashedOut] = useState(false);
  const [sid, setSid] = useState<string | null>(null);

  const startRef = useRef(0);
  const sidRef = useRef<string | null>(null);
  const simCrashRef = useRef(2.0);
  const stakeRef = useRef(stake);
  stakeRef.current = stake;
  const autoRef = useRef(auto);
  autoRef.current = auto;
  const betPlacedRef = useRef(betPlaced);
  betPlacedRef.current = betPlaced;

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (phase === "betting") {
      setCountdown(10.0);
      setMult(1);
      setHasCashedOut(false);

      if (queuedForNext) {
        setBetPlaced(true);
        setQueuedForNext(false);
      }

      const startTime = Date.now();
      const tick = setInterval(() => {
        const remaining = Math.max(0, 10.0 - (Date.now() - startTime) / 1000);
        setCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(tick);
          launchFlight();
        }
      }, 50);

      return () => clearInterval(tick);
    }

    if (phase === "crashed") {
      timer = setTimeout(() => {
        setPhase("betting");
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [phase, queuedForNext]); // eslint-disable-line react-hooks/exhaustive-deps

  const launchFlight = async () => {
    startRef.current = Date.now();
    setPhase("flying");
    beep("takeoff");

    const rand = Math.random();
    const simulated = Math.max(1.0, Math.floor(((1 / (1 - rand)) * 0.97) * 100) / 100);
    simCrashRef.current = simulated;

    if (betPlacedRef.current) {
      const a = autoRef.current ? Number(autoRef.current) : null;
      const { data, error } = await supabase.rpc("crash_start", {
        _stake: stakeRef.current,
        _auto: a as number,
      });

      if (error) {
        toast.error(errMsg(error));
        setBetPlaced(false);
      } else {
        const r = data as { session: string; balance: number };
        after(r.balance);
        sidRef.current = r.session;
        setSid(r.session);
      }
    }
  };

  useEffect(() => {
    if (phase !== "flying") return;

    const anim = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      const current = Math.floor(Math.exp(0.09 * elapsed) * 100) / 100;
      setMult(current);

      const targetAuto = Number(autoRef.current);
      if (targetAuto && current >= targetAuto && betPlacedRef.current && !hasCashedOut && sidRef.current) {
        check(true);
      }

      if (!sidRef.current && current >= simCrashRef.current) {
        triggerCrash(simCrashRef.current);
      }
    }, 40);

    const poll = setInterval(() => {
      if (sidRef.current) check(false);
    }, 380);

    return () => {
      clearInterval(anim);
      clearInterval(poll);
    };
  }, [phase, hasCashedOut]); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerCrash = (crashVal: number) => {
    setPhase("crashed");
    setMult(crashVal);
    beep("explode");
    setPast((p) => [crashVal, ...p].slice(0, 20));
    setBetPlaced(false);
    setSid(null);
    sidRef.current = null;
  };

  const settle = (r: any) => {
    sidRef.current = null;
    setSid(null);
    after(r.balance as number);

    if (r.crashed && !(Number(r.payout) > 0)) {
      triggerCrash(Number(r.crash ?? r.multiplier ?? mult));
    } else {
      setHasCashedOut(true);
      const cashMult = Number(r.multiplier ?? r.cashout ?? mult);
      beep("cashout");
      toast.success(`${t("game.win")} +${fmt(Number(r.payout))}`);
      if (r.crash) {
        triggerCrash(Number(r.crash));
      }
    }
  };

  const check = async (cashout: boolean) => {
    const id = sidRef.current;
    if (!id) return;

    if (cashout) beep("cashout");

    const { data, error } = await supabase.rpc("crash_check", {
      _session: id,
      _cashout: cashout,
    });

    if (error) {
      if (cashout) toast.error(errMsg(error));
      return;
    }

    const r = data as any;
    if (r.crashed !== false || r.payout !== undefined) {
      settle(r);
    }
  };

  const pct = Math.min(1, Math.max(0.05, Math.log(mult) / Math.log(12)));
  const planeX = 6 + pct * 74;
  const planeY = 8 + pct * 65;

  return (
    <div className="space-y-3 font-sans">
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-white/5 bg-[#0e131b] px-2 py-1.5 no-scrollbar shadow-inner">
        <span className="text-[10px] font-black uppercase tracking-widest text-white/40 mr-1 shrink-0">
          History
        </span>
        {past.map((p, i) => {
          const isHigh = p >= 10;
          const isMedium = p >= 2;
          return (
            <span
              key={i}
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-extrabold tracking-tight transition",
                isHigh
                  ? "border-rose-500/50 bg-rose-500/20 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.35)]"
                  : isMedium
                  ? "border-purple-500/40 bg-purple-500/15 text-purple-300"
                  : "border-sky-500/30 bg-sky-500/10 text-sky-400"
              )}
            >
              {p.toFixed(2)}x
            </span>
          );
        })}
      </div>

      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 bg-[#0a0d14] shadow-2xl">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {phase === "betting" && (
          <div className="absolute top-0 inset-x-0 h-1.5 bg-white/10 overflow-hidden">
            <div
              className="h-full bg-rose-500 transition-all duration-75 ease-linear shadow-[0_0_10px_#ef4444]"
              style={{ width: `${(countdown / 10.0) * 100}%` }}
            />
          </div>
        )}

        <svg
          viewBox="0 0 100 65"
          className="absolute inset-0 h-full w-full pointer-events-none"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="flightGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {phase === "flying" && (
            <>
              <path
                d={`M 0 65 Q ${planeX * 0.55} 65 ${planeX} ${65 - planeY} L ${planeX} 65 Z`}
                fill="url(#flightGradient)"
              />
              <path
                d={`M 0 65 Q ${planeX * 0.55} 65 ${planeX} ${65 - planeY}`}
                stroke="#ef4444"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
                style={{ filter: "drop-shadow(0 0 6px #ef4444)" }}
              />
            </>
          )}
        </svg>

        {phase === "flying" && (
          <div
            className="absolute transition-all duration-75 pointer-events-none"
            style={{
              left: `${planeX}%`,
              bottom: `${planeY}%`,
              transform: `translate(-50%, 50%) rotate(${Math.min(22, 5 + pct * 20)}deg)`,
            }}
          >
            <RedAviatorPlane crashed={phase === "crashed"} />
          </div>
        )}

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
          {phase === "crashed" ? (
            <div className="animate-in fade-in zoom-in duration-200">
              <div className="font-display text-4xl sm:text-6xl font-black text-rose-500 drop-shadow-[0_0_20px_rgba(244,63,94,0.8)]">
                {mult.toFixed(2)}x
              </div>
              <div className="mt-1 font-display text-sm sm:text-lg font-black uppercase tracking-widest text-rose-400">
                FLEW AWAY!
              </div>
            </div>
          ) : phase === "flying" ? (
            <div>
              {hasCashedOut ? (
                <div className="animate-in fade-in duration-150">
                  <div className="font-display text-4xl sm:text-6xl font-black text-emerald-400">
                    {mult.toFixed(2)}x
                  </div>
                  <div className="text-xs font-black uppercase text-emerald-300">
                    CASHED OUT ₨{fmt(Math.floor(stake * mult))}
                  </div>
                </div>
              ) : (
                <div className="font-display text-5xl sm:text-7xl font-black tracking-tight text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
                  {mult.toFixed(2)}
                  <span className="text-rose-500">x</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="font-display text-3xl sm:text-4xl font-black text-white/90">
                WAIT FOR NEXT ROUND
              </div>
              <div className="font-mono text-sm font-bold text-rose-400">
                Starts in {countdown.toFixed(1)}s
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#121620] p-4 text-white shadow-xl">
        <div className="mb-3 flex items-center justify-between gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[100, 200, 500, 1000, 2000, 5000].map((v) => (
            <button
              key={v}
              type="button"
              disabled={betPlaced && phase === "flying"}
              onClick={() => {
                beep("chip");
                setStake(v);
              }}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs font-bold transition active:scale-95",
                stake === v
                  ? "border-rose-500 bg-rose-500/20 text-rose-300"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
              )}
            >
              ₨{v}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1">
              Bet Amount (PKR)
            </div>
            <div className="flex items-center rounded-xl border border-white/10 bg-black/40 p-1">
              <button
                type="button"
                disabled={betPlaced}
                onClick={() => {
                  beep("chip");
                  setStake((s) => Math.max(game.min_stake, s - 50));
                }}
                className="grid h-10 w-10 place-items-center rounded-lg bg-white/10 hover:bg-white/15 active:scale-95 disabled:opacity-40"
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="number"
                inputMode="numeric"
                value={stake}
                onChange={(e) => setStake(Number(e.target.value))}
                disabled={betPlaced}
                className="h-10 min-w-0 flex-1 bg-transparent text-center font-display text-lg font-black text-amber-300 outline-none"
              />
              <button
                type="button"
                disabled={betPlaced}
                onClick={() => {
                  beep("chip");
                  setStake((s) => Math.min(game.max_stake, s + 50));
                }}
                className="grid h-10 w-10 place-items-center rounded-lg bg-white/10 hover:bg-white/15 active:scale-95 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1">
              Auto Cash Out (e.g. 2.00x)
            </div>
            <input
              value={auto}
              onChange={(e) => setAuto(e.target.value)}
              disabled={betPlaced}
              placeholder="e.g. 2.00"
              inputMode="decimal"
              className="h-12 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-center font-display text-sm font-bold text-white placeholder-white/20 outline-none focus:border-rose-500/50"
            />
          </div>
        </div>

        {phase === "flying" && betPlaced && !hasCashedOut ? (
          <button
            type="button"
            onClick={() => check(true)}
            className="flex min-h-16 w-full flex-col items-center justify-center rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 font-display font-black uppercase text-white shadow-[0_0_25px_rgba(245,158,11,0.6)] transition active:scale-[0.98]"
          >
            <span className="text-xl tracking-wider">CASH OUT</span>
            <span className="text-xs font-bold tracking-tight opacity-95">
              ₨{fmt(Math.floor(stake * mult))} ({mult.toFixed(2)}x)
            </span>
          </button>
        ) : phase === "betting" ? (
          betPlaced ? (
            <button
              type="button"
              onClick={() => {
                beep("click");
                setBetPlaced(false);
              }}
              className="flex min-h-16 w-full flex-col items-center justify-center rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 font-display font-black uppercase text-white shadow-lg transition active:scale-[0.98]"
            >
              <span className="text-lg tracking-wider">CANCEL BET</span>
              <span className="text-xs font-semibold opacity-90">WAITING FOR TAKEOFF (₨{fmt(stake)})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                beep("bet");
                setBetPlaced(true);
              }}
              className="flex min-h-16 w-full flex-col items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-600 to-green-500 font-display font-black uppercase text-white shadow-[0_0_20px_rgba(16,185,129,0.5)] transition hover:brightness-110 active:scale-[0.98]"
            >
              <span className="text-xl tracking-wider">BET</span>
              <span className="text-xs font-bold tracking-tight opacity-95">₨{fmt(stake)}</span>
            </button>
          )
        ) : queuedForNext ? (
          <button
            type="button"
            onClick={() => {
              beep("click");
              setQueuedForNext(false);
            }}
            className="flex min-h-16 w-full flex-col items-center justify-center rounded-2xl bg-rose-700 font-display font-black uppercase text-white shadow-lg transition active:scale-[0.98]"
          >
            <span className="text-lg tracking-wider">CANCEL NEXT ROUND</span>
            <span className="text-xs font-semibold opacity-90">BET ₨{fmt(stake)} QUEUED</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              beep("bet");
              setQueuedForNext(true);
            }}
            className="flex min-h-16 w-full flex-col items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-600 to-green-500 font-display font-black uppercase text-white shadow-lg transition hover:brightness-110 active:scale-[0.98]"
          >
            <span className="text-lg tracking-wider">BET FOR NEXT ROUND</span>
            <span className="text-xs font-bold tracking-tight opacity-95">₨{fmt(stake)}</span>
          </button>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   2. CHICKEN ROAD 2.0 (INOUT GAMES STYLE - LIVE HIGHWAY TRAFFIC & CHICKEN)
========================================================================= */

/* The Fluffy InOut Chicken character with big curious eyes & red comb */
function InOutChicken({ hit, jumping }: { hit?: boolean; jumping?: boolean }) {
  if (hit) {
    return (
      <div className="relative grid place-items-center animate-bounce">
        <span className="text-4xl">💥</span>
        <span className="text-[10px] font-black uppercase tracking-wider text-rose-500 mt-1">SPLAT!</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative transition-transform duration-200 select-none",
        jumping && "-translate-y-3 scale-110"
      )}
    >
      <svg
        viewBox="0 0 70 70"
        className="h-12 w-12 drop-shadow-[0_8px_10px_rgba(0,0,0,0.65)]"
      >
        <defs>
          <linearGradient id="henBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="70%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#fde047" />
          </linearGradient>
          <linearGradient id="henWing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fef9c3" />
            <stop offset="100%" stopColor="#facc15" />
          </linearGradient>
        </defs>

        {/* Tail feathers */}
        <path d="M12 30 C6 20, 14 14, 22 22 C14 26, 12 38, 20 40 Z" fill="#eab308" />

        {/* Plump Hen Body */}
        <ellipse cx="36" cy="38" rx="20" ry="17" fill="url(#henBody)" stroke="#ca8a04" strokeWidth="1.5" />

        {/* Left Wing */}
        <path
          d="M26 34 Q34 32 38 42 Q30 46 26 34 Z"
          fill="url(#henWing)"
          stroke="#ca8a04"
          strokeWidth="1"
        />

        {/* Head */}
        <circle cx="48" cy="28" r="11" fill="url(#henBody)" stroke="#ca8a04" strokeWidth="1.5" />

        {/* Red 3-Point Rooster/Hen Comb */}
        <path
          d="M42 18 Q46 10 50 16 Q54 9 57 17 Q59 13 61 20 Z"
          fill="#ef4444"
          stroke="#b91c1c"
          strokeWidth="1"
        />

        {/* Big Curious Cartoon Eyes */}
        <ellipse cx="50" cy="24" rx="4" ry="4.5" fill="#ffffff" stroke="#000" strokeWidth="1" />
        <circle cx="51.5" cy="24.5" r="2.2" fill="#0f172a" />
        <circle cx="52.2" cy="23.5" r="0.8" fill="#ffffff" />

        {/* Orange Beak */}
        <polygon points="58,26 68,29 58,33" fill="#f97316" stroke="#c2410c" strokeWidth="1" />

        {/* Red Wattle under beak */}
        <ellipse cx="55" cy="34" rx="2.5" ry="4" fill="#dc2626" />

        {/* Orange Little Hen Feet */}
        <path d="M30 55 L30 60 M30 60 L26 62 M30 60 L34 62" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M42 55 L42 60 M42 60 L38 62 M42 60 L46 62" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/* Continuously Zooming Highway Traffic Cars */
function TrafficCar({ type, speed = 3, direction = "down" }: { type: "taxi" | "police" | "sports" | "truck"; speed?: number; direction?: "up" | "down" }) {
  const isTaxi = type === "taxi";
  const isPolice = type === "police";
  const isTruck = type === "truck";

  return (
    <div
      className={cn(
        "absolute left-1/2 -translate-x-1/2 pointer-events-none z-10",
        direction === "down" ? "animate-traffic-down" : "animate-traffic-up"
      )}
      style={{
        animationDuration: `${speed}s`,
      }}
    >
      <svg
        viewBox="0 0 46 90"
        className={cn(
          "h-20 w-11 drop-shadow-[0_6px_12px_rgba(0,0,0,0.85)]",
          direction === "up" && "rotate-180"
        )}
      >
        {/* Tires */}
        <rect x="2" y="14" width="6" height="15" rx="2" fill="#0f172a" />
        <rect x="38" y="14" width="6" height="15" rx="2" fill="#0f172a" />
        <rect x="2" y="58" width="6" height="15" rx="2" fill="#0f172a" />
        <rect x="38" y="58" width="6" height="15" rx="2" fill="#0f172a" />

        {/* Main Body */}
        <rect
          x="6"
          y="6"
          width="34"
          height="76"
          rx={isTruck ? 4 : 9}
          fill={isTaxi ? "#eab308" : isPolice ? "#1e293b" : isTruck ? "#334155" : "#dc2626"}
        />

        {/* Front Windshield */}
        <path d="M10 24 Q23 20 36 24 L34 33 Q23 30 12 33 Z" fill="#38bdf8" opacity="0.85" />
        {/* Rear Windshield */}
        <path d="M12 55 Q23 58 34 55 L35 62 Q23 64 11 62 Z" fill="#38bdf8" opacity="0.85" />

        {/* Roof */}
        <rect
          x="10"
          y="33"
          width="26"
          height="22"
          rx={3}
          fill={isTaxi ? "#ca8a04" : isPolice ? "#0f172a" : isTruck ? "#1e293b" : "#991b1b"}
        />

        {/* Taxi Sign or Police Flashing Light */}
        {isTaxi && (
          <rect x="16" y="40" width="14" height="7" rx="2" fill="#ffffff" stroke="#000" strokeWidth="0.5" />
        )}
        {isPolice && (
          <ellipse cx="23" cy="44" rx="5" ry="3.5" fill="#ef4444" className="animate-pulse" />
        )}

        {/* Bright Headlights (Casting Light on Asphalt) */}
        <circle cx="11" cy="7" r="3.5" fill="#fef08a" />
        <circle cx="35" cy="7" r="3.5" fill="#fef08a" />
        <path d="M6 7 L0 0 L16 0 Z" fill="#fef08a" opacity="0.18" />
        <path d="M40 7 L30 0 L46 0 Z" fill="#fef08a" opacity="0.18" />

        {/* Red Taillights */}
        <circle cx="11" cy="80" r="2.5" fill="#ef4444" />
        <circle cx="35" cy="80" r="2.5" fill="#ef4444" />
      </svg>
    </div>
  );
}

const P: Record<string, number> = { easy: 0.04, medium: 0.12, hard: 0.2, hardcore: 0.3 };

export function ChickenGame({ game }: { game: GameRow }) {
  const { t } = useApp();
  const after = useAfterPlay(game.slug);

  const [stake, setStake] = useState(game.min_stake);
  const [diff, setDiff] = useState<"easy" | "medium" | "hard" | "hardcore">("hard");
  const [sid, setSid] = useState<string | null>(null);
  const [lane, setLane] = useState(0);
  const [hazard, setHazard] = useState<number | null>(null);
  const [mult, setMult] = useState(1);
  const [busy, setBusy] = useState(false);
  const [isJumping, setIsJumping] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const laneMult = (l: number) =>
    Math.round((0.97 / Math.pow(1 - (P[diff] ?? 0.04), l)) * 100) / 100;

  // Smooth camera tracking to keep active chicken in center of the road
  useEffect(() => {
    if (scrollRef.current) {
      const scrollPos = Math.max(0, lane * 95 - 90);
      scrollRef.current.scrollTo({ left: scrollPos, behavior: "smooth" });
    }
  }, [lane]);

  const start = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("chicken_start", { _stake: stake, _difficulty: diff });
    setBusy(false);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    const r = data as { session: string; balance: number };
    after(r.balance);
    beep("bet");
    setSid(r.session);
    setLane(0);
    setHazard(null);
    setMult(1);
  };

  const step = async () => {
    if (!sid) return;
    setBusy(true);
    setIsJumping(true);

    const { data, error } = await supabase.rpc("chicken_step", { _session: sid });
    setBusy(false);
    setTimeout(() => setIsJumping(false), 200);

    if (error) {
      toast.error(errMsg(error));
      return;
    }

    const r = data as {
      hit?: boolean;
      lane?: number;
      multiplier?: number;
      balance?: number;
      payout?: number;
      hazard?: number;
    };

    if (r.hit) {
      setLane(r.lane!);
      setHazard(r.lane!);
      setSid(null);
      after(r.balance);
      beep("explode");
      toast.error("Crash! Hit by speeding highway traffic!");
      return;
    }

    if (r.payout !== undefined) {
      setLane(20);
      setSid(null);
      after(r.balance);
      beep("win");
      toast.success(`${t("game.win")} +${fmt(r.payout)}`);
      return;
    }

    beep("step");
    setLane(r.lane!);
    setMult(r.multiplier!);
  };

  const cashout = async () => {
    if (!sid) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("chicken_cashout", { _session: sid });
    setBusy(false);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    const r = data as { payout: number; balance: number; hazard: number };
    setHazard(r.hazard);
    setSid(null);
    after(r.balance);
    beep("cashout");
    toast.success(`${t("game.win")} +${fmt(r.payout)}`);
  };

  return (
    <div className="space-y-4 font-sans">
      <style>{`
        @keyframes trafficDown {
          0% { transform: translateY(-120px); opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateY(260px); opacity: 0; }
        }
        @keyframes trafficUp {
          0% { transform: translateY(260px); opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateY(-120px); opacity: 0; }
        }
        .animate-traffic-down {
          animation: trafficDown linear infinite;
        }
        .animate-traffic-up {
          animation: trafficUp linear infinite;
        }
      `}</style>

      {/* Header Bar */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0e131b] px-4 py-2.5 text-white">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">
            Current Multiplier
          </span>
          <div className="font-display text-2xl font-black text-amber-300">
            {mult.toFixed(2)}x
          </div>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">
            Current Cashout
          </span>
          <div className="font-display text-2xl font-black text-emerald-400">
            ₨{fmt(Math.floor(stake * mult))}
          </div>
        </div>
      </div>

      {/* Full-Screen Highway Screen (Chicken Road 2.0 View) */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#161a23] shadow-2xl">
        <div
          ref={scrollRef}
          className="flex h-64 items-stretch overflow-x-auto no-scrollbar select-none"
        >
          {/* Starting Sidewalk Kerb (Chicken Waiting Zone) */}
          <div className="relative flex w-28 shrink-0 flex-col items-center justify-between border-r-4 border-amber-400 bg-[#282f3c] p-2 text-center shadow-lg">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 bg-black/40 px-2 py-0.5 rounded-full">
              KERB
            </span>

            {/* Chicken waiting on the sidewalk before crossing */}
            <div className="relative grid h-20 w-20 place-items-center">
              {lane === 0 && <InOutChicken jumping={isJumping} />}
            </div>

            <div className="text-[10px] font-black text-white/50 uppercase tracking-tight">
              SAFE ZONE
            </div>
          </div>

          {/* Continuous Highway Traffic Lanes with Manhole Multipliers */}
          {Array.from({ length: 20 }, (_, i) => {
            const l = i + 1;
            const isCurrent = lane === l;
            const isPassed = l < lane;
            const isHazardLane = hazard === l;
            const carType = l % 4 === 0 ? "police" : l % 3 === 0 ? "truck" : l % 2 === 0 ? "taxi" : "sports";
            const carSpeed = 2.4 + (l % 3) * 0.7;
            const carDir = l % 2 === 0 ? "down" : "up";

            return (
              <div
                key={l}
                className={cn(
                  "relative flex w-24 shrink-0 flex-col items-center justify-between border-r border-dashed border-white/20 bg-[#1c222d] py-2 transition-all overflow-hidden",
                  isCurrent && "bg-[#252c3b] shadow-inner",
                  isHazardLane && "bg-rose-950/80"
                )}
              >
                {/* White dashed road center line */}
                <div className="absolute inset-y-0 right-0 w-[1px] border-r border-dashed border-white/25 pointer-events-none" />

                {/* Continuously Running Traffic Cars (Not waiting for chicken!) */}
                {!isHazardLane && (
                  <TrafficCar type={carType} speed={carSpeed} direction={carDir} />
                )}

                {/* Stamped Lane Multiplier Badge */}
                <div
                  className={cn(
                    "z-20 rounded-md px-2 py-0.5 font-mono text-xs font-black shadow-md transition",
                    isPassed
                      ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/50"
                      : isCurrent
                      ? "bg-amber-400 text-black shadow-[0_0_12px_#f59e0b] scale-105"
                      : "bg-black/60 text-white/80 border border-white/10"
                  )}
                >
                  {laneMult(l).toFixed(2)}x
                </div>

                {/* Road Manhole Metal Disc & Active Chicken */}
                <div className="relative grid h-28 w-full place-items-center z-20">
                  {/* Metal sewer cover stamped with lane */}
                  <div
                    className={cn(
                      "grid h-16 w-16 place-items-center rounded-full border-2 transition shadow-inner",
                      isPassed
                        ? "border-emerald-500 bg-emerald-500/15 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                        : isCurrent
                        ? "border-amber-400 bg-amber-400/20 scale-105 shadow-[0_0_16px_rgba(245,158,11,0.6)]"
                        : "border-white/15 bg-black/60"
                    )}
                  >
                    {isPassed ? (
                      <Check className="h-7 w-7 text-emerald-400" />
                    ) : (
                      <span className="text-[10px] font-black text-white/40">L{l}</span>
                    )}
                  </div>

                  {/* Active Chicken Position on current lane */}
                  {isCurrent && (
                    <div className="absolute inset-0 grid place-items-center z-30 animate-in zoom-in-75 duration-150">
                      <InOutChicken hit={isHazardLane} jumping={isJumping} />
                    </div>
                  )}

                  {/* Crash mark on hazard */}
                  {isHazardLane && (
                    <div className="absolute inset-0 grid place-items-center z-40 animate-in zoom-in duration-150">
                      <div className="text-center">
                        <span className="text-3xl">🚗💥</span>
                        <div className="font-display text-[10px] font-black uppercase text-rose-500">
                          CRASHED
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Lane footer */}
                <div className="z-20 text-[10px] font-black text-white/40">
                  {isPassed ? <span className="text-emerald-400">SAFE</span> : `LANE ${l}`}
                </div>
              </div>
            );
          })}

          {/* Finish Line (Golden Egg Safe Sidewalk) */}
          <div className="flex w-28 shrink-0 flex-col items-center justify-between border-l-4 border-emerald-400 bg-[#1c382b] p-2 text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300 bg-black/40 px-2 py-0.5 rounded-full">
              FINISH
            </span>
            <div className="grid h-20 w-20 place-items-center">
              <span className="text-4xl animate-bounce">🏆</span>
            </div>
            <div className="text-[10px] font-black text-emerald-400 uppercase">
              GOLDEN EGG
            </div>
          </div>
        </div>
      </div>

      {/* Betting Console & Difficulty Selector */}
      <div className="rounded-2xl border border-white/10 bg-[#121620] p-4 text-white shadow-xl">
        {/* 4 Difficulty Risk Modes */}
        <div className="mb-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5 flex items-center justify-between">
            <span>Difficulty Mode</span>
            <span className="text-amber-400 text-xs font-bold">
              {diff === "easy" && "Easy · 30 Steps"}
              {diff === "medium" && "Medium · 25 Steps"}
              {diff === "hard" && "Hard · 22 Steps"}
              {diff === "hardcore" && "Hardcore · 18 Steps"}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(["easy", "medium", "hard", "hardcore"] as const).map((d) => (
              <button
                key={d}
                disabled={!!sid}
                onClick={() => setDiff(d)}
                className={cn(
                  "rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition active:scale-95 disabled:opacity-50",
                  diff === d
                    ? d === "easy"
                      ? "bg-emerald-500 text-black shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                      : d === "medium"
                      ? "bg-amber-400 text-black shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                      : d === "hard"
                      ? "bg-orange-500 text-white shadow-[0_0_12px_rgba(249,115,22,0.5)]"
                      : "bg-rose-600 text-white shadow-[0_0_12px_rgba(225,29,72,0.5)]"
                    : "bg-white/5 text-white/70 hover:bg-white/10"
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Quick PKR Chips */}
        <div className="mb-3 flex items-center justify-between gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[100, 200, 500, 1000, 2000, 5000].map((v) => (
            <button
              key={v}
              type="button"
              disabled={!!sid}
              onClick={() => {
                beep("chip");
                setStake(v);
              }}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs font-bold transition active:scale-95",
                stake === v
                  ? "border-amber-400 bg-amber-400/20 text-amber-300"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
              )}
            >
              ₨{v}
            </button>
          ))}
        </div>

        {/* Stake Adjustment */}
        <div className="mb-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1">
            Bet Stake (PKR)
          </div>
          <div className="flex items-center rounded-xl border border-white/10 bg-black/40 p-1">
            <button
              type="button"
              disabled={!!sid}
              onClick={() => {
                beep("chip");
                setStake((s) => Math.max(game.min_stake, s - 50));
              }}
              className="grid h-10 w-10 place-items-center rounded-lg bg-white/10 hover:bg-white/15 active:scale-95 disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              type="number"
              inputMode="numeric"
              value={stake}
              onChange={(e) => setStake(Number(e.target.value))}
              disabled={!!sid}
              className="h-10 min-w-0 flex-1 bg-transparent text-center font-display text-lg font-black text-amber-300 outline-none"
            />
            <button
              type="button"
              disabled={!!sid}
              onClick={() => {
                beep("chip");
                setStake((s) => Math.min(game.max_stake, s + 50));
              }}
              className="grid h-10 w-10 place-items-center rounded-lg bg-white/10 hover:bg-white/15 active:scale-95 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Large Action Buttons (START vs GO & CASH OUT) */}
        {sid ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={step}
              disabled={busy}
              className="flex min-h-16 flex-col items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-600 to-green-500 font-display font-black uppercase text-white shadow-[0_0_20px_rgba(16,185,129,0.5)] transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            >
              <span className="text-xl tracking-wider">GO (STEP)</span>
              <span className="text-xs font-bold tracking-tight opacity-90">
                Next: {laneMult(lane + 1)}x
              </span>
            </button>

            <button
              type="button"
              onClick={cashout}
              disabled={lane === 0 || busy}
              className="flex min-h-16 flex-col items-center justify-center rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 font-display font-black uppercase text-white shadow-[0_0_20px_rgba(245,158,11,0.5)] transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
            >
              <span className="text-xl tracking-wider">CASH OUT</span>
              <span className="text-xs font-bold tracking-tight opacity-95">
                ₨{fmt(Math.floor(stake * mult))} ({mult.toFixed(2)}x)
              </span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={start}
            disabled={busy}
            className="flex min-h-16 w-full flex-col items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-600 to-green-500 font-display font-black uppercase text-white shadow-[0_0_20px_rgba(16,185,129,0.5)] transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          >
            <span className="text-xl tracking-wider">{busy ? "STARTING..." : "START CROSSING"}</span>
            <span className="text-xs font-bold tracking-tight opacity-95">₨{fmt(stake)}</span>
          </button>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   3. MINES
========================================================================= */

export function MinesGame({ game }: { game: GameRow }) {
  const { t } = useApp();
  const after = useAfterPlay(game.slug);
  const [stake, setStake] = useState(game.min_stake);
  const [count, setCount] = useState(3);
  const [sid, setSid] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [mines, setMines] = useState<number[]>([]);
  const [mult, setMult] = useState(1);
  const [next, setNext] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const active = !!sid;

  const start = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("mines_start", { _stake: stake, _mines: count });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    const r = data as { session: string; balance: number };
    after(r.balance); beep("click");
    setSid(r.session); setRevealed([]); setMines([]); setMult(1); setNext(null);
  };

  const reveal = async (i: number) => {
    if (!sid || revealed.includes(i) || busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("mines_reveal", { _session: sid, _tile: i });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    const r = data as { mine?: boolean; mines?: number[]; multiplier?: number; next?: number; revealed?: number[]; balance?: number; payout?: number };
    if (r.mine) { setMines(r.mines ?? []); setRevealed((v) => [...v, i]); setSid(null); after(r.balance); beep("lose"); toast.error("Boom! You hit a mine"); return; }
    if (r.payout !== undefined) { setMines(r.mines ?? []); setRevealed((v) => [...v, i]); setSid(null); after(r.balance); beep("win"); toast.success(`${t("game.win")} +${fmt(r.payout)}`); return; }
    beep("tick"); setRevealed(r.revealed ?? []); setMult(r.multiplier ?? 1); setNext(r.next ?? null);
  };

  const cashout = async () => {
    if (!sid) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("mines_cashout", { _session: sid });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    const r = data as { payout: number; mines: number[]; balance: number };
    setMines(r.mines); setSid(null); after(r.balance); beep("win"); toast.success(`${t("game.win")} +${fmt(r.payout)}`);
  };

  return (
    <div className="space-y-4 font-sans">
      <Card className="flex justify-between text-sm">
        <span>Multiplier <b className="font-display text-primary-deep">{mult.toFixed(2)}×</b></span>
        {next && <span className="text-muted-foreground">Next {next.toFixed(2)}×</span>}
      </Card>
      <div className="grid grid-cols-5 gap-2 rounded-2xl bg-gradient-night p-3 shadow-card">
        {Array.from({ length: 25 }, (_, i) => {
          const isMine = mines.includes(i); const open = revealed.includes(i) || (mines.length > 0);
          return (
            <button key={i} onClick={() => reveal(i)} disabled={!active} className={cn("grid aspect-square place-items-center rounded-xl transition-all duration-300", !open ? "bg-primary/30 hover:bg-primary/50 active:scale-90" : isMine ? "bg-game-red" : revealed.includes(i) ? "bg-game-green" : "bg-night-foreground/10")}>
              {open && (isMine ? <Bomb className="h-6 w-6 text-primary-foreground" /> : <Gem className={cn("h-6 w-6", revealed.includes(i) ? "text-primary-foreground" : "text-night-foreground/40")} />)}
            </button>
          );
        })}
      </div>
      <Card className="space-y-3">
        <StakeInput value={stake} onChange={setStake} min={game.min_stake} max={game.max_stake} disabled={active} />
        <label className="block text-xs text-muted-foreground">{t("game.mines")}: <b className="text-foreground">{count}</b>
          <input type="range" min={1} max={24} value={count} disabled={active} onChange={(e) => setCount(Number(e.target.value))} className="mt-1 w-full accent-[var(--primary)]" />
        </label>
        {active ? <PrimaryButton variant="gold" onClick={cashout} loading={busy} disabled={!revealed.length}>{t("game.cashout")} {fmt(Math.floor(stake * mult))}</PrimaryButton>
          : <PrimaryButton onClick={start} loading={busy}>{t("game.start")}</PrimaryButton>}
      </Card>
    </div>
  );
}
