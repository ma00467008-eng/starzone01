\import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bomb, Check, Flame, Footprints, Gem, Minus, Plus, Shield, Trophy } from "lucide-react";
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
   2. CHICKEN ROAD 2.0 (HIGHWAY CROSSING WITH TRAFFIC & MANHOLE MULTIPLIERS)
========================================================================= */

/* Top-down Chicken with hopping animation */
function TopDownChicken({ hit }: { hit?: boolean }) {
  if (hit) {
    return (
      <div className="relative text-3xl animate-bounce">
        <span>💥</span>
      </div>
    );
  }
  return (
    <div className="relative transition-transform duration-200">
      <svg viewBox="0 0 60 60" className="h-10 w-10 filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
        {/* Tail feathers */}
        <path d="M12 28 Q8 20 16 22 Q10 30 18 32 Z" fill="#b45309" />
        <path d="M10 30 Q6 25 15 26 Q12 34 20 34 Z" fill="#92400e" />
        {/* Body */}
        <ellipse cx="30" cy="32" rx="16" ry="14" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.5" />
        {/* Wings */}
        <ellipse cx="30" cy="21" rx="10" ry="5" fill="#fde047" transform="rotate(-15 30 21)" />
        <ellipse cx="30" cy="43" rx="10" ry="5" fill="#fde047" transform="rotate(15 30 43)" />
        {/* Head */}
        <circle cx="44" cy="32" r="9" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.5" />
        {/* Red comb */}
        <path d="M40 24 Q44 18 48 24 Q52 18 54 26 Z" fill="#ef4444" />
        {/* Eyes */}
        <circle cx="46" cy="28" r="2" fill="#0f172a" />
        <circle cx="46" cy="36" r="2" fill="#0f172a" />
        <circle cx="47" cy="27.5" r="0.7" fill="#ffffff" />
        <circle cx="47" cy="35.5" r="0.7" fill="#ffffff" />
        {/* Beak & Wattle */}
        <polygon points="52,30 58,32 52,34" fill="#f97316" />
        <ellipse cx="50" cy="36" rx="2" ry="3" fill="#dc2626" />
      </svg>
    </div>
  );
}

/* Top-down Car with headlights & roof details */
function TopDownCar({ type = "taxi" }: { type?: "taxi" | "police" | "sports" }) {
  const isTaxi = type === "taxi";
  const isPolice = type === "police";
  return (
    <svg viewBox="0 0 46 84" className="h-20 w-11 filter drop-shadow-[0_6px_10px_rgba(0,0,0,0.8)]">
      {/* Wheels */}
      <rect x="2" y="14" width="6" height="15" rx="2" fill="#0f172a" />
      <rect x="38" y="14" width="6" height="15" rx="2" fill="#0f172a" />
      <rect x="2" y="55" width="6" height="15" rx="2" fill="#0f172a" />
      <rect x="38" y="55" width="6" height="15" rx="2" fill="#0f172a" />

      {/* Car chassis */}
      <rect
        x="6"
        y="6"
        width="34"
        height="72"
        rx="9"
        fill={isTaxi ? "#eab308" : isPolice ? "#1e293b" : "#dc2626"}
      />

      {/* Front Windshield */}
      <path d="M10 24 Q23 20 36 24 L34 33 Q23 30 12 33 Z" fill="#38bdf8" opacity="0.8" />
      {/* Rear Windshield */}
      <path d="M12 51 Q23 54 34 51 L35 58 Q23 60 11 58 Z" fill="#38bdf8" opacity="0.8" />

      {/* Roof */}
      <rect
        x="10"
        y="33"
        width="26"
        height="18"
        rx="3"
        fill={isTaxi ? "#ca8a04" : isPolice ? "#0f172a" : "#991b1b"}
      />

      {/* Taxi or Police beacon */}
      {isTaxi && (
        <rect x="16" y="38" width="14" height="7" rx="2" fill="#ffffff" stroke="#000" strokeWidth="0.5" />
      )}
      {isPolice && (
        <ellipse cx="23" cy="42" rx="5" ry="3.5" fill="#ef4444" className="animate-pulse" />
      )}

      {/* Headlights */}
      <circle cx="11" cy="8" r="3" fill="#fef08a" />
      <circle cx="35" cy="8" r="3" fill="#fef08a" />
      {/* Taillights */}
      <circle cx="11" cy="76" r="2.5" fill="#ef4444" />
      <circle cx="35" cy="76" r="2.5" fill="#ef4444" />
    </svg>
  );
}

const P: Record<string, number> = { easy: 0.04, medium: 0.12, hard: 0.2, hardcore: 0.3 };

export function ChickenGame({ game }: { game: GameRow }) {
  const { t } = useApp();
  const after = useAfterPlay(game.slug);

  const [stake, setStake] = useState(game.min_stake);
  const [diff, setDiff] = useState<"easy" | "medium" | "hard" | "hardcore">("easy");
  const [sid, setSid] = useState<string | null>(null);
  const [lane, setLane] = useState(0);
  const [hazard, setHazard] = useState<number | null>(null);
  const [mult, setMult] = useState(1);
  const [busy, setBusy] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const laneMult = (l: number) =>
    Math.round((0.97 / Math.pow(1 - (P[diff] ?? 0.04), l)) * 100) / 100;

  // Auto-scroll along with the chicken
  useEffect(() => {
    if (scrollRef.current) {
      const scrollPos = Math.max(0, lane * 85 - 120);
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
    const { data, error } = await supabase.rpc("chicken_step", { _session: sid });
    setBusy(false);
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
      toast.error("Crash! Hit by speeding traffic!");
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
      {/* Top Status Bar: Current Multiplier & Target Payout */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0e131b] px-4 py-2 text-white">
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

      {/* Top-Down Highway Arena (Chicken Road 2.0 View) */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#161a23] shadow-2xl">
        <div
          ref={scrollRef}
          className="flex h-56 items-stretch overflow-x-auto no-scrollbar select-none"
        >
          {/* Starting Sidewalk */}
          <div className="flex w-24 shrink-0 flex-col items-center justify-between border-r-4 border-amber-400/80 bg-[#2b3342] p-2 text-center shadow-md">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/60">
              START
            </span>
            <div className="grid h-16 w-16 place-items-center">
              {lane === 0 && <TopDownChicken />}
            </div>
            <div className="text-[10px] font-bold text-white/40">Safe Zone</div>
          </div>

          {/* 20 Highway Lanes */}
          {Array.from({ length: 20 }, (_, i) => {
            const l = i + 1;
            const isCurrent = lane === l;
            const isPassed = l < lane;
            const isHazardLane = hazard === l;
            const carType = l % 3 === 0 ? "police" : l % 2 === 0 ? "taxi" : "sports";

            return (
              <div
                key={l}
                className={cn(
                  "relative flex w-24 shrink-0 flex-col items-center justify-between border-r border-dashed border-white/20 bg-[#1e232f] py-2 transition-all",
                  isCurrent && "bg-[#252c3b] shadow-inner",
                  isHazardLane && "bg-rose-950/70"
                )}
              >
                {/* Lane Multiplier Header */}
                <div
                  className={cn(
                    "rounded-md px-2 py-0.5 font-mono text-xs font-black shadow-sm",
                    isPassed
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : isCurrent
                      ? "bg-amber-500 text-black shadow-[0_0_10px_#f59e0b]"
                      : "bg-black/40 text-white/60"
                  )}
                >
                  {laneMult(l).toFixed(2)}x
                </div>

                {/* Road Surface Center: Manhole Multiplier Cover / Chicken / Car */}
                <div className="relative grid h-24 w-full place-items-center">
                  {/* Metal Manhole Cover */}
                  <div
                    className={cn(
                      "grid h-14 w-14 place-items-center rounded-full border-2 transition",
                      isPassed
                        ? "border-emerald-500 bg-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                        : isCurrent
                        ? "border-amber-400 bg-amber-400/20 scale-105 shadow-[0_0_14px_rgba(245,158,11,0.5)]"
                        : "border-white/15 bg-black/50"
                    )}
                  >
                    {isPassed ? (
                      <Check className="h-6 w-6 text-emerald-400" />
                    ) : (
                      <span className="text-[10px] font-black text-white/40">L{l}</span>
                    )}
                  </div>

                  {/* Active Chicken Position */}
                  {isCurrent && (
                    <div className="absolute inset-0 grid place-items-center z-10 animate-in zoom-in-75 duration-150">
                      <TopDownChicken hit={isHazardLane} />
                    </div>
                  )}

                  {/* Traffic Car on hazard or ambient hazard lanes */}
                  {isHazardLane ? (
                    <div className="absolute inset-0 grid place-items-center z-20 animate-in fade-in duration-200">
                      <TopDownCar type={carType} />
                    </div>
                  ) : (
                    !sid &&
                    l % 4 === 2 && (
                      <div className="absolute opacity-35 pointer-events-none">
                        <TopDownCar type={carType} />
                      </div>
                    )
                  )}
                </div>

                {/* Lane Number & Footprint Indicator */}
                <div className="flex items-center gap-1 text-[10px] font-bold text-white/40">
                  {isPassed ? (
                    <span className="text-emerald-400">PASSED</span>
                  ) : (
                    <span>LANE {l}</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Finish Line (Golden Egg Safe Sidewalk) */}
          <div className="flex w-28 shrink-0 flex-col items-center justify-between border-l-4 border-emerald-400 bg-[#1f3a2c] p-2 text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
              FINISH
            </span>
            <div className="grid h-16 w-16 place-items-center">
              <span className="text-4xl animate-bounce">🏆</span>
            </div>
            <div className="text-[10px] font-black text-emerald-400">GOLDEN EGG</div>
          </div>
        </div>
      </div>

      {/* Betting & Difficulty Controls */}
      <div className="rounded-2xl border border-white/10 bg-[#121620] p-4 text-white shadow-xl">
        {/* Difficulty Selector */}
        <div className="mb-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5 flex items-center justify-between">
            <span>Difficulty Mode</span>
            <span className="text-amber-400 text-xs">
              {diff === "easy" && "Low Danger · Safe Stepping"}
              {diff === "medium" && "Medium Danger · Good Multipliers"}
              {diff === "hard" && "High Danger · Big Payouts"}
              {diff === "hardcore" && "Extreme Danger · Maximum Multipliers"}
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

        {/* Quick PKR Stake Chips */}
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

        {/* Stake +/- Input */}
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

        {/* Action Buttons: START vs STEP FORWARD & CASH OUT */}
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
