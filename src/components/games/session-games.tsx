import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { Bomb, Flame, Footprints, Gem, Plane, AlertTriangle, Sparkles, Trophy, ArrowRight, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp, errMsg } from "@/lib/app-context";
import { beep, fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { Card, PrimaryButton, StakeInput, useAfterPlay } from "@/components/sz/shell";
import type { GameRow } from "./types";

/* =========================================================================
   1. Sky Crash / Aviator (Realistic Red Plane, 10s Countdown, Radar Grid)
   ========================================================================= */

function AviatorPlane({ progress, crashed }: { progress: number; crashed: boolean }) {
  // progress from 0 (takeoff) to 1 (high altitude)
  const angle = crashed ? 45 : Math.max(12, Math.min(32, 14 + progress * 18));
  return (
    <div
      className={cn(
        "relative transition-transform duration-100",
        crashed ? "animate-bounce" : "animate-pulse"
      )}
      style={{
        transform: `rotate(-${angle}deg)`,
      }}
    >
      {/* Jet engine afterburner flame */}
      {!crashed && (
        <div className="absolute -left-6 top-1/2 -translate-y-1/2 flex items-center">
          <div className="h-2 w-6 rounded-l-full bg-gradient-to-r from-transparent via-orange-500 to-red-500 blur-[1px] animate-pulse" />
          <div className="h-1 w-3 rounded-l-full bg-yellow-300 blur-[0.5px]" />
        </div>
      )}

      {/* Aviator Red Propeller / Jet Plane SVG */}
      <svg
        viewBox="0 0 120 70"
        className={cn("h-12 w-20 drop-shadow-[0_8px_16px_rgba(239,68,68,0.5)] transition-all", crashed && "opacity-40 grayscale")}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Fuselage */}
        <path
          d="M10 32 C 22 28, 70 24, 110 33 C 114 34, 114 36, 110 37 C 70 46, 22 42, 10 38 Z"
          fill="#DC2626"
        />
        {/* Cockpit Canopy */}
        <path
          d="M60 27 C 72 27, 85 29, 90 33 C 82 34, 68 34, 58 32 Z"
          fill="#93C5FD"
          opacity="0.9"
        />
        {/* Main Wing (top) */}
        <path
          d="M48 28 L 30 6 C 28 3, 34 2, 38 4 L 68 28 Z"
          fill="#EF4444"
        />
        {/* Main Wing (bottom) */}
        <path
          d="M48 40 L 32 64 C 30 67, 36 68, 40 66 L 68 40 Z"
          fill="#B91C1C"
        />
        {/* Tail Fin */}
        <path
          d="M14 33 L 4 14 C 2 12, 6 11, 9 12 L 24 33 Z"
          fill="#B91C1C"
        />
        {/* Nose Cone */}
        <path
          d="M110 33 Q 118 35 110 37 Z"
          fill="#FDE047"
        />
        {/* Body highlight stripe */}
        <path
          d="M25 35 L 105 35"
          stroke="#FCA5A5"
          strokeWidth="2"
          strokeLinecap="round"
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
  const [past, setPast] = useState<number[]>([1.45, 2.12, 1.15, 8.42, 1.84, 3.25, 1.05, 14.2, 2.05]);

  // Round loop states
  const [phase, setPhase] = useState<"countdown" | "flying" | "crashed">("countdown");
  const [countdown, setCountdown] = useState<number>(10);
  const [mult, setMult] = useState(1.0);

  // Player bet states for current round
  const [myBetPlaced, setMyBetPlaced] = useState(false);
  const [queuedBet, setQueuedBet] = useState(false);
  const [cashedOutAt, setCashedOutAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const sidRef = useRef<string | null>(null);
  const flightStartRef = useRef<number>(0);
  const spectatorCrashPoint = useRef<number>(2.2);

  // Stale-closure protection refs: always read the latest player input
  const myBetPlacedRef = useRef(false);
  const queuedBetRef = useRef(false);
  const stakeRef = useRef(stake);
  const autoRef = useRef(auto);
  const cashedOutAtRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const inFlightPollRef = useRef(false);
  const multRef = useRef(1.0);

  useEffect(() => { myBetPlacedRef.current = myBetPlaced; }, [myBetPlaced]);
  useEffect(() => { queuedBetRef.current = queuedBet; }, [queuedBet]);
  useEffect(() => { stakeRef.current = stake; }, [stake]);
  useEffect(() => { autoRef.current = auto; }, [auto]);
  useEffect(() => { cashedOutAtRef.current = cashedOutAt; }, [cashedOutAt]);
  useEffect(() => { busyRef.current = busy; }, [busy]);
  useEffect(() => { multRef.current = mult; }, [mult]);

  // 1. Countdown timer & Round auto-loop
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (phase === "countdown") {
      setCountdown(10);
      setMult(1.0);
      multRef.current = 1.0;
      setCashedOutAt(null);
      cashedOutAtRef.current = null;

      // If user had queued a bet during flight, activate it for countdown
      if (queuedBetRef.current) {
        setMyBetPlaced(true);
        myBetPlacedRef.current = true;
        setQueuedBet(false);
        queuedBetRef.current = false;
      }

      const step = 100;
      let left = 10.0;
      timer = setInterval(() => {
        left -= step / 1000;
        setCountdown(Math.max(0, Math.round(left * 10) / 10));
        if (left <= 0) {
          clearInterval(timer);
          startTakeoff();
        }
      }, step);
    }
    return () => clearInterval(timer);
  }, [phase]);

  // 2. Takeoff
  const startTakeoff = async () => {
    setPhase("flying");
    flightStartRef.current = Date.now();
    beep("takeoff");

    // If player placed a bet for this round, call Supabase crash_start using refs
    if (myBetPlacedRef.current) {
      setBusy(true);
      busyRef.current = true;
      try {
        let resData: any = null;
        const currentStake = stakeRef.current;
        const currentAuto = autoRef.current ? Number(autoRef.current) : null;

        const { data, error } = await (supabase.rpc as any)("crash_start", {
          _stake: currentStake,
          _auto: currentAuto,
        });

        if (error) {
          const msg = errMsg(error);
          // If previous session is stuck, attempt auto-reset/clear and retry once
          if (msg.toLowerCase().includes("finish your current") || msg.toLowerCase().includes("active")) {
            try {
              const { data: stuck } = await supabase
                .from("game_sessions")
                .select("id")
                .eq("game", "aviator")
                .eq("active", true)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              if (stuck?.id) {
                await (supabase.rpc as any)("crash_check", { _session: stuck.id, _cashout: false });
              }
            } catch { /* ignore */ }

            const retry = await (supabase.rpc as any)("crash_start", {
              _stake: currentStake,
              _auto: currentAuto,
            });
            if (retry.error) throw retry.error;
            resData = retry.data;
          } else {
            throw error;
          }
        } else {
          resData = data;
        }

        sidRef.current = resData?.session ?? null;
        if (resData?.balance !== undefined) {
          after(resData.balance);
        }
      } catch (e) {
        toast.error(errMsg(e));
        setMyBetPlaced(false);
        myBetPlacedRef.current = false;
        sidRef.current = null;
      } finally {
        setBusy(false);
        busyRef.current = false;
      }
    } else {
      sidRef.current = null;
      // Spectator simulated crash target
      spectatorCrashPoint.current = Number(
        (Math.random() < 0.35 ? 1 + Math.random() * 0.7 : Math.random() < 0.7 ? 1.7 + Math.random() * 2.5 : 4 + Math.random() * 8).toFixed(2)
      );
    }
  };

  // 3. Flight Multiplier & Polling
  useEffect(() => {
    if (phase !== "flying") return;

    // Fast visual multiplier increment matching backend e^(0.1 * t)
    const anim = setInterval(() => {
      const elapsedSec = (Date.now() - flightStartRef.current) / 1000;
      const current = Math.floor(Math.exp(0.1 * elapsedSec) * 100) / 100;
      setMult(current);
      multRef.current = current;

      // Auto cashout client check if set
      if (myBetPlacedRef.current && !cashedOutAtRef.current && autoRef.current && current >= Number(autoRef.current)) {
        cashout(true);
      }

      // If purely spectating (no player bet), end round when hitting spectator crash point
      if (!sidRef.current && current >= spectatorCrashPoint.current) {
        handleCrash(spectatorCrashPoint.current);
      }
    }, 45);

    // Active bet polling with crash_check
    const poll = setInterval(() => {
      if (sidRef.current && phase === "flying") {
        checkServer(false);
      }
    }, 350);

    return () => {
      clearInterval(anim);
      clearInterval(poll);
    };
  }, [phase]);

  const checkServer = async (manualCashout: boolean) => {
    if (!sidRef.current) return;
    if (!manualCashout && inFlightPollRef.current) return;
    if (!manualCashout) inFlightPollRef.current = true;

    try {
      const { data, error } = await (supabase.rpc as any)("crash_check", {
        _session: sidRef.current,
        _cashout: manualCashout,
      });

      if (error) {
        const msg = errMsg(error);
        if (manualCashout) {
          toast.error(msg);
        }
        if (msg.toLowerCase().includes("no active flight")) {
          sidRef.current = null;
          if (!cashedOutAtRef.current) {
            handleCrash(multRef.current);
          }
        }
        return;
      }

      const res = data as any;
      if (!res) return;

      // 1. User cashed out successfully (manual or auto-triggered)
      if (res.cashout != null) {
        const win = Number(res.cashout);
        setCashedOutAt(win);
        cashedOutAtRef.current = win;
        sidRef.current = null;
        beep("cashout");
        toast.success(`Cashed out at ${win.toFixed(2)}×! (+${fmt(Number(res.payout))})`);
        after(res.balance);
        return;
      }

      // 2. Flight crashed before user cashed out
      if (res.crashed) {
        sidRef.current = null;
        const crashMult = Number(res.crash) || multRef.current;
        handleCrash(crashMult);
        if (!cashedOutAtRef.current) {
          beep("explode");
        }
        return;
      }

      // 3. Normal flight multiplier update
      if (res.multiplier && !manualCashout) {
        const serverMult = Number(res.multiplier);
        if (serverMult > multRef.current) {
          setMult(serverMult);
          multRef.current = serverMult;
        }
      }
    } catch (e: any) {
      if (manualCashout) {
        toast.error(errMsg(e));
      }
    } finally {
      if (!manualCashout) inFlightPollRef.current = false;
    }
  };

  const handleCrash = (finalMult: number) => {
    setPhase("crashed");
    setMult(finalMult);
    multRef.current = finalMult;
    setPast((p) => [finalMult, ...p.slice(0, 14)]);
    sidRef.current = null;

    if (myBetPlacedRef.current && !cashedOutAtRef.current) {
      beep("explode");
      toast.error(`Flew away at ${finalMult.toFixed(2)}×`);
    }

    setMyBetPlaced(false);
    myBetPlacedRef.current = false;

    // Wait 2.5s showing crash, then restart 10s countdown
    setTimeout(() => {
      setPhase("countdown");
      setCashedOutAt(null);
      cashedOutAtRef.current = null;
    }, 2500);
  };

  const cashout = async (autoTrigger = false) => {
    if (cashedOutAtRef.current || busyRef.current) return;
    if (!sidRef.current) {
      if (!autoTrigger) {
        toast.info("No active bet placed for this flight");
      }
      return;
    }
    setBusy(true);
    busyRef.current = true;
    try {
      await checkServer(true);
    } catch (e) {
      if (!autoTrigger) toast.error(errMsg(e));
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  };

  const toggleBet = () => {
    if (phase === "countdown") {
      const nextBet = !myBetPlaced;
      setMyBetPlaced(nextBet);
      myBetPlacedRef.current = nextBet;
      beep("bet");
    } else {
      // Flight in progress: queue for next round
      const nextQueue = !queuedBet;
      setQueuedBet(nextQueue);
      queuedBetRef.current = nextQueue;
      beep("chip");
    }
  };

  // Trajectory progress (0 to 1)
  const trajectoryProgress = Math.min(1, (mult - 1) / 4);

  return (
    <div className="space-y-3 font-sans">
      {/* Top Past Multipliers Pill Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl bg-black/40 px-3 py-2 border border-border/40 backdrop-blur-sm">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0 flex items-center gap-1">
          <Trophy className="h-3 w-3 text-gold" /> History
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {past.map((p, idx) => {
            const isHigh = p >= 10;
            const isMid = p >= 2;
            return (
              <span
                key={idx}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-mono font-bold transition shadow-sm",
                  isHigh
                    ? "bg-gradient-to-r from-red-600 to-amber-500 text-white shadow-red-500/20"
                    : isMid
                    ? "bg-purple-600/30 text-purple-300 border border-purple-500/40"
                    : "bg-blue-600/25 text-blue-300 border border-blue-500/30"
                )}
              >
                {p.toFixed(2)}x
              </span>
            );
          })}
        </div>
      </div>

      {/* Main Aviator Radar Runway Screen */}
      <div className="relative h-64 sm:h-72 md:h-80 w-full overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-b from-[#150a0a] via-[#100808] to-[#090505] p-4 flex flex-col justify-between shadow-2xl">
        {/* Animated Radar Background Grid */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div
            className="h-full w-full"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(239,68,68,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(239,68,68,0.2) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
        </div>

        {/* Radar Sweeper Circle Overlay */}
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full border border-red-500/20 pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 h-64 w-64 rounded-full border border-red-500/15 pointer-events-none" />

        {/* Flight Trajectory Canvas Path */}
        {phase === "flying" && (
          <svg className="absolute inset-0 h-full w-full pointer-events-none">
            <defs>
              <linearGradient id="flightGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#EF4444" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#EF4444" stopOpacity="1" />
              </linearGradient>
            </defs>
            <path
              d={`M 30,${240} Q ${30 + trajectoryProgress * 220},${240 - trajectoryProgress * 10} ${
                30 + trajectoryProgress * 480
              },${240 - trajectoryProgress * 180}`}
              fill="none"
              stroke="url(#flightGradient)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Area fill under curve */}
            <path
              d={`M 30,${240} Q ${30 + trajectoryProgress * 220},${240 - trajectoryProgress * 10} ${
                30 + trajectoryProgress * 480
              },${240 - trajectoryProgress * 180} L ${30 + trajectoryProgress * 480},${240} Z`}
              fill="rgba(239, 68, 68, 0.08)"
            />
          </svg>
        )}

        {/* Top Status */}
        <div className="relative z-10 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-red-500">
            <Plane className="h-4 w-4 animate-pulse" /> Aviator Live
          </span>
          {myBetPlaced && (
            <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-[11px] font-bold text-red-400 border border-red-500/30">
              Active Bet: {fmt(stake)}
            </span>
          )}
        </div>

        {/* Center Multiplier or Countdown Display */}
        <div className="relative z-10 flex flex-col items-center justify-center my-auto">
          {phase === "countdown" ? (
            <div className="space-y-2 text-center animate-fade-in">
              <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                Next Round Starts In
              </span>
              <div className="font-display text-4xl sm:text-5xl font-black text-white tracking-wider">
                {countdown.toFixed(1)}s
              </div>
              {/* Progress bar */}
              <div className="mx-auto h-2 w-48 sm:w-64 overflow-hidden rounded-full bg-secondary/80 border border-border/40">
                <div
                  className="h-full bg-gradient-to-r from-red-600 via-orange-500 to-yellow-400 transition-all duration-100"
                  style={{ width: `${(countdown / 10) * 100}%` }}
                />
              </div>
            </div>
          ) : phase === "crashed" ? (
            <div className="space-y-1 text-center animate-shake">
              <div className="text-xs sm:text-sm font-bold uppercase tracking-widest text-red-500">
                Flew Away!
              </div>
              <div className="font-display text-4xl sm:text-5xl font-black text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.7)]">
                {mult.toFixed(2)}×
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="font-display text-5xl sm:text-6xl font-black text-white drop-shadow-[0_4px_24px_rgba(239,68,68,0.4)] tracking-tight">
                {mult.toFixed(2)}×
              </div>
              {cashedOutAt && (
                <div className="mt-1 text-xs sm:text-sm font-bold text-emerald-400">
                  Cashed out at {cashedOutAt.toFixed(2)}× (+{fmt(stake * cashedOutAt)})
                </div>
              )}
            </div>
          )}
        </div>

        {/* Moving Red Airplane along flight curve */}
        {phase === "flying" && (
          <div
            className="absolute pointer-events-none transition-all duration-100 ease-linear"
            style={{
              left: `${15 + trajectoryProgress * 65}%`,
              bottom: `${15 + trajectoryProgress * 55}%`,
            }}
          >
            <AviatorPlane progress={trajectoryProgress} crashed={false} />
          </div>
        )}

        {/* Bottom Coordinates Legend */}
        <div className="relative z-10 flex items-center justify-between text-[10px] font-mono text-muted-foreground/60">
          <span>0.0s</span>
          <span>Altitude Multiplier</span>
          <span>Realtime</span>
        </div>
      </div>

      {/* Betting & Cashout Panel */}
      <Card className="space-y-3 p-4 border-red-500/20 bg-card/90">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <StakeInput
            value={stake}
            onChange={setStake}
            min={game.min_stake}
            max={game.max_stake}
            disabled={myBetPlaced && phase === "flying"}
          />

          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Auto Cashout (e.g. 2.0x, optional)
            </label>
            <input
              type="number"
              step="0.1"
              min="1.1"
              value={auto}
              onChange={(e) => setAuto(e.target.value)}
              placeholder="e.g. 2.0"
              disabled={myBetPlaced && phase === "flying"}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold font-mono focus:border-red-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Quick Stake Preset Buttons (PKR) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-[10px] text-muted-foreground uppercase font-bold shrink-0">PKR:</span>
          {[50, 100, 200, 500, 1000, 2000].map((amt) => (
            <button
              key={amt}
              type="button"
              disabled={myBetPlaced && phase === "flying"}
              onClick={() => setStake(amt)}
              className="rounded-lg bg-secondary/80 px-2.5 py-1 text-xs font-mono font-bold hover:bg-secondary text-foreground transition active:scale-95 disabled:opacity-40"
            >
              +{amt}
            </button>
          ))}
        </div>

        {/* Main Action Buttons */}
        <div>
          {phase === "flying" && myBetPlaced && !cashedOutAt ? (
            <button
              type="button"
              onClick={() => cashout(false)}
              disabled={busy}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white font-display text-base font-black tracking-wide shadow-lg shadow-orange-500/30 transition hover:brightness-110 active:scale-98 cursor-pointer disabled:opacity-60"
            >
              {busy ? "CASHING OUT..." : `CASH OUT (${fmt(stake * mult)})`}
            </button>
          ) : cashedOutAt ? (
            <div className="w-full h-12 rounded-xl bg-emerald-600/20 border-2 border-emerald-500/60 flex items-center justify-center gap-2 text-emerald-400 font-display font-black text-sm shadow-lg shadow-emerald-500/20 animate-pulse">
              <span>✓ CASHED OUT AT {cashedOutAt.toFixed(2)}×</span>
              <span className="text-white font-mono">({fmt(stake * cashedOutAt)})</span>
            </div>
          ) : phase === "countdown" ? (
            <button
              type="button"
              onClick={toggleBet}
              className={cn(
                "w-full h-12 rounded-xl font-display text-base font-black tracking-wide shadow-lg transition active:scale-98",
                myBetPlaced
                  ? "bg-red-600/30 border border-red-500/50 text-red-300 hover:bg-red-600/40"
                  : "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-red-600/30 hover:brightness-110"
              )}
            >
              {myBetPlaced ? `CANCEL BET (${fmt(stake)})` : `BET ${fmt(stake)} FOR NEXT ROUND`}
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleBet}
              className={cn(
                "w-full h-12 rounded-xl font-display text-sm font-bold tracking-wide transition active:scale-98",
                queuedBet
                  ? "bg-amber-500/20 border border-amber-500/40 text-amber-300"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              {queuedBet ? "BET QUEUED FOR NEXT ROUND (CLICK TO CANCEL)" : "QUEUE BET FOR NEXT ROUND"}
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
/* =========================================================================
   2. Mines Game (Faithfully preserved)
   ========================================================================= */

export function MinesGame({ game }: { game: GameRow }) {
  const { t } = useApp();
  const after = useAfterPlay(game.slug);
  const [stake, setStake] = useState(game.min_stake);
  const [mines, setMines] = useState(3);
  const [sid, setSid] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [mineTiles, setMineTiles] = useState<number[]>([]);
  const [hit, setHit] = useState<number | null>(null);
  const [payout, setPayout] = useState(0);
  const [mult, setMult] = useState(1);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)("mines_start", {
        _stake: stake,
        _mines: mines,
      });
      if (error) throw error;
      const session = (data as any)?.session;
      setSid(session);
      setActive(true);
      setRevealed([]);
      setMineTiles([]);
      setHit(null);
      setPayout(0);
      setMult(1);
      beep("bet");
      after((data as any)?.balance);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const pick = async (tile: number) => {
    if (!sid || !active || revealed.includes(tile) || busy) return;
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)("mines_reveal", {
        _session: sid,
        _tile: tile,
      });
      if (error) throw error;
      const res = data as any;
      if (res?.mine) {
        setHit(tile);
        setActive(false);
        setMineTiles(Array.isArray(res.mines) ? res.mines : []);
        beep("lose");
        toast.error(t("game.boom"));
        after(res.balance);
      } else if (res?.payout !== undefined) {
        setRevealed((r) => [...r, tile]);
        setPayout(Number(res.payout));
        setMult(Number(res.multiplier) || 1);
        setActive(false);
        setMineTiles(Array.isArray(res.mines) ? res.mines : []);
        beep("win");
        toast.success(t("game.all_cleared"));
        after(res.balance);
      } else {
        setRevealed((r) => [...r, tile]);
        const m = Number(res?.multiplier) || 1;
        setMult(m);
        setPayout(Math.floor(stake * m));
        beep("flip");
      }
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const cash = async () => {
    if (!sid || !active || busy) return;
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)("mines_cashout", {
        _session: sid,
      });
      if (error) throw error;
      const res = data as any;
      setActive(false);
      setMineTiles(Array.isArray(res.mines) ? res.mines : []);
      beep("win");
      toast.success(`${t("game.cashed_out")} ${fmt(Number(res.payout))}`);
      after(res.balance);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {active && (
        <div className="flex items-center justify-between rounded-xl bg-card px-4 py-2 border border-border/40">
          <span className="text-xs text-muted-foreground">Current Multiplier</span>
          <span className="font-display text-lg font-bold text-gold">{mult.toFixed(2)}×</span>
        </div>
      )}

      <Card className="grid grid-cols-5 gap-2 p-4">
        {Array.from({ length: 25 }, (_, i) => {
          const rev = revealed.includes(i);
          const isHit = hit === i;
          const isMine = mineTiles.includes(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => pick(i)}
              disabled={!active || rev || busy}
              className={cn(
                "flex aspect-square items-center justify-center rounded-xl border border-border/60 font-bold transition active:scale-95 disabled:cursor-not-allowed shadow-sm",
                rev
                  ? isHit
                    ? "bg-destructive text-destructive-foreground animate-shake"
                    : "bg-success/20 text-success border-success/40"
                  : isMine
                  ? "bg-destructive/30 text-destructive"
                  : "bg-secondary hover:bg-secondary/80"
              )}
            >
              {rev ? (
                isHit ? <Bomb className="h-5 w-5" /> : <Gem className="h-5 w-5" />
              ) : isMine ? (
                <Bomb className="h-5 w-5 opacity-70" />
              ) : null}
            </button>
          );
        })}
      </Card>

      <Card className="space-y-3 p-4">
        <StakeInput
          value={stake}
          onChange={setStake}
          min={game.min_stake}
          max={game.max_stake}
          disabled={active}
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Mines count</label>
          <select
            value={mines}
            onChange={(e) => setMines(Number(e.target.value))}
            disabled={active}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm font-bold"
          >
            {[1, 2, 3, 5, 10, 15, 20, 24].map((m) => (
              <option key={m} value={m}>
                {m} {m === 1 ? "mine" : "mines"}
              </option>
            ))}
          </select>
        </div>

        {active ? (
          <PrimaryButton onClick={cash} disabled={busy || revealed.length === 0} variant="gold">
            {t("game.cash_out")} {payout > 0 && `(${fmt(payout)})`}
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={start} disabled={busy}>
            {t("game.bet")}
          </PrimaryButton>
        )}
      </Card>
    </div>
  );
}

/* =========================================================================
   3. Chicken Road 2.0 (Realistic Forward Highway Scrolling & Car Crushing)
   ========================================================================= */

const CHICKEN_DIFFS = [
  { id: "easy", label: "Easy", multText: "1.25x - 3.5x" },
  { id: "medium", label: "Medium", multText: "1.45x - 5.2x" },
  { id: "hard", label: "Hard", multText: "1.90x - 8.4x" },
  { id: "hardcore", label: "Daredevil", multText: "2.80x - 15x" },
] as const;

// Realistic White Chicken SVG with Cartoon Crushed State, Flying Feathers & Dizzy Stars
function RealisticWhiteChicken({
  crushed,
  running,
  hopping,
}: {
  crushed: boolean;
  running?: boolean;
  hopping?: boolean;
}) {
  if (crushed) {
    return (
      <div className="relative flex flex-col items-center justify-center animate-shake z-30 select-none">
        {/* Flying cartoon feathers bursting outwards */}
        <div className="absolute inset-0 pointer-events-none">
          <span className="absolute -top-10 -left-6 text-xl rotate-45 animate-bounce">🪶</span>
          <span className="absolute -top-8 right-6 text-lg -rotate-45 animate-pulse">🪶</span>
          <span className="absolute -bottom-6 -left-8 text-base rotate-12">🪶</span>
          <span className="absolute -bottom-8 right-8 text-xl -rotate-12 animate-bounce">🪶</span>
          <span className="absolute top-2 -right-10 text-lg rotate-90">🪶</span>
        </div>

        {/* Orbiting dizzy cartoon stars */}
        <div className="absolute -top-12 flex items-center gap-1 animate-pulse">
          <span className="text-xl animate-spin">💫</span>
          <span className="text-xl text-yellow-400">⭐</span>
          <span className="text-xl animate-spin">💫</span>
        </div>

        {/* Dark rubber tire skid mark across the pavement */}
        <div className="relative flex items-center justify-center">
          <div className="absolute -left-12 h-4 w-28 bg-black/90 rounded-full blur-[1px] -rotate-6" />
          <div className="absolute -right-12 h-4 w-28 bg-black/90 rounded-full blur-[1px] -rotate-6" />

          {/* Squashed Flat Pancake Chicken SVG */}
          <svg viewBox="0 0 120 60" className="h-16 w-32 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] relative z-10" fill="none">
            {/* Flat splat body puddle */}
            <ellipse cx="60" cy="35" rx="52" ry="18" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="2.5" />
            <ellipse cx="60" cy="35" rx="46" ry="14" fill="#FFFFFF" />

            {/* Splayed out flat wings */}
            <path d="M12 36 C 8 26, 26 22, 34 30 Z" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
            <path d="M108 36 C 112 26, 94 22, 86 30 Z" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />

            {/* Squished Rooster Comb & Wattle */}
            <path d="M50 18 C 45 10, 55 8, 58 14 C 62 8, 70 10, 68 18 Z" fill="#DC2626" stroke="#991B1B" strokeWidth="1.5" />
            <ellipse cx="78" cy="36" rx="4" ry="7" fill="#DC2626" />

            {/* Squished Beak poking out flat */}
            <polygon points="76,30 92,34 76,38" fill="#F59E0B" stroke="#D97706" strokeWidth="1.5" />

            {/* Cartoon X_X Dizzy Eyes */}
            <circle cx="50" cy="32" r="7" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" />
            <path d="M46 28 L 54 36 M54 28 L 46 36" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="66" cy="32" r="7" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" />
            <path d="M62 28 L 70 36 M70 28 L 62 36" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round" />

            {/* Flat feet sticking out */}
            <path d="M30 45 L 20 54 M30 45 L 26 56 M30 45 L 34 55" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
            <path d="M90 45 L 100 54 M90 45 L 94 56 M90 45 L 86 55" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>

        {/* Comic SPLAT impact badge */}
        <div className="mt-2 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 px-3 py-1 border-2 border-white/60 shadow-2xl animate-bounce">
          <span className="text-sm">💥</span>
          <span className="text-[11px] font-black uppercase tracking-widest text-white drop-shadow">
            SPLAT! CRUSHED!
          </span>
          <span className="text-sm">🚗💨</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center transition-all duration-300 z-20",
        running ? "rotate-[14deg] translate-y-[-2px]" : "rotate-0",
        hopping ? "-translate-y-4 scale-110" : "translate-y-0 scale-100"
      )}
    >
      {/* Cartoon sprint dust cloud behind chicken feet when running */}
      {running && (
        <div className="absolute -left-5 bottom-1 pointer-events-none animate-pulse">
          <span className="text-base select-none">💨</span>
        </div>
      )}

      <svg
        viewBox="0 0 100 100"
        className="h-18 w-18 sm:h-22 sm:w-22 md:h-24 md:w-24 drop-shadow-[0_8px_18px_rgba(0,0,0,0.65)]"
        fill="none"
      >
        {/* Ground soft shadow */}
        <ellipse cx="50" cy="90" rx="26" ry="6" fill="#000000" opacity="0.45" />

        {/* Orange Claws/Feet: Animated stride position when running */}
        <path
          d={
            running
              ? "M36 74 L 20 86 M36 74 L 26 89 M36 74 L 34 85"
              : "M36 74 L 28 90 M36 74 L 36 91 M36 74 L 44 90"
          }
          stroke="#F59E0B"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={
            running
              ? "M64 74 L 72 88 M64 74 L 80 84 M64 74 L 86 78"
              : "M64 74 L 56 90 M64 74 L 64 91 M64 74 L 72 90"
          }
          stroke="#F59E0B"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Tail Feathers flaring up at the back */}
        <path
          d="M22 56 C 10 46, 8 30, 20 24 C 23 36, 27 44, 34 50 Z"
          fill="#E2E8F0"
          stroke="#CBD5E1"
          strokeWidth="2.5"
        />
        <path
          d="M18 50 C 6 38, 8 20, 18 16 C 21 28, 25 38, 30 44 Z"
          fill="#FFFFFF"
          stroke="#CBD5E1"
          strokeWidth="2.5"
        />
        <path
          d="M25 60 C 14 54, 12 42, 22 36 C 24 44, 28 50, 32 54 Z"
          fill="#F1F5F9"
          stroke="#CBD5E1"
          strokeWidth="2"
        />

        {/* Main Round Plump White Body */}
        <ellipse
          cx="50"
          cy="58"
          rx="32"
          ry="26"
          fill="#FFFFFF"
          stroke="#CBD5E1"
          strokeWidth="3"
        />
        {/* Underbelly shadow arc for 3D depth */}
        <path
          d="M24 64 C 32 80, 68 80, 76 64 C 68 76, 32 76, 24 64 Z"
          fill="#E2E8F0"
          opacity="0.75"
        />

        {/* Wing Layer with feather textures */}
        <path
          d="M34 54 C 38 42, 60 42, 66 58 C 58 72, 38 70, 34 54 Z"
          fill="#F8FAFC"
          stroke="#94A3B8"
          strokeWidth="2.5"
        />
        <path
          d="M42 58 C 46 50, 56 50, 60 62"
          stroke="#CBD5E1"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M48 64 C 52 58, 58 58, 62 66"
          stroke="#CBD5E1"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Head */}
        <circle
          cx="56"
          cy="30"
          r="20"
          fill="#FFFFFF"
          stroke="#CBD5E1"
          strokeWidth="3"
        />

        {/* Vivid Red 4-Lobe Rooster Comb on Top */}
        <path
          d="M42 16 C 39 6, 47 5, 50 11 C 53 4, 61 4, 63 11 C 66 5, 74 6, 74 13 C 77 9, 83 10, 80 20 C 76 22, 68 20, 60 20 Z"
          fill="#DC2626"
          stroke="#991B1B"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Soft Pink Cheek Blush */}
        <ellipse cx="52" cy="38" rx="5" ry="3" fill="#FDA4AF" opacity="0.65" />

        {/* Sharp Golden-Orange Beak */}
        <polygon
          points="70,28 90,35 70,43"
          fill="#F59E0B"
          stroke="#D97706"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <line x1="70" y1="35" x2="86" y2="35" stroke="#B45309" strokeWidth="1.5" strokeLinecap="round" />

        {/* Red Wattle dangling below beak */}
        <path
          d="M68 44 C 74 46, 73 56, 67 53 C 64 51, 64 45, 68 44 Z"
          fill="#DC2626"
          stroke="#991B1B"
          strokeWidth="1.5"
        />

        {/* Big Cartoon Chicken Eye */}
        <circle cx="58" cy="27" r="9.5" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.4" />
        <circle cx="60.5" cy="27" r="5.5" fill="#0F172A" />
        <circle cx="62.5" cy="24.5" r="2.2" fill="#FFFFFF" />
        <circle cx="58.5" cy="29" r="1.1" fill="#FFFFFF" />
        <path
          d="M50 18 C 55 16, 64 17, 68 20"
          stroke="#0F172A"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

// Highway Supercar SVG (Top-down view, scaled to road size)
function HighwayCar({
  color = "#DC2626",
  accent = "#EF4444",
  stopped = false,
  crushing = false,
}: {
  color?: string;
  accent?: string;
  stopped?: boolean;
  crushing?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center drop-shadow-[0_10px_20px_rgba(0,0,0,0.85)] pointer-events-none transition-all",
        crushing && "animate-pulse scale-105"
      )}
    >
      {/* Front Headlight Light Beams shining on the asphalt */}
      {!stopped && (
        <div className="absolute -top-14 h-16 w-16 bg-gradient-to-t from-yellow-300/40 via-yellow-200/15 to-transparent blur-[6px] pointer-events-none" />
      )}

      {/* Stopped / Cleared Badge when car halts for the chicken */}
      {stopped && (
        <div className="absolute -top-3 z-30 pointer-events-none">
          <span className="rounded bg-rose-600/90 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white border border-rose-400/50 shadow-md">
            🛑 STOPPED
          </span>
        </div>
      )}

      <svg viewBox="0 0 70 140" className="h-28 w-14 sm:h-32 sm:w-16" fill="none">
        {/* 4 Wide High-Grip Racing Tires with realistic treads */}
        <rect x="2" y="18" width="10" height="24" rx="3" fill="#0F172A" stroke="#334155" strokeWidth="1.5" />
        <rect x="58" y="18" width="10" height="24" rx="3" fill="#0F172A" stroke="#334155" strokeWidth="1.5" />
        <rect x="2" y="96" width="10" height="26" rx="3" fill="#0F172A" stroke="#334155" strokeWidth="1.5" />
        <rect x="58" y="96" width="10" height="26" rx="3" fill="#0F172A" stroke="#334155" strokeWidth="1.5" />

        {/* Main Aerodynamic Sports Chassis */}
        <path
          d="M12 28 C 12 12, 22 6, 35 6 C 48 6, 58 12, 58 28 L 60 110 C 60 126, 50 132, 35 132 C 20 132, 10 126, 10 110 Z"
          fill={color}
          stroke={accent}
          strokeWidth="2.5"
        />

        {/* Dual White Racing Stripes Down Center */}
        <rect x="31" y="8" width="3" height="122" fill="#FFFFFF" opacity="0.8" />
        <rect x="36" y="8" width="3" height="122" fill="#FFFFFF" opacity="0.8" />

        {/* Front Hood Vents */}
        <path d="M22 20 L 48 20" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M26 25 L 44 25" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />

        {/* Dual Xenon Headlights */}
        <ellipse cx="18" cy="12" rx="4.5" ry="3.5" fill={stopped ? "#FEF08A88" : "#FEF08A"} stroke="#CA8A04" strokeWidth="1.5" />
        <ellipse cx="52" cy="12" rx="4.5" ry="3.5" fill={stopped ? "#FEF08A88" : "#FEF08A"} stroke="#CA8A04" strokeWidth="1.5" />

        {/* Front Curved Windshield */}
        <path
          d="M16 42 C 22 36, 48 36, 54 42 L 52 64 C 44 61, 26 61, 18 64 Z"
          fill="#0B0F19"
          stroke="#334155"
          strokeWidth="2"
        />
        <path d="M22 42 L 36 62" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.45" />

        {/* Roof Section */}
        <rect x="20" y="66" width="30" height="20" rx="3" fill="#0F172A" opacity="0.95" />
        <rect x="23" y="69" width="24" height="14" rx="2" fill="#1E293B" stroke="#334155" strokeWidth="1" />

        {/* Rear Window Glass */}
        <path
          d="M19 92 C 25 89, 45 89, 51 92 L 49 106 C 43 103, 27 103, 21 106 Z"
          fill="#0B0F19"
          stroke="#334155"
          strokeWidth="1.5"
        />

        {/* Aggressive GT Wing / Rear Spoiler */}
        <rect x="8" y="118" width="54" height="6" rx="2" fill="#0F172A" stroke="#334155" strokeWidth="1.5" />

        {/* Dual Red LED Taillights - Glowing Bright Red on Brake / Stop */}
        <rect
          x="14"
          y="126"
          width="11"
          height="3.5"
          rx="1.5"
          fill="#EF4444"
          stroke="#B91C1C"
          strokeWidth="1"
          className={stopped ? "drop-shadow-[0_0_8px_#EF4444]" : ""}
        />
        <rect
          x="45"
          y="126"
          width="11"
          height="3.5"
          rx="1.5"
          fill="#EF4444"
          stroke="#B91C1C"
          strokeWidth="1"
          className={stopped ? "drop-shadow-[0_0_8px_#EF4444]" : ""}
        />
      </svg>
    </div>
  );
}

function getChickenRoadMult(lane: number, diff: string): number {
  if (lane <= 0) return 1.0;
  const pMap: Record<string, number> = {
    easy: 0.04,
    medium: 0.08,
    hard: 0.15,
    hardcore: 0.30,
  };
  const p = pMap[diff] ?? 0.04;
  return Math.round((0.97 / Math.pow(1 - p, lane)) * 100) / 100;
}

export function ChickenGame({ game }: { game: GameRow }) {
  const { t } = useApp();
  const after = useAfterPlay(game.slug);
  const [stake, setStake] = useState<number>(game.min_stake);
  const [diff, setDiff] = useState<string>("easy");
  const [sid, setSid] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);

  // Current road crossed count:
  // 0 = at START CURB / SIDEWALK (safe, NOT on road 1 yet)
  // 1 = crossed into Road 1 (cleared, cars on Road 1 stopped)
  // 2 = crossed into Road 2, etc. (up to 20)
  const [lane, setLane] = useState(0);
  const [crushed, setCrushed] = useState(false);
  const [crushingCar, setCrushingCar] = useState(false);
  const [crushLane, setCrushLane] = useState<number | null>(null);
  const [hopping, setHopping] = useState(false);
  const [running, setRunning] = useState(false);
  const [mult, setMult] = useState(1);
  const [hasStuckRound, setHasStuckRound] = useState(false);

  // Traffic Loop on upcoming danger roads
  const [carOffset, setCarOffset] = useState<number | null>(null); // lane offset
  const [carY, setCarY] = useState<number>(-140);
  const [carColor, setCarColor] = useState<string>("#DC2626");

  const clearLocalChickenState = useCallback(() => {
    localStorage.removeItem("sz_chicken_sid");
    localStorage.removeItem("sz_chicken_lane");
    localStorage.removeItem("sz_chicken_mult");
    setSid(null);
    setActive(false);
    setLane(0);
    setMult(1);
    setCrushed(false);
    setCrushingCar(false);
    setCrushLane(null);
    setRunning(false);
    setHopping(false);
    setHasStuckRound(false);
  }, []);

  // Sync with Supabase on mount
  useEffect(() => {
    let mounted = true;

    const syncSession = async () => {
      try {
        const { data, error } = await supabase
          .from("game_sessions")
          .select("id, state, stake, active")
          .eq("game", "chicken")
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!mounted) return;

        if (data && data.active && data.id) {
          setSid(data.id);
          setActive(true);
          const curLane = Number((data.state as any)?.lane) || 0;
          setLane(curLane);
          const curMult = Number((data.state as any)?.multiplier) || getChickenRoadMult(curLane, diff);
          setMult(curMult);
          if ((data as any)?.stake) setStake(Number((data as any).stake));
        } else {
          clearLocalChickenState();
        }
      } catch {
        if (mounted) clearLocalChickenState();
      }
    };

    syncSession();
    return () => {
      mounted = false;
    };
  }, [diff, clearLocalChickenState]);

  // Traffic loop on upcoming roads
  useEffect(() => {
    const CAR_COLORS = ["#DC2626", "#2563EB", "#EAB308", "#10B981", "#8B5CF6", "#EA580C"];

    const trafficInterval = setInterval(() => {
      const randomColor = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)] ?? "#DC2626";
      const targetLane = lane + 1; // Car speeds down the immediate danger road

      setCarOffset(targetLane);
      setCarColor(randomColor);
      setCarY(-140);

      let currentY = -140;
      const speed = 16 + Math.random() * 14;

      const driveInterval = setInterval(() => {
        currentY += speed;
        setCarY(currentY);
        if (currentY > 460) {
          clearInterval(driveInterval);
          setCarOffset(null);
        }
      }, 35);
    }, 3200);

    return () => clearInterval(trafficInterval);
  }, [lane]);

  const start = async () => {
    setBusy(true);
    setHasStuckRound(false);
    try {
      const { data, error } = await (supabase.rpc as any)("chicken_start", {
        _stake: stake,
        _difficulty: diff,
      });
      if (error) throw error;
      const session = (data as any)?.session;
      setSid(session);
      setActive(true);
      setLane(0);
      setMult(1);
      setCrushed(false);
      setCrushingCar(false);
      setCrushLane(null);
      beep("bet");
      toast.success("Run started! Safe at the Start Curb. Click CROSS ROAD to step forward!");
      after((data as any)?.balance);
    } catch (e: any) {
      const msg = errMsg(e);
      if (msg.toLowerCase().includes("finish your current") || msg.toLowerCase().includes("active")) {
        setHasStuckRound(true);
        try {
          await (supabase.rpc as any)("chicken_reset_stuck");
          const retry = await (supabase.rpc as any)("chicken_start", {
            _stake: stake,
            _difficulty: diff,
          });
          if (!retry.error) {
            setSid((retry.data as any)?.session);
            setActive(true);
            setLane(0);
            setMult(1);
            setCrushed(false);
            setCrushingCar(false);
            setCrushLane(null);
            setHasStuckRound(false);
            beep("bet");
            toast.success("Previous run resolved! You can cross now!");
            after((retry.data as any)?.balance);
            return;
          }
        } catch { /* ignore */ }
      }
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const stepForward = async () => {
    if (!sid || !active || busy || crushed) return;
    setBusy(true);
    setHopping(true);

    try {
      const { data, error } = await (supabase.rpc as any)("chicken_step", {
        _session: sid,
      });
      if (error) throw error;
      const res = data as any;

      if (res?.hit) {
        // Chicken tried to cross and got crushed by a speeding car!
        const hitTargetLane = lane + 1;
        setCrushLane(hitTargetLane);
        setCrushingCar(true);
        beep("chip");

        // Fast car collision animation: 220ms car speeds in, then SLAM!
        setTimeout(() => {
          setCrushed(true);
          setCrushingCar(false);
          setHopping(false);
          setRunning(false);
          setActive(false);
          clearLocalChickenState();
          beep("explode");
          toast.error("SPLAT! A speeding car crushed the chicken!");
          after(res.balance);
        }, 250);
      } else if (res?.payout !== undefined) {
        // Victory! Reached maximum road (Road 20)!
        setRunning(true);
        const newLane = lane + 1;
        setLane(newLane);
        setMult(Number(res.multiplier) || getChickenRoadMult(newLane, diff));
        setActive(false);
        clearLocalChickenState();
        beep("win");
        setTimeout(() => {
          setRunning(false);
          setHopping(false);
        }, 500);
        toast.success(`Victory! Cleared the highway! Cashed out ${fmt(Number(res.payout))}`);
        after(res.balance);
      } else {
        // Sprinted safely across into the next road!
        const newLane = res?.lane !== undefined ? Number(res.lane) : lane + 1;
        setRunning(true);
        setLane(newLane);
        const newMult = Number(res?.multiplier) || getChickenRoadMult(newLane, diff);
        setMult(newMult);
        beep("step");
        setTimeout(() => {
          setRunning(false);
          setHopping(false);
        }, 500);
      }
    } catch (e: any) {
      setHopping(false);
      setRunning(false);
      const msg = errMsg(e);
      if (
        msg.toLowerCase().includes("no active round") ||
        msg.toLowerCase().includes("not found") ||
        msg.toLowerCase().includes("invalid")
      ) {
        clearLocalChickenState();
        toast.info("No active round found. You can start a new run now!");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const cash = async () => {
    if (!sid || !active || busy || crushed || lane === 0) return;
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)("chicken_cashout", {
        _session: sid,
      });
      if (error) throw error;
      const res = data as any;
      const winMult = Number(res?.multiplier) || mult;
      const winPayout = Number(res?.payout) || Math.floor(stake * winMult);
      beep("cashout");
      toast.success(`Cashed out safely at Road ${lane}! Won ${fmt(winPayout)} (${winMult.toFixed(2)}×)`);
      setActive(false);
      clearLocalChickenState();
      after(res?.balance);
    } catch (e) {
      const msg = errMsg(e);
      if (msg.toLowerCase().includes("no active round") || msg.toLowerCase().includes("not found")) {
        clearLocalChickenState();
        toast.info("Round was already ended.");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const clearStuckRound = async () => {
    setBusy(true);
    try {
      await (supabase.rpc as any)("chicken_reset_stuck");
      clearLocalChickenState();
      toast.success("Previous stuck round cleared. You can start a fresh run!");
    } catch (e) {
      clearLocalChickenState();
      toast.info("Round reset.");
    } finally {
      setBusy(false);
    }
  };

  const currentPayout = Math.floor(stake * mult);

  // Total segments: 0 (Start Curb), 1..20 (Roads 1 to 20), 21 (Finish Golden Barn)
  const ALL_ROADS = Array.from({ length: 22 }, (_, i) => i);

  return (
    <div className="space-y-4 font-sans">
      {/* Chicken Road Highway Scene: Scrolling Track */}
      <Card className="relative overflow-hidden p-0 border-border/60 bg-[#101114] shadow-2xl rounded-2xl">
        {/* Status header with current road and current multiplier */}
        <div className="flex items-center justify-between border-b border-border/40 bg-black/60 px-4 py-2.5 text-xs">
          <span className="font-bold flex items-center gap-2 text-foreground text-sm">
            <span className="text-xl">🐔</span> Chicken Road 2.0
          </span>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground font-medium">
              Position: <strong className="text-foreground font-bold">{lane === 0 ? "Start Curb" : `Road ${lane}/20`}</strong>
            </span>
            <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 border border-amber-500/30">
              <span className="text-[10px] uppercase font-bold text-amber-300">Win</span>
              <span className="font-display font-black text-amber-400 text-sm">
                {mult.toFixed(2)}×
              </span>
            </div>
          </div>
        </div>

        {/* Viewport: 3 Roads visible at once with smooth camera track scrolling forward */}
        <div className="relative h-80 sm:h-96 md:h-[420px] w-full bg-[#141518] p-0 select-none overflow-hidden">
          {/* Moving Road Track Container: Slides left smoothly as chicken advances */}
          <div
            className="flex h-full w-full transition-transform duration-500 ease-out"
            style={{
              transform: `translateX(-${lane * 33.333333}%)`,
            }}
          >
            {ALL_ROADS.map((roadIndex) => {
              const isStartCurb = roadIndex === 0;
              const isFinish = roadIndex === 21;
              const isCleared = !isStartCurb && !isFinish && roadIndex <= lane;
              const isCurrent = roadIndex === lane;
              const isNextDanger = roadIndex === lane + 1;
              const roadMult = isStartCurb ? 1 : isFinish ? getChickenRoadMult(20, diff) : getChickenRoadMult(roadIndex, diff);
              const hasCarTraffic = carOffset === roadIndex && !isCleared && !isStartCurb && !isFinish;
              const isCrushPoint = crushed && crushLane === roadIndex;
              const isCrushingIncoming = crushingCar && crushLane === roadIndex;

              return (
                <div
                  key={roadIndex}
                  className={cn(
                    "relative flex-shrink-0 w-1/3 h-full flex flex-col items-center justify-center transition-colors duration-500 select-none",
                    isStartCurb
                      ? "bg-gradient-to-r from-[#1e293b] via-[#1a2333] to-[#161e2e] border-r-4 border-amber-400/80"
                      : isFinish
                      ? "bg-gradient-to-r from-amber-950/40 via-yellow-900/30 to-amber-900/40 border-l-4 border-gold"
                      : isCleared
                      ? "bg-[#18191e] border-r-2 border-dashed border-emerald-500/30"
                      : isNextDanger
                      ? "bg-[#16171b] border-r-2 border-dashed border-amber-400/50 shadow-inner"
                      : "bg-[#141518] border-r-2 border-dashed border-white/10"
                  )}
                >
                  {/* Top Segment Label Badge */}
                  <div className="absolute top-3 z-10 flex flex-col items-center gap-1">
                    {isStartCurb ? (
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-black/80 px-2 py-0.5 rounded-md border border-emerald-500/30 flex items-center gap-1">
                        <span>🏁</span> START CURB
                      </span>
                    ) : isFinish ? (
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-black/80 px-2 py-0.5 rounded-md border border-amber-400/40 flex items-center gap-1">
                        <span>🏆</span> FINISH LINE
                      </span>
                    ) : (
                      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground bg-black/70 px-2 py-0.5 rounded-md border border-white/10">
                        ROAD {roadIndex}
                      </span>
                    )}

                    {!isStartCurb && (
                      <span
                        className={cn(
                          "text-xs font-mono font-black px-2.5 py-0.5 rounded-full border shadow-md",
                          isCleared
                            ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/40"
                            : isNextDanger
                            ? "bg-black/90 text-amber-300 border-amber-400/50 animate-pulse"
                            : "bg-black/80 text-muted-foreground border-border/40"
                        )}
                      >
                        {roadMult.toFixed(2)}×
                      </span>
                    )}
                  </div>

                  {/* Asphalt Painted Road Markings */}
                  {!isStartCurb && !isFinish && isCleared && (
                    <div className="absolute inset-y-16 w-8 flex flex-col justify-around items-center opacity-30 pointer-events-none">
                      <div className="h-3 w-6 bg-emerald-400 rounded-sm" />
                      <div className="h-3 w-6 bg-emerald-400 rounded-sm" />
                      <div className="h-3 w-6 bg-emerald-400 rounded-sm" />
                    </div>
                  )}

                  {/* Cars on this road: */}
                  {isCleared ? (
                    /* Cleared Road: Stopped car parked safely with red brake lights */
                    <div className="absolute top-16 z-20 pointer-events-none transition-all duration-300">
                      <HighwayCar color="#DC2626" stopped />
                    </div>
                  ) : hasCarTraffic ? (
                    /* Traffic car driving down danger lane */
                    <div
                      className="absolute z-20 pointer-events-none transition-all duration-75"
                      style={{ top: `${carY}px` }}
                    >
                      <HighwayCar color={carColor} />
                    </div>
                  ) : null}

                  {/* Crushing Muscle Car zooming in on collision */}
                  {isCrushingIncoming && (
                    <div
                      className="absolute z-30 pointer-events-none transition-all duration-200 ease-in"
                      style={{ top: "45%" }}
                    >
                      <HighwayCar color="#DC2626" crushing />
                    </div>
                  )}

                  {/* Stopped Car over crushed chicken */}
                  {isCrushPoint && (
                    <div className="absolute top-8 z-20 pointer-events-none">
                      <HighwayCar color="#DC2626" stopped />
                    </div>
                  )}

                  {/* Chicken Container: rendered on current lane (or crush lane if hit) */}
                  {(isCurrent && !crushed) || isCrushPoint ? (
                    <div
                      className={cn(
                        "relative z-30 flex items-center justify-center transition-all duration-300 pointer-events-none",
                        hopping && "-translate-y-4 scale-105",
                        running && "translate-x-3 rotate-12"
                      )}
                    >
                      <RealisticWhiteChicken
                        crushed={crushed}
                        running={running}
                        hopping={hopping}
                      />
                    </div>
                  ) : null}

                  {/* Bottom Status Label */}
                  <span className="absolute bottom-3 text-[10px] font-mono tracking-widest font-black">
                    {isStartCurb ? (
                      <span className="text-emerald-400">SAFE ZONE</span>
                    ) : isCleared ? (
                      <span className="text-emerald-400">CLEARED ✓</span>
                    ) : isNextDanger ? (
                      <span className="text-amber-400 animate-pulse">NEXT TO CROSS</span>
                    ) : isFinish ? (
                      <span className="text-amber-300">GOAL</span>
                    ) : (
                      <span className="text-muted-foreground/30">DANGER ZONE</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Stuck round resolution notice if detected */}
      {hasStuckRound && (
        <Card className="p-3 bg-destructive/10 border-destructive/30 flex items-center justify-between text-xs">
          <div>
            <p className="font-bold text-destructive">Unfinished Round Detected</p>
            <p className="text-muted-foreground text-[11px]">
              A previous session was left open. Tap below to clear it.
            </p>
          </div>
          <button
            type="button"
            onClick={clearStuckRound}
            disabled={busy}
            className="rounded-lg bg-destructive px-3 py-1.5 font-bold text-destructive-foreground hover:bg-destructive/90 transition shadow-sm"
          >
            Clear & Reset
          </button>
        </Card>
      )}

      {/* Controls & Betting Panel */}
      <Card className="space-y-4 p-4 border-amber-500/20 bg-card/90">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <StakeInput
            value={stake}
            onChange={setStake}
            min={game.min_stake}
            max={game.max_stake}
            disabled={active || busy}
          />

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Difficulty Level</label>
            <div className="grid grid-cols-4 gap-1">
              {CHICKEN_DIFFS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  disabled={active || busy}
                  onClick={() => setDiff(d.id)}
                  className={cn(
                    "rounded-xl py-2 px-1 text-center font-bold text-xs transition border",
                    diff === d.id
                      ? "bg-amber-500 text-black border-amber-400 shadow-md font-black"
                      : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80 disabled:opacity-50"
                  )}
                >
                  <div>{d.label}</div>
                  <div className="text-[9px] font-mono opacity-80 mt-0.5">{d.multText}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Stake Preset Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-[10px] text-muted-foreground uppercase font-bold shrink-0">PKR:</span>
          {[50, 100, 200, 500, 1000, 2000].map((amt) => (
            <button
              key={amt}
              type="button"
              disabled={active || busy}
              onClick={() => setStake(amt)}
              className="rounded-lg bg-secondary/80 px-2.5 py-1 text-xs font-mono font-bold hover:bg-secondary text-foreground transition active:scale-95 disabled:opacity-40"
            >
              +{amt}
            </button>
          ))}
        </div>

        {/* Action Button: Cross Road (Step) or Cash Out */}
        <div>
          {!active ? (
            <button
              type="button"
              disabled={busy}
              onClick={start}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-black font-display text-base font-black tracking-wide shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-98 transition cursor-pointer disabled:opacity-50"
            >
              {busy ? "PREPARING RUN..." : `START RUN (${fmt(stake)})`}
            </button>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy || crushed}
                onClick={stepForward}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-black font-display text-base font-black tracking-wide shadow-lg shadow-amber-500/30 hover:brightness-110 active:scale-98 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Footprints className="h-5 w-5" />
                {busy ? "CROSSING..." : `CROSS ROAD ${lane + 1} (${getChickenRoadMult(lane + 1, diff).toFixed(2)}×)`}
              </button>

              <button
                type="button"
                disabled={busy || crushed || lane === 0}
                onClick={cash}
                className={cn(
                  "w-full h-12 rounded-xl font-display text-base font-black tracking-wide shadow-lg transition active:scale-98 flex items-center justify-center gap-2",
                  lane === 0
                    ? "bg-secondary/60 text-muted-foreground cursor-not-allowed border border-border/40"
                    : "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-emerald-500/30 hover:brightness-110 cursor-pointer"
                )}
              >
                <ShieldCheck className="h-5 w-5" />
                {lane === 0 ? "CROSS 1 ROAD TO CASHOUT" : `CASH OUT ${fmt(currentPayout)}`}
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
