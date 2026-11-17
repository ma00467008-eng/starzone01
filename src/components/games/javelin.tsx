import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Flame, Trophy, ShieldCheck, Sparkles, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp, errMsg } from "@/lib/app-context";
import { beep, fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { Card, PrimaryButton, StakeInput, useAfterPlay } from "@/components/sz/shell";
import type { GameRow } from "./types";

/* =========================================================================
   Javelin Crash Game (Olympic Field, Realistic Stick Flight & Multiplier)
   ========================================================================= */

function JavelinArena({
  phase,
  progress,
  mult,
  crashed,
}: {
  phase: "countdown" | "flying" | "crashed";
  progress: number;
  mult: number;
  crashed: boolean;
}) {
  // Angle of javelin: ascending 36deg at start, leveling out to 15deg, plunging down -65deg when crashed
  const angle = crashed ? -65 : Math.max(14, 38 - progress * 24);

  // Position across the arena: X from 15% to 80%, Y from 72% down to 22% (arc flight)
  const posX = crashed ? Math.min(85, 20 + progress * 65) : 15 + Math.min(1, progress) * 65;
  const posY = crashed ? 78 : Math.max(20, 72 - Math.sin(Math.min(1, progress) * Math.PI * 0.85) * 52);

  return (
    <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-b from-sky-950 via-slate-900 to-emerald-950 shadow-inner select-none">
      {/* Stadium Floodlights & Sky Glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-6 top-0 h-44 w-32 -rotate-12 bg-gradient-to-b from-amber-200/20 via-sky-400/10 to-transparent blur-md" />
        <div className="absolute right-6 top-0 h-44 w-32 rotate-12 bg-gradient-to-b from-amber-200/20 via-sky-400/10 to-transparent blur-md" />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-sky-500/10 to-transparent" />

        {/* Stadium Grandstand Crowd Silhouette */}
        <div className="absolute inset-x-0 bottom-16 h-12 opacity-30">
          <svg viewBox="0 0 400 40" preserveAspectRatio="none" className="h-full w-full fill-slate-700">
            <path d="M0 40 L0 15 Q20 18 40 14 T80 16 T120 13 T160 15 T200 12 T240 15 T280 13 T320 16 T360 14 T400 15 L400 40 Z" />
          </svg>
        </div>

        {/* Olympic Track & Grass Turf */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-emerald-900 via-emerald-800 to-emerald-700/80 border-t-2 border-emerald-500/30">
          {/* Distance marking arc lines */}
          <div className="absolute inset-0 flex justify-around items-end pb-1 text-[10px] font-mono font-bold text-emerald-300/40 uppercase tracking-widest">
            <span>20m</span>
            <span>40m</span>
            <span>60m</span>
            <span>80m</span>
            <span>100m</span>
          </div>
          {/* Turf runway markings */}
          <div className="absolute left-4 top-2 h-0.5 w-24 bg-white/30 rounded" />
          <div className="absolute left-10 bottom-3 h-0.5 w-16 bg-amber-400/40 rounded" />
        </div>
      </div>

      {/* Flight trajectory arc trace */}
      {phase !== "countdown" && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="javelinTrail" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
              <stop offset="70%" stopColor="#facc15" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          <path
            d={`M 15 72 Q ${posX * 0.5} ${posY * 0.6}, ${posX} ${posY}`}
            fill="none"
            stroke="url(#javelinTrail)"
            strokeWidth="2.5"
            strokeDasharray="4 4"
            className="animate-pulse"
          />
        </svg>
      )}

      {/* Center Multiplier Display */}
      <div className="absolute inset-x-0 top-6 flex flex-col items-center justify-center text-center">
        {phase === "countdown" ? (
          <div className="rounded-full bg-slate-900/80 px-4 py-1.5 backdrop-blur border border-white/10 shadow-lg">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next Throw In</span>
            <div className="font-mono text-2xl font-black text-amber-400">Ready</div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <span
              className={cn(
                "font-mono text-4xl sm:text-5xl font-black tracking-tight drop-shadow-md transition-colors",
                crashed ? "text-red-500 animate-bounce" : "text-emerald-400"
              )}
            >
              {mult.toFixed(2)}×
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-300/80 mt-0.5">
              {crashed ? "Landed on Turf" : "In Flight"}
            </span>
          </div>
        )}
      </div>

      {/* Thrower Athlete Silhouette */}
      <div
        className={cn(
          "absolute left-4 bottom-14 transition-opacity duration-300",
          phase === "countdown" ? "opacity-100" : "opacity-40"
        )}
      >
        <svg viewBox="0 0 50 60" className="h-12 w-10 fill-amber-300/80 drop-shadow">
          <circle cx="28" cy="10" r="5" />
          <path d="M28 15 L22 32 L16 50 L12 52 M22 32 L28 48 L34 52" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M24 20 L36 12 L44 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d="M24 22 L14 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>

      {/* Javelin Stick Projectile */}
      {phase !== "countdown" && (
        <div
          className="absolute transition-transform duration-75 pointer-events-none"
          style={{
            left: `${posX}%`,
            top: `${posY}%`,
            transform: `translate(-50%, -50%) rotate(${angle}deg)`,
          }}
        >
          {!crashed && (
            <div className="absolute -left-12 top-1/2 -translate-y-1/2 flex items-center">
              <div className="h-0.5 w-12 bg-gradient-to-r from-transparent via-sky-300 to-amber-300 blur-[0.5px] animate-pulse" />
              <div className="h-1 w-4 rounded-full bg-yellow-300/60 blur-[1px]" />
            </div>
          )}

          {/* Javelin stick SVG */}
          <svg viewBox="0 0 100 24" className="h-6 w-20 drop-shadow-[0_4px_8px_rgba(250,204,21,0.5)]">
            <rect x="42" y="9" width="16" height="6" rx="2" fill="#78350f" />
            <line x1="44" y1="9" x2="44" y2="15" stroke="#fef08a" strokeWidth="1" />
            <line x1="48" y1="9" x2="48" y2="15" stroke="#fef08a" strokeWidth="1" />
            <line x1="52" y1="9" x2="52" y2="15" stroke="#fef08a" strokeWidth="1" />
            <line x1="56" y1="9" x2="56" y2="15" stroke="#fef08a" strokeWidth="1" />

            <line x1="10" y1="12" x2="85" y2="12" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
            <line x1="15" y1="12" x2="40" y2="12" stroke="#facc15" strokeWidth="3" />
            <line x1="60" y1="12" x2="82" y2="12" stroke="#facc15" strokeWidth="3" />

            <polygon points="85,9 98,12 85,15" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
            <polygon points="10,10 4,12 10,14" fill="#0284c7" />
          </svg>

          {crashed && (
            <div className="absolute -bottom-2 right-0 flex items-center justify-center animate-ping">
              <div className="h-4 w-4 rounded-full bg-emerald-400/80 blur-sm" />
              <div className="h-2 w-2 rounded-full bg-amber-400" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function JavelinGame({ game }: { game: GameRow }) {
  const { t } = useApp();
  const after = useAfterPlay(game.slug);

  const [stake, setStake] = useState(game.min_stake || 10);
  const [auto, setAuto] = useState("");
  const [past, setPast] = useState<number[]>([1.38, 2.45, 1.12, 5.80, 1.94, 3.10, 1.04, 11.2, 2.15]);

  // Round lifecycle
  const [phase, setPhase] = useState<"countdown" | "flying" | "crashed">("countdown");
  const [countdown, setCountdown] = useState<number>(8);
  const [mult, setMult] = useState(1.0);
  const [progress, setProgress] = useState(0);

  // Player bet state
  const [myBetPlaced, setMyBetPlaced] = useState(false);
  const [queuedBet, setQueuedBet] = useState(false);
  const [cashedOutAt, setCashedOutAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const sidRef = useRef<string | null>(null);
  const flightStartRef = useRef<number>(0);
  const spectatorCrashPoint = useRef<number>(2.4);

  // Refs for stale closures
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

  // 1. Countdown timer & Game Loop
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (phase === "countdown") {
      setCountdown(8);
      setMult(1.0);
      setProgress(0);
      multRef.current = 1.0;
      setCashedOutAt(null);
      cashedOutAtRef.current = null;

      if (queuedBetRef.current) {
        setMyBetPlaced(true);
        myBetPlacedRef.current = true;
        setQueuedBet(false);
        queuedBetRef.current = false;
      }

      const step = 100;
      let left = 8.0;
      timer = setInterval(() => {
        left -= step / 1000;
        setCountdown(Math.max(0, Math.round(left * 10) / 10));
        if (left <= 0) {
          clearInterval(timer);
          startFlight();
        }
      }, step);
    }
    return () => clearInterval(timer);
  }, [phase]);

  const startFlight = () => {
    setPhase("flying");
    flightStartRef.current = Date.now();

    const r = Math.random();
    if (r < 0.12) spectatorCrashPoint.current = 1.0;
    else if (r < 0.55) spectatorCrashPoint.current = +(1.01 + Math.random() * 1.1).toFixed(2);
    else if (r < 0.88) spectatorCrashPoint.current = +(2.0 + Math.random() * 3.5).toFixed(2);
    else spectatorCrashPoint.current = +(5.0 + Math.random() * 12.0).toFixed(2);

    inFlightPollRef.current = false;
  };

  // 2. Flight tick & Cashout evaluation
  useEffect(() => {
    let animId: number;
    if (phase === "flying") {
      const tick = async () => {
        const elapsed = (Date.now() - flightStartRef.current) / 1000;
        const currentMult = Math.floor(Math.exp(0.09 * elapsed) * 100) / 100;
        setMult(currentMult);
        multRef.current = currentMult;
        setProgress(Math.min(1, elapsed / 8.5));

        if (myBetPlacedRef.current && sidRef.current && !cashedOutAtRef.current) {
          const autoVal = parseFloat(autoRef.current);
          const shouldAuto = !isNaN(autoVal) && autoVal > 1.0 && currentMult >= autoVal;

          if (!inFlightPollRef.current) {
            inFlightPollRef.current = true;
            try {
              let res = await (supabase.rpc as any)("javelin_check", {
                _session: sidRef.current,
                _cashout: shouldAuto,
              });

              if (res.error && res.error.message?.includes("function")) {
                res = await (supabase.rpc as any)("crash_check", {
                  _session: sidRef.current,
                  _cashout: shouldAuto,
                });
              }

              if (res.data?.crashed) {
                const finalCrash = Number(res.data.crash || currentMult);
                triggerCrash(finalCrash, res.data);
                return;
              } else if (res.data && res.data.payout > 0) {
                handleCashoutSuccess(res.data);
              }
            } catch {
              // Ignore tick network errors
            } finally {
              inFlightPollRef.current = false;
            }
          }
        } else {
          if (currentMult >= spectatorCrashPoint.current) {
            triggerCrash(spectatorCrashPoint.current, null);
            return;
          }
        }

        animId = requestAnimationFrame(tick);
      };

      animId = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(animId);
  }, [phase]);

  const handleCashoutSuccess = (data: any) => {
    const multWon = Number(data.cashout || multRef.current);
    setCashedOutAt(multWon);
    cashedOutAtRef.current = multWon;
    sidRef.current = null;
    after(data.payout || Math.floor(stakeRef.current * multWon));
    beep("win");
    toast.success(`Cashed out at ${multWon.toFixed(2)}×! Won ₹${fmt(data.payout)}`);
  };

  const triggerCrash = (crashVal: number, serverData: any) => {
    setPhase("crashed");
    setMult(crashVal);
    multRef.current = crashVal;
    beep("lose");

    setPast((prev) => [crashVal, ...prev.slice(0, 11)]);

    if (myBetPlacedRef.current && !cashedOutAtRef.current) {
      toast.error(`Javelin landed at ${crashVal.toFixed(2)}×. Better luck next throw!`);
      if (serverData) after(0);
    }

    setMyBetPlaced(false);
    myBetPlacedRef.current = false;
    sidRef.current = null;

    setTimeout(() => {
      setPhase("countdown");
    }, 3000);
  };

  // 3. Bet button handler
  const handlePlaceBet = async () => {
    if (phase === "flying") {
      setQueuedBet((prev) => !prev);
      return;
    }

    if (myBetPlaced) {
      setMyBetPlaced(false);
      return;
    }

    setBusy(true);
    try {
      const autoVal = auto ? parseFloat(auto) : null;
      let res = await (supabase.rpc as any)("javelin_start", {
        _stake: stake,
        _auto: autoVal,
      });

      if (res.error && res.error.message?.includes("function")) {
        res = await (supabase.rpc as any)("crash_start", {
          _stake: stake,
          _auto: autoVal,
        });
      }

      if (res.error) {
        if (res.error.message?.includes("Finish your current") || res.error.message?.includes("active")) {
          await (supabase.rpc as any)("javelin_reset_stuck").catch(() => {});
          await (supabase.rpc as any)("crash_reset_stuck").catch(() => {});
          res = await (supabase.rpc as any)("javelin_start", { _stake: stake, _auto: autoVal });
          if (res.error) res = await (supabase.rpc as any)("crash_start", { _stake: stake, _auto: autoVal });
        }
        if (res.error) throw res.error;
      }

      sidRef.current = res.data.session;
      setMyBetPlaced(true);
      beep("click");
      toast.success("Bet placed for this throw!");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  // 4. Cash Out button handler
  const handleManualCashout = async () => {
    if (!sidRef.current || busy || cashedOutAt) return;
    setBusy(true);
    try {
      let res = await (supabase.rpc as any)("javelin_check", {
        _session: sidRef.current,
        _cashout: true,
      });

      if (res.error && res.error.message?.includes("function")) {
        res = await (supabase.rpc as any)("crash_check", {
          _session: sidRef.current,
          _cashout: true,
        });
      }

      if (res.error) throw res.error;
      if (res.data?.payout > 0) {
        handleCashoutSuccess(res.data);
      } else if (res.data?.crashed) {
        triggerCrash(Number(res.data.crash || mult), res.data);
      }
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Past crash points badge shelf */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
        <span className="text-muted-foreground font-semibold shrink-0 flex items-center gap-1">
          <Flame className="h-3.5 w-3.5 text-orange-500 fill-orange-500" /> History:
        </span>
        {past.map((p, i) => (
          <span
            key={i}
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] font-bold border",
              p >= 10
                ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                : p >= 2
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "bg-sky-500/10 text-sky-400 border-sky-500/20"
            )}
          >
            {p.toFixed(2)}×
          </span>
        ))}
      </div>

      {/* Stadium Javelin Throw Arena */}
      <JavelinArena phase={phase} progress={progress} mult={mult} crashed={phase === "crashed"} />

      {/* Betting Controls & Action Card */}
      <Card className="space-y-3 p-4 bg-card/90 backdrop-blur">
        {/* Stake input with quick multiplier chips */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Bet Amount</span>
            <span>Min: ₹{game.min_stake} • Max: ₹{game.max_stake}</span>
          </div>
          <StakeInput stake={stake} setStake={setStake} min={game.min_stake} max={game.max_stake} disabled={phase === "flying" && myBetPlaced} />
          
          <div className="flex gap-1.5 text-xs font-semibold">
            {[10, 50, 100, 500].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setStake(v)}
                disabled={phase === "flying" && myBetPlaced}
                className="flex-1 rounded-lg bg-secondary py-1.5 text-secondary-foreground hover:bg-secondary/80 transition active:scale-95 disabled:opacity-50"
              >
                ₹{v}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setStake((s) => Math.min(game.max_stake, s * 2))}
              disabled={phase === "flying" && myBetPlaced}
              className="flex-1 rounded-lg bg-secondary py-1.5 text-secondary-foreground hover:bg-secondary/80 transition active:scale-95 disabled:opacity-50"
            >
              2×
            </button>
            <button
              type="button"
              onClick={() => setStake((s) => Math.max(game.min_stake, Math.floor(s / 2)))}
              disabled={phase === "flying" && myBetPlaced}
              className="flex-1 rounded-lg bg-secondary py-1.5 text-secondary-foreground hover:bg-secondary/80 transition active:scale-95 disabled:opacity-50"
            >
              ½
            </button>
          </div>
        </div>

        {/* Auto Cashout setting */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Auto Cash Out:</span>
          <div className="relative flex-1 max-w-[140px]">
            <input
              type="number"
              step="0.1"
              min="1.1"
              placeholder="e.g. 2.0"
              value={auto}
              onChange={(e) => setAuto(e.target.value)}
              disabled={phase === "flying" && myBetPlaced}
              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-right font-mono text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground pointer-events-none">
              ×
            </span>
          </div>
        </div>

        {/* Dynamic Action Button */}
        <div className="pt-1">
          {phase === "flying" && myBetPlaced && !cashedOutAt ? (
            <button
              type="button"
              onClick={handleManualCashout}
              disabled={busy}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 py-3.5 font-display text-base font-black text-white shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all animate-pulse"
            >
              CASH OUT ₹{fmt(Math.floor(stake * mult))} ({mult.toFixed(2)}×)
            </button>
          ) : phase === "flying" ? (
            <button
              type="button"
              onClick={() => setQueuedBet((prev) => !prev)}
              className={cn(
                "w-full rounded-xl py-3 font-display text-sm font-bold transition-all",
                queuedBet
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              {queuedBet ? "Cancel Next Throw Bet" : "Bet For Next Throw (Wait for Round)"}
            </button>
          ) : (
            <PrimaryButton
              onClick={handlePlaceBet}
              disabled={busy}
              className={cn(
                "w-full py-3.5 text-base font-bold",
                myBetPlaced && "bg-emerald-600 hover:bg-emerald-700"
              )}
            >
              {busy ? "Placing..." : myBetPlaced ? "Bet Placed (Ready for Throw)" : `Throw Javelin (₹${fmt(stake)})`}
            </PrimaryButton>
          )}
        </div>
      </Card>
    </div>
  );
}
