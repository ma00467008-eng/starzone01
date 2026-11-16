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
   3. Chicken Road 2.0
   ========================================================================= */

const CHICKEN_DIFFS = [
  { id: "easy", label: "Easy", multText: "1.25x - 3.5x" },
  { id: "medium", label: "Medium", multText: "1.45x - 5.2x" },
  { id: "hard", label: "Hard", multText: "1.90x - 8.4x" },
  { id: "hardcore", label: "Daredevil", multText: "2.80x - 15x" },
] as const;

// Big, High-Definition Realistic White Chicken SVG with Huge Expressive Eyes (Chicken Road Style)
function RealisticWhiteChicken({ crushed, hopping }: { crushed: boolean; hopping?: boolean }) {
  if (crushed) {
    return (
      <div className="relative flex flex-col items-center justify-center animate-shake z-30">
        {/* Large Splat mark with tire tread marks */}
        <div className="relative flex items-center justify-center">
          {/* Black tire skid marks across the asphalt */}
          <div className="absolute -left-10 top-1/2 -translate-y-1/2 h-3 w-18 bg-black/80 blur-[1px] rotate-12" />
          <div className="absolute -right-10 top-1/2 -translate-y-1/2 h-3 w-18 bg-black/80 blur-[1px] -rotate-12" />
          <div className="h-24 w-28 sm:h-32 sm:w-36 rounded-full bg-red-600/85 blur-[3px] animate-pulse" />
          <span className="absolute text-5xl sm:text-6xl animate-bounce">💥</span>
        </div>
        <span className="mt-2 rounded-full bg-black/90 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-red-400 border border-red-500/40 shadow-xl">
          CRUSHED! 🚗💨
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center transition-all duration-300 z-20",
        hopping ? "-translate-y-6 scale-110" : "translate-y-0 scale-100 hover:scale-105"
      )}
    >
      <svg
        viewBox="0 0 100 100"
        className="h-28 w-28 sm:h-36 sm:w-36 md:h-40 md:w-40 drop-shadow-[0_14px_28px_rgba(0,0,0,0.65)]"
        fill="none"
      >
        {/* Ground soft shadow */}
        <ellipse cx="50" cy="90" rx="30" ry="7" fill="#000000" opacity="0.45" />

        {/* Sturdy Orange Claws/Feet */}
        <path
          d="M36 74 L 28 90 M36 74 L 36 91 M36 74 L 44 90"
          stroke="#F59E0B"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M64 74 L 56 90 M64 74 L 64 91 M64 74 L 72 90"
          stroke="#F59E0B"
          strokeWidth="4.5"
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
        {/* Beak mouth slit line */}
        <line x1="70" y1="35" x2="86" y2="35" stroke="#B45309" strokeWidth="1.5" strokeLinecap="round" />

        {/* Red Wattle dangling below beak */}
        <path
          d="M68 44 C 74 46, 73 56, 67 53 C 64 51, 64 45, 68 44 Z"
          fill="#DC2626"
          stroke="#991B1B"
          strokeWidth="1.5"
        />

        {/* === ENHANCED BIG CARTOON CHICKEN ROAD EYE === */}
        {/* Outer White Eye Socket with bold black rim */}
        <circle cx="58" cy="27" r="9.5" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.4" />
        {/* Large Shiny Black Pupil */}
        <circle cx="60.5" cy="27" r="5.5" fill="#0F172A" />
        {/* Primary Large Specular Glint */}
        <circle cx="62.5" cy="24.5" r="2.2" fill="#FFFFFF" />
        {/* Secondary Catchlight Glint */}
        <circle cx="58.5" cy="29" r="1.1" fill="#FFFFFF" />
        {/* Arched Expressive Eyebrow */}
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

// Big, High-Definition Highway Supercar SVG (Top-down view, High Detail)
function HighwayCar({
  color = "#DC2626",
  accent = "#EF4444",
}: {
  color?: string;
  accent?: string;
}) {
  return (
    <div className="relative flex flex-col items-center drop-shadow-[0_16px_36px_rgba(0,0,0,0.85)] pointer-events-none">
      {/* Front Headlight Light Beams shining on the asphalt */}
      <div className="absolute -top-24 h-28 w-28 bg-gradient-to-t from-yellow-300/40 via-yellow-200/15 to-transparent blur-[8px] pointer-events-none" />

      <svg
        viewBox="0 0 70 140"
        className="h-44 w-22 sm:h-56 sm:w-28 drop-shadow-[0_12px_24px_rgba(0,0,0,0.9)]"
        fill="none"
      >
        {/* 4 Wide Performance Tires */}
        <rect x="2" y="18" width="11" height="26" rx="4" fill="#090D16" stroke="#1E293B" strokeWidth="1.5" />
        <rect x="57" y="18" width="11" height="26" rx="4" fill="#090D16" stroke="#1E293B" strokeWidth="1.5" />
        <rect x="2" y="94" width="11" height="28" rx="4" fill="#090D16" stroke="#1E293B" strokeWidth="1.5" />
        <rect x="57" y="94" width="11" height="28" rx="4" fill="#090D16" stroke="#1E293B" strokeWidth="1.5" />

        {/* Alloy Rim Details */}
        <line x1="7" y1="22" x2="7" y2="40" stroke="#475569" strokeWidth="1.5" />
        <line x1="62" y1="22" x2="62" y2="40" stroke="#475569" strokeWidth="1.5" />
        <line x1="7" y1="98" x2="7" y2="118" stroke="#475569" strokeWidth="1.5" />
        <line x1="62" y1="98" x2="62" y2="118" stroke="#475569" strokeWidth="1.5" />

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

        {/* Front Hood Vents / Splitter */}
        <path d="M22 20 L 48 20" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M26 25 L 44 25" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />

        {/* Dual High-Intensity Xenon Headlights */}
        <ellipse cx="18" cy="12" rx="4.5" ry="3.5" fill="#FEF08A" stroke="#CA8A04" strokeWidth="1.5" />
        <ellipse cx="52" cy="12" rx="4.5" ry="3.5" fill="#FEF08A" stroke="#CA8A04" strokeWidth="1.5" />
        <circle cx="18" cy="12" r="1.5" fill="#FFFFFF" />
        <circle cx="52" cy="12" r="1.5" fill="#FFFFFF" />

        {/* Front Curved Windshield with Glossy Reflection */}
        <path
          d="M16 42 C 22 36, 48 36, 54 42 L 52 64 C 44 61, 26 61, 18 64 Z"
          fill="#0B0F19"
          stroke="#334155"
          strokeWidth="2"
        />
        {/* Glass Glare Line */}
        <path d="M22 42 L 36 62" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.45" />

        {/* Side Mirrors */}
        <path d="M12 44 L 5 40 L 6 48 Z" fill="#0F172A" stroke={accent} strokeWidth="1" />
        <path d="M58 44 L 65 40 L 64 48 Z" fill="#0F172A" stroke={accent} strokeWidth="1" />

        {/* Roof Section */}
        <rect x="20" y="66" width="30" height="20" rx="3" fill="#0F172A" opacity="0.95" />
        {/* Sunroof glass */}
        <rect x="23" y="69" width="24" height="14" rx="2" fill="#1E293B" stroke="#334155" strokeWidth="1" />

        {/* Rear Window Glass */}
        <path
          d="M19 92 C 25 89, 45 89, 51 92 L 49 106 C 43 103, 27 103, 21 106 Z"
          fill="#0B0F19"
          stroke="#334155"
          strokeWidth="1.5"
        />
        <path d="M25 93 L 34 104" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />

        {/* Aggressive GT Wing / Rear Spoiler */}
        <rect x="8" y="118" width="54" height="6" rx="2" fill="#0F172A" stroke="#334155" strokeWidth="1.5" />
        <rect x="6" y="116" width="3" height="10" rx="1" fill="#475569" />
        <rect x="61" y="116" width="3" height="10" rx="1" fill="#475569" />

        {/* Dual Red LED Taillights */}
        <rect x="14" y="126" width="11" height="3.5" rx="1.5" fill="#EF4444" stroke="#B91C1C" strokeWidth="1" />
        <rect x="45" y="126" width="11" height="3.5" rx="1.5" fill="#EF4444" stroke="#B91C1C" strokeWidth="1" />

        {/* Dual Exhaust Pipes */}
        <circle cx="28" cy="132" r="2" fill="#475569" stroke="#94A3B8" strokeWidth="0.8" />
        <circle cx="42" cy="132" r="2" fill="#475569" stroke="#94A3B8" strokeWidth="0.8" />
      </svg>
    </div>
  );
}

export function ChickenGame({ game }: { game: GameRow }) {
  const { t } = useApp();
  const after = useAfterPlay();
  const [stake, setStake] = useState<number>(game.min_stake);
  const [diff, setDiff] = useState<string>("easy");
  const [sid, setSid] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);

  // Highway lanes: 0 = Start sidewalk, 1 = Road 1, 2 = Road 2, 3 = Road 3 / Finish
  const [roadIndex, setRoadIndex] = useState(0);
  const [crushed, setCrushed] = useState(false);
  const [hopping, setHopping] = useState(false);
  const [mult, setMult] = useState(1);
  const [hasStuckRound, setHasStuckRound] = useState(false);

  // Big Traffic Animation State
  const [carLane, setCarLane] = useState<number | null>(null);
  const [carY, setCarY] = useState<number>(-160);
  const [carColor, setCarColor] = useState<string>("#DC2626");

  // Restore existing active session if browser refreshed or returned
  useEffect(() => {
    let mounted = true;
    const restore = async () => {
      try {
        const saved = localStorage.getItem("sz_chicken_sid");
        if (saved && mounted) {
          setSid(saved);
          setActive(true);
          const savedLane = Number(localStorage.getItem("sz_chicken_lane") || "0");
          setRoadIndex(Math.min(3, savedLane));
          return;
        }

        // Try checking database for active chicken session
        const { data } = await supabase
          .from("game_sessions")
          .select("id, state, stake, active")
          .eq("game", "chicken")
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data?.id && mounted) {
          setSid(data.id);
          localStorage.setItem("sz_chicken_sid", data.id);
          setActive(true);
          const lane = Number((data.state as any)?.lane) || 0;
          setRoadIndex(Math.min(3, lane));
          setMult(Number((data.state as any)?.multiplier) || 1);
        }
      } catch {
        // ignore
      }
    };
    restore();
    return () => {
      mounted = false;
    };
  }, []);

  // Traffic loop: a big car zooms down every 3 to 5 seconds
  useEffect(() => {
    const CAR_COLORS = ["#DC2626", "#2563EB", "#EAB308", "#10B981", "#8B5CF6", "#EA580C"];

    const trafficInterval = setInterval(() => {
      // Pick random highway lane (1, 2, or 3)
      const targetLane = Math.floor(Math.random() * 3) + 1;
      const randomColor = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];

      setCarLane(targetLane);
      setCarColor(randomColor);
      setCarY(-180);

      let currentY = -180;
      const speed = 16 + Math.random() * 18; // High speed

      const driveInterval = setInterval(() => {
        currentY += speed;
        setCarY(currentY);
        if (currentY > 440) {
          clearInterval(driveInterval);
          setCarLane(null);
        }
      }, 40);
    }, 3800);

    return () => clearInterval(trafficInterval);
  }, []);

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
      if (session) {
        localStorage.setItem("sz_chicken_sid", session);
        localStorage.setItem("sz_chicken_lane", "0");
      }
      setActive(true);
      setRoadIndex(0);
      setCrushed(false);
      setMult(1);
      beep("bet");
      after((data as any)?.balance);
    } catch (e: any) {
      const msg = errMsg(e);
      if (msg.toLowerCase().includes("current round")) {
        setHasStuckRound(true);
        // Try to resume saved session
        const saved = localStorage.getItem("sz_chicken_sid");
        if (saved) {
          setSid(saved);
          setActive(true);
          toast.info("Resumed your active Chicken Road run!");
          return;
        }
        // Attempt automatic reset RPC if deployed
        try {
          await (supabase.rpc as any)("chicken_reset_stuck");
          toast.info("Stuck round resolved! Retrying run...");
          const retry = await (supabase.rpc as any)("chicken_start", {
            _stake: stake,
            _difficulty: diff,
          });
          if (!retry.error) {
            setSid(retry.data?.session);
            setActive(true);
            setRoadIndex(0);
            setCrushed(false);
            setMult(1);
            setHasStuckRound(false);
            after(retry.data?.balance);
            return;
          }
        } catch {
          // ignore
        }
        toast.error("Finish your current round first. Tap 'Clear Stuck Round' below.");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const stepForward = async () => {
    if (!sid || !active || busy || crushed) return;
    setBusy(true);
    setHopping(true);
    setTimeout(() => setHopping(false), 250);

    try {
      const { data, error } = await (supabase.rpc as any)("chicken_step", {
        _session: sid,
      });
      if (error) throw error;
      const res = data as any;

      if (res?.hit) {
        // Chicken got crushed by speeding car!
        setCrushed(true);
        setActive(false);
        localStorage.removeItem("sz_chicken_sid");
        localStorage.removeItem("sz_chicken_lane");
        beep("explode");
        toast.error("SPLAT! A speeding car crushed the chicken!");
        after(res.balance);
      } else if (res?.payout !== undefined) {
        // Made it completely across all lanes!
        setRoadIndex(3);
        setMult(Number(res.multiplier) || 3.5);
        setActive(false);
        localStorage.removeItem("sz_chicken_sid");
        localStorage.removeItem("sz_chicken_lane");
        beep("win");
        toast.success(`Safe crossing! Cashed out ${fmt(Number(res.payout))}`);
        after(res.balance);
      } else {
        // Hopped safely to next highway road!
        const nextRoad = Math.min(3, roadIndex + 1);
        setRoadIndex(nextRoad);
        localStorage.setItem("sz_chicken_lane", String(nextRoad));
        const newMult = Number(res?.multiplier) || mult + 0.45;
        setMult(newMult);
        beep("step");
      }
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const cash = async () => {
    if (!sid || !active || busy || crushed || roadIndex === 0) return;
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)("chicken_cashout", {
        _session: sid,
      });
      if (error) throw error;
      const res = data as any;
      setActive(false);
      localStorage.removeItem("sz_chicken_sid");
      localStorage.removeItem("sz_chicken_lane");
      beep("win");
      toast.success(`Cashed out ${fmt(Number(res?.payout || stake * mult))}`);
      after(res?.balance);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const clearStuckRound = async () => {
    setBusy(true);
    try {
      // 1. Try dedicated reset RPC
      try {
        await (supabase.rpc as any)("chicken_reset_stuck");
      } catch {
        // ignore
      }

      // 2. Try ending session if ID exists
      const saved = sid || localStorage.getItem("sz_chicken_sid");
      if (saved) {
        try {
          await (supabase.rpc as any)("chicken_cashout", { _session: saved });
        } catch {
          try {
            await (supabase.rpc as any)("chicken_step", { _session: saved });
          } catch {
            // ignore
          }
        }
      }

      localStorage.removeItem("sz_chicken_sid");
      localStorage.removeItem("sz_chicken_lane");
      setSid(null);
      setActive(false);
      setHasStuckRound(false);
      toast.success("Round reset! You can now start a new run.");
    } catch (e) {
      toast.error("Could not auto-clear. Please execute the SQL reset in Supabase.");
    } finally {
      setBusy(false);
    }
  };

  const currentPayout = Math.floor(stake * mult);

  return (
    <div className="space-y-4 font-sans">
      {/* Chicken Road 2 Top Highway Scene */}
      <Card className="relative overflow-hidden p-0 border-border/60 bg-[#101114] shadow-2xl rounded-2xl">
        {/* Status header */}
        <div className="flex items-center justify-between border-b border-border/40 bg-black/60 px-4 py-2.5 text-xs">
          <span className="font-bold flex items-center gap-2 text-foreground text-sm">
            <span className="text-xl">🐔</span> Chicken Road 2.0
          </span>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground font-medium">
              Road: <strong className="text-foreground font-bold">{roadIndex}/3</strong>
            </span>
            <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 border border-amber-500/30">
              <span className="text-[10px] uppercase font-bold text-amber-300">Win</span>
              <span className="font-display font-black text-amber-400 text-sm">
                {mult.toFixed(2)}×
              </span>
            </div>
          </div>
        </div>

        {/* 3 Highway Roads Layout with Start Sidewalk and Finish Safe Zone */}
        <div className="relative h-80 sm:h-96 md:h-[420px] w-full grid grid-cols-4 bg-[#141518] p-0 select-none overflow-hidden">
          {/* Starting Sidewalk (Zone 0) */}
          <div className="relative border-r-4 border-emerald-500/50 bg-gradient-to-b from-emerald-950/30 via-emerald-900/15 to-emerald-950/30 flex flex-col items-center justify-center p-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 mb-auto drop-shadow-sm">
              START
            </span>

            {roadIndex === 0 && (
              <div className="my-auto transition-transform duration-200">
                <RealisticWhiteChicken crushed={crushed} hopping={hopping} />
              </div>
            )}

            <div className="mt-auto text-center">
              <span className="text-[10px] font-bold text-emerald-300/70">Safe Sidewalk</span>
            </div>
          </div>

          {/* Road 1 (Highway Lane 1) */}
          <div className="relative border-r-2 border-dashed border-amber-400/50 bg-[#16171b] flex flex-col items-center justify-center">
            {/* Multiplier Badge */}
            <span className="absolute top-3 text-xs font-mono font-black text-amber-300 bg-black/70 px-2.5 py-1 rounded-full border border-amber-400/30 shadow-md">
              1.45×
            </span>

            {/* Random Traffic Car on Road 1 */}
            {carLane === 1 && (
              <div
                className="absolute z-30 pointer-events-none transition-all duration-75"
                style={{ top: `${carY}px` }}
              >
                <HighwayCar color={carColor} />
              </div>
            )}

            {roadIndex === 1 && (
              <div className="my-auto z-10 transition-transform duration-200">
                <RealisticWhiteChicken crushed={crushed} hopping={hopping} />
              </div>
            )}

            <span className="absolute bottom-3 text-[10px] text-muted-foreground/40 font-mono tracking-widest font-black">
              LANE 1
            </span>
          </div>

          {/* Road 2 (Highway Lane 2) */}
          <div className="relative border-r-2 border-dashed border-amber-400/50 bg-[#181a1e] flex flex-col items-center justify-center">
            {/* Multiplier Badge */}
            <span className="absolute top-3 text-xs font-mono font-black text-amber-300 bg-black/70 px-2.5 py-1 rounded-full border border-amber-400/30 shadow-md">
              2.10×
            </span>

            {/* Random Traffic Car on Road 2 */}
            {carLane === 2 && (
              <div
                className="absolute z-30 pointer-events-none transition-all duration-75"
                style={{ top: `${carY}px` }}
              >
                <HighwayCar color={carColor} />
              </div>
            )}

            {roadIndex === 2 && (
              <div className="my-auto z-10 transition-transform duration-200">
                <RealisticWhiteChicken crushed={crushed} hopping={hopping} />
              </div>
            )}

            <span className="absolute bottom-3 text-[10px] text-muted-foreground/40 font-mono tracking-widest font-black">
              LANE 2
            </span>
          </div>

          {/* Road 3 (Highway Lane 3 / Finish Zone) */}
          <div className="relative bg-gradient-to-b from-[#1b1d22] via-[#1a1f1b] to-[#1b1d22] flex flex-col items-center justify-center border-l-2 border-emerald-500/40">
            {/* Multiplier Badge */}
            <span className="absolute top-3 text-xs font-mono font-black text-emerald-400 bg-black/70 px-2.5 py-1 rounded-full border border-emerald-400/40 shadow-md">
              3.50×
            </span>

            {/* Random Traffic Car on Road 3 */}
            {carLane === 3 && (
              <div
                className="absolute z-30 pointer-events-none transition-all duration-75"
                style={{ top: `${carY}px` }}
              >
                <HighwayCar color={carColor} />
              </div>
            )}

            {roadIndex === 3 && (
              <div className="my-auto z-10 transition-transform duration-200">
                <RealisticWhiteChicken crushed={crushed} hopping={hopping} />
              </div>
            )}

            <span className="absolute bottom-3 text-[10px] text-emerald-400/90 font-black tracking-widest">
              FINISH LINE 🏁
            </span>
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
            Clear Stuck Round
          </button>
        </Card>
      )}

      {/* Betting & Difficulty Controls */}
      <Card className="space-y-3.5 p-4 bg-card/90 shadow-lg">
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
            <span className="font-semibold">Difficulty Mode</span>
            <span className="text-[10px] uppercase font-bold text-muted-foreground">
              Higher Risk = Huge Multipliers
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
                  "rounded-xl py-2 px-1 text-xs font-bold transition active:scale-95 flex flex-col items-center justify-center",
                  diff === d.id
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 ring-2 ring-primary/40"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
                )}
              >
                <span>{d.label}</span>
                <span className="text-[9px] opacity-75 font-normal">{d.multText}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Action Controls */}
        {active ? (
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={stepForward}
              disabled={busy || crushed}
              className="h-14 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-white font-display text-base font-black tracking-wider shadow-lg shadow-emerald-600/30 hover:brightness-110 active:scale-98 transition flex items-center justify-center gap-2 border border-emerald-400/30"
            >
              <span>CROSS ROAD</span>
              <span className="text-xl">🐔</span>
            </button>
            <button
              type="button"
              onClick={cash}
              disabled={busy || roadIndex === 0 || crushed}
              className="h-14 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white font-display text-base font-black tracking-wider shadow-lg shadow-amber-500/30 hover:brightness-110 active:scale-98 transition border border-amber-400/30"
            >
              CASH OUT ({fmt(currentPayout)})
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={start}
            disabled={busy}
            className="w-full h-13 rounded-xl bg-gradient-to-r from-primary via-accent to-primary text-primary-foreground font-display text-base font-black tracking-wide shadow-xl shadow-primary/20 transition active:scale-98 hover:brightness-110 border border-primary/40"
          >
            START RUN ({fmt(stake)})
          </button>
        )}
      </Card>
    </div>
  );
}
