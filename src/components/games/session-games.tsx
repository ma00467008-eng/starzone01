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

  // 1. Countdown timer & Round auto-loop
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (phase === "countdown") {
      setCountdown(10);
      setMult(1.0);
      setCashedOutAt(null);

      // If user had queued a bet during flight, apply it now
      if (queuedBet) {
        setMyBetPlaced(true);
        setQueuedBet(false);
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
  }, [phase, queuedBet]);

  // 2. Takeoff
  const startTakeoff = async () => {
    setPhase("flying");
    flightStartRef.current = Date.now();
    beep("takeoff");

    // If player placed a bet for this round, call Supabase crash_start
    if (myBetPlaced) {
      setBusy(true);
      try {
        const { data, error } = await (supabase.rpc as any)("crash_start", {
          _stake: stake,
          _auto_cashout: auto ? Number(auto) : null,
        });
        if (error) throw error;
        sidRef.current = (data as any)?.session;
        after((data as any)?.balance);
      } catch (e) {
        toast.error(errMsg(e));
        setMyBetPlaced(false);
        sidRef.current = null;
      } finally {
        setBusy(false);
      }
    } else {
      // Spectator simulated crash target
      spectatorCrashPoint.current = Number(
        (Math.random() < 0.35 ? 1 + Math.random() * 0.7 : Math.random() < 0.7 ? 1.7 + Math.random() * 2.5 : 4 + Math.random() * 8).toFixed(2)
      );
    }
  };

  // 3. Flight Multiplier & Polling
  useEffect(() => {
    if (phase !== "flying") return;

    // Fast visual multiplier increment
    const anim = setInterval(() => {
      const elapsedSec = (Date.now() - flightStartRef.current) / 1000;
      // Exponential curve: e^(0.09 * t)
      const current = Math.floor(Math.exp(0.095 * elapsedSec) * 100) / 100;
      setMult(current);

      // Auto cashout client check if set
      if (myBetPlaced && !cashedOutAt && auto && current >= Number(auto)) {
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
  }, [phase, myBetPlaced, cashedOutAt, auto]);

  const checkServer = async (manualCashout: boolean) => {
    if (!sidRef.current) return;
    try {
      const { data, error } = await (supabase.rpc as any)("crash_check", {
        _session: sidRef.current,
        _cashout: manualCashout,
      });
      if (error) {
        sidRef.current = null;
        return;
      }
      const res = data as any;
      if (res?.cashed) {
        const win = Number(res.multiplier);
        setCashedOutAt(win);
        beep("cashout");
        toast.success(`Cashed out at ${win.toFixed(2)}×! (+${fmt(Number(res.payout))})`);
        after(res.balance);
      }
      if (res?.crashed) {
        sidRef.current = null;
        handleCrash(Number(res.final_multiplier) || mult);
        if (!cashedOutAt) {
          beep("explode");
        }
      }
    } catch {
      // ignore
    }
  };

  const handleCrash = (finalMult: number) => {
    setPhase("crashed");
    setMult(finalMult);
    setPast((p) => [finalMult, ...p.slice(0, 14)]);
    sidRef.current = null;

    if (myBetPlaced && !cashedOutAt) {
      beep("explode");
      toast.error(`Flew away at ${finalMult.toFixed(2)}×`);
    }

    setMyBetPlaced(false);

    // Wait 2.5s showing crash, then restart 10s countdown
    setTimeout(() => {
      setPhase("countdown");
    }, 2500);
  };

  const cashout = async (autoTrigger = false) => {
    if (!sidRef.current || cashedOutAt || busy) return;
    setBusy(true);
    try {
      await checkServer(true);
    } catch (e) {
      if (!autoTrigger) toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleBet = () => {
    if (phase === "countdown") {
      setMyBetPlaced(!myBetPlaced);
      beep("bet");
    } else {
      // Flight in progress: queue for next round
      setQueuedBet(!queuedBet);
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
      <div className="relative h-64 sm:h-72 w-full overflow-hidden rounded-2xl border border-red-500/20 bg-gradient-to-b from-[#140608] via-[#0c0405] to-[#050202] shadow-[inset_0_0_80px_rgba(220,38,38,0.15)] flex flex-col justify-between p-4">
        {/* Radar grid lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ef44440a_1px,transparent_1px),linear-gradient(to_bottom,#ef44440a_1px,transparent_1px)] bg-[size:28px_28px]" />

        {/* Diagonal trajectory line during flight */}
        {phase === "flying" && (
          <svg className="absolute inset-0 h-full w-full pointer-events-none">
            <path
              d={`M 15 240 Q ${80 + trajectoryProgress * 120} ${220 - trajectoryProgress * 80}, ${
                60 + trajectoryProgress * 220
              } ${220 - trajectoryProgress * 150}`}
              fill="none"
              stroke="#ef4444"
              strokeWidth="3.5"
              strokeLinecap="round"
              className="drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]"
            />
            {/* Red Area Fill under trajectory */}
            <path
              d={`M 15 240 Q ${80 + trajectoryProgress * 120} ${220 - trajectoryProgress * 80}, ${
                60 + trajectoryProgress * 220
              } ${220 - trajectoryProgress * 150} L ${60 + trajectoryProgress * 220} 240 Z`}
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
              className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white font-display text-base font-black tracking-wide shadow-lg shadow-orange-500/30 transition hover:brightness-110 active:scale-98"
            >
              CASH OUT ({fmt(stake * mult)})
            </button>
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
   3. Chicken Road 2 (Realistic White Chicken, 3 Highway Roads, Random Traffic)
   ========================================================================= */

const CHICKEN_DIFFS = [
  { id: "easy", label: "Easy", color: "text-emerald-400" },
  { id: "medium", label: "Medium", color: "text-primary" },
  { id: "hard", label: "Hard", color: "text-orange-400" },
  { id: "hardcore", label: "Daredevil", color: "text-destructive" },
] as const;

// Realistic White Chicken SVG
function RealisticWhiteChicken({ crushed }: { crushed: boolean }) {
  if (crushed) {
    return (
      <div className="relative flex items-center justify-center animate-shake">
        {/* Splat mark */}
        <div className="h-10 w-12 rounded-full bg-red-600/80 blur-[2px]" />
        <span className="absolute text-2xl font-black text-yellow-300">💥</span>
      </div>
    );
  }

  return (
    <div className="relative h-12 w-12 flex items-center justify-center transition-transform duration-200">
      <svg viewBox="0 0 80 80" className="h-12 w-12 drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]" fill="none">
        {/* Yellow feet */}
        <path d="M28 62 L 24 74 M28 62 L 30 74 M52 62 L 50 74 M52 62 L 56 74" stroke="#FBBF24" strokeWidth="3.5" strokeLinecap="round" />
        
        {/* White Plump Body */}
        <ellipse cx="40" cy="46" rx="22" ry="18" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="2" />
        
        {/* Wing with feather highlights */}
        <path d="M30 42 C 34 38, 48 38, 50 48 C 44 54, 32 52, 30 42 Z" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="1.5" />
        
        {/* Head */}
        <circle cx="42" cy="24" r="14" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="2" />
        
        {/* Bright Red Comb */}
        <path d="M34 14 C 34 8, 38 8, 40 12 C 42 7, 46 7, 48 11 C 50 8, 54 8, 53 14 Z" fill="#DC2626" />
        
        {/* Red Wattle */}
        <path d="M48 34 C 52 34, 52 40, 48 39 Z" fill="#DC2626" />
        
        {/* Bright Yellow Beak */}
        <polygon points="52,24 64,28 52,32" fill="#F59E0B" />
        
        {/* Eye */}
        <circle cx="46" cy="22" r="2.5" fill="#0F172A" />
        <circle cx="47" cy="21" r="0.8" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

// Top-down Highway Car SVG
function HighwayCar({ color = "#EF4444", direction = "down" }: { color?: string; direction?: "up" | "down" }) {
  return (
    <svg
      viewBox="0 0 40 70"
      className={cn("h-11 w-7 drop-shadow-md", direction === "up" && "rotate-180")}
      fill="none"
    >
      {/* Car Body */}
      <rect x="6" y="8" width="28" height="54" rx="8" fill={color} />
      {/* Windshield */}
      <rect x="10" y="18" width="20" height="12" rx="2" fill="#1E293B" opacity="0.85" />
      {/* Rear Window */}
      <rect x="11" y="44" width="18" height="8" rx="2" fill="#1E293B" opacity="0.85" />
      {/* Headlights */}
      <circle cx="11" cy="11" r="2" fill="#FEF08A" />
      <circle cx="29" cy="11" r="2" fill="#FEF08A" />
      {/* Taillights */}
      <circle cx="11" cy="59" r="2" fill="#EF4444" />
      <circle cx="29" cy="59" r="2" fill="#EF4444" />
    </svg>
  );
}

export function ChickenGame({ game }: { game: GameRow }) {
  const { t } = useApp();
  const after = useAfterPlay(game.slug);

  const [stake, setStake] = useState(game.min_stake);
  const [diff, setDiff] = useState<"easy" | "medium" | "hard" | "hardcore">("easy");
  const [sid, setSid] = useState<string | null>(null);

  // Position: 0 is starting sidewalk, 1..3 are the 3 highway roads, 4 is destination safe zone
  const [roadIndex, setRoadIndex] = useState(0);
  const [crushed, setCrushed] = useState(false);
  const [mult, setMult] = useState(1);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);

  // Highway ambient car positions (random car spawns every 3-6s per user request)
  const [carLane, setCarLane] = useState<number | null>(null);
  const [carOffset, setCarOffset] = useState<number>(-100);

  // Random traffic loop: a car drives past every 3 to 5 seconds
  useEffect(() => {
    const trafficInterval = setInterval(() => {
      // Pick a random road lane (1, 2, or 3)
      const targetLane = Math.floor(Math.random() * 3) + 1;
      setCarLane(targetLane);
      setCarOffset(-80);

      // Animate driving down the lane
      let currentPos = -80;
      const speed = 12 + Math.random() * 14; // fast or slow
      const driveInterval = setInterval(() => {
        currentPos += speed;
        setCarOffset(currentPos);
        if (currentPos > 240) {
          clearInterval(driveInterval);
          setCarLane(null);
        }
      }, 50);
    }, 4200);

    return () => clearInterval(trafficInterval);
  }, []);

  const start = async () => {
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)("chicken_start", {
        _stake: stake,
        _difficulty: diff,
      });
      if (error) throw error;
      const session = (data as any)?.session;
      setSid(session);
      setActive(true);
      setRoadIndex(0);
      setCrushed(false);
      setMult(1);
      beep("bet");
      after((data as any)?.balance);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const stepForward = async () => {
    if (!sid || !active || busy) return;
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)("chicken_step", {
        _session: sid,
      });
      if (error) throw error;
      const res = data as any;

      if (res?.hit) {
        // Chicken was crushed by traffic!
        setCrushed(true);
        setActive(false);
        beep("explode");
        toast.error("SPLAT! A speeding car crushed the chicken!");
        after(res.balance);
      } else if (res?.payout !== undefined) {
        // Made it completely across!
        setRoadIndex(3);
        setMult(Number(res.multiplier) || 2.5);
        setActive(false);
        beep("win");
        toast.success(`Safe crossing! Cashed out ${fmt(Number(res.payout))}`);
        after(res.balance);
      } else {
        // Hopped safely to next road
        setRoadIndex((r) => Math.min(3, r + 1));
        setMult(Number(res?.multiplier) || mult + 0.4);
        beep("step");
      }
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const cash = async () => {
    if (!sid || !active || busy || roadIndex === 0) return;
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)("chicken_cashout", {
        _session: sid,
      });
      if (error) throw error;
      const res = data as any;
      setActive(false);
      beep("cashout");
      toast.success(`${t("game.cashed_out")} ${fmt(Number(res?.payout))}`);
      after(res.balance);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const currentPayout = Math.floor(stake * mult);

  return (
    <div className="space-y-4 font-sans">
      {/* Chicken Road 2 Top Highway Scene */}
      <Card className="relative overflow-hidden p-0 border-border/60 bg-[#121214] shadow-xl">
        {/* Status header */}
        <div className="flex items-center justify-between border-b border-border/40 bg-black/40 px-4 py-2 text-xs">
          <span className="font-bold flex items-center gap-1.5 text-foreground">
            <span className="text-base">🐔</span> Chicken Road 2.0
          </span>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">
              Road: <strong className="text-foreground">{roadIndex}/3</strong>
            </span>
            <span className="font-display font-black text-amber-400 text-sm">
              {mult.toFixed(2)}×
            </span>
          </div>
        </div>

        {/* 3 Highway Roads Layout */}
        <div className="relative h-64 sm:h-72 w-full grid grid-cols-4 bg-[#1e2024] p-2 select-none overflow-hidden">
          {/* Starting Sidewalk (Zone 0) */}
          <div className="relative border-r-2 border-emerald-500/40 bg-gradient-to-b from-emerald-950/20 to-emerald-900/10 flex flex-col items-center justify-center p-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-auto">
              Start
            </span>
            {roadIndex === 0 && (
              <div className="my-auto transition-transform duration-200">
                <RealisticWhiteChicken crushed={crushed} />
              </div>
            )}
            <span className="text-[9px] text-muted-foreground/60 mt-auto">Sidewalk</span>
          </div>

          {/* Road 1 (Highway Lane 1) */}
          <div className="relative border-r border-dashed border-yellow-400/40 bg-[#16171a] flex flex-col items-center justify-center">
            <span className="absolute top-2 text-[10px] font-mono font-bold text-amber-300/80 bg-black/50 px-2 py-0.5 rounded-full border border-amber-400/20">
              1.45x
            </span>

            {/* Random Traffic Car on Road 1 */}
            {carLane === 1 && (
              <div
                className="absolute transition-all duration-75"
                style={{ top: `${carOffset}px` }}
              >
                <HighwayCar color="#EF4444" direction="down" />
              </div>
            )}

            {roadIndex === 1 && (
              <div className="my-auto transition-transform duration-200">
                <RealisticWhiteChicken crushed={crushed} />
              </div>
            )}
            <span className="absolute bottom-2 text-[9px] text-muted-foreground/40 font-mono">LANE 1</span>
          </div>

          {/* Road 2 (Highway Lane 2) */}
          <div className="relative border-r border-dashed border-yellow-400/40 bg-[#18191c] flex flex-col items-center justify-center">
            <span className="absolute top-2 text-[10px] font-mono font-bold text-amber-300/80 bg-black/50 px-2 py-0.5 rounded-full border border-amber-400/20">
              2.10x
            </span>

            {/* Random Traffic Car on Road 2 */}
            {carLane === 2 && (
              <div
                className="absolute transition-all duration-75"
                style={{ top: `${carOffset}px` }}
              >
                <HighwayCar color="#3B82F6" direction="down" />
              </div>
            )}

            {roadIndex === 2 && (
              <div className="my-auto transition-transform duration-200">
                <RealisticWhiteChicken crushed={crushed} />
              </div>
            )}
            <span className="absolute bottom-2 text-[9px] text-muted-foreground/40 font-mono">LANE 2</span>
          </div>

          {/* Road 3 (Highway Lane 3 / Goal Zone) */}
          <div className="relative bg-[#1a1b1f] flex flex-col items-center justify-center">
            <span className="absolute top-2 text-[10px] font-mono font-bold text-emerald-400 bg-black/50 px-2 py-0.5 rounded-full border border-emerald-400/30">
              3.50x
            </span>

            {/* Random Traffic Car on Road 3 */}
            {carLane === 3 && (
              <div
                className="absolute transition-all duration-75"
                style={{ top: `${carOffset}px` }}
              >
                <HighwayCar color="#EAB308" direction="down" />
              </div>
            )}

            {roadIndex === 3 && (
              <div className="my-auto transition-transform duration-200">
                <RealisticWhiteChicken crushed={crushed} />
              </div>
            )}
            <span className="absolute bottom-2 text-[9px] text-emerald-400/80 font-bold">FINISH</span>
          </div>
        </div>
      </Card>

      {/* Betting & Difficulty Controls */}
      <Card className="space-y-3 p-4 bg-card/90">
        <StakeInput
          value={stake}
          onChange={setStake}
          min={game.min_stake}
          max={game.max_stake}
          disabled={active}
        />

        {/* Difficulty Selection */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Difficulty Mode</span>
            <span className="text-[10px] uppercase font-bold text-muted-foreground">
              Higher risk = Bigger multiplier
            </span>
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {CHICKEN_DIFFS.map((d) => (
              <button
                key={d.id}
                type="button"
                disabled={active}
                onClick={() => setDiff(d.id)}
                className={cn(
                  "rounded-xl py-2 text-xs font-bold transition active:scale-95",
                  diff === d.id
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Controls */}
        {active ? (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={stepForward}
              disabled={busy || crushed}
              className="h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-display text-sm font-black tracking-wide shadow-lg shadow-emerald-600/20 hover:brightness-110 active:scale-98 transition flex items-center justify-center gap-1.5"
            >
              CROSS ROAD 🐔
            </button>
            <button
              type="button"
              onClick={cash}
              disabled={busy || roadIndex === 0 || crushed}
              className="h-12 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-display text-sm font-black tracking-wide shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-98 transition"
            >
              CASH OUT ({fmt(currentPayout)})
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={start}
            disabled={busy}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-display text-base font-black tracking-wide shadow-lg transition active:scale-98 hover:brightness-110"
          >
            START RUN ({fmt(stake)})
          </button>
        )}
      </Card>
    </div>
  );
}
