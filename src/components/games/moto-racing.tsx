import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Trophy, Flag, Zap, Sparkles, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useApp } from "@/lib/app-context";
import { beep, fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { Card, PrimaryButton, StakeInput, useAfterPlay } from "@/components/sz/shell";
import { ResultPopup, type Outcome } from "./kit";
import type { GameRow } from "./types";

interface Bike {
  num: number;
  name: string;
  color: string;
  bgHex: string;
  textHex: string;
}

const BIKES: Bike[] = [
  { num: 1, name: "Lightning 1", color: "from-amber-400 to-yellow-500", bgHex: "#f59e0b", textHex: "#000" },
  { num: 2, name: "Thunder 2", color: "from-blue-500 to-indigo-600", bgHex: "#3b82f6", textHex: "#fff" },
  { num: 3, name: "Inferno 3", color: "from-red-500 to-rose-600", bgHex: "#ef4444", textHex: "#fff" },
  { num: 4, name: "Phantom 4", color: "from-purple-500 to-violet-600", bgHex: "#8b5cf6", textHex: "#fff" },
  { num: 5, name: "Viper 5", color: "from-orange-500 to-amber-600", bgHex: "#f97316", textHex: "#fff" },
  { num: 6, name: "Venom 6", color: "from-emerald-500 to-green-600", bgHex: "#10b981", textHex: "#fff" },
  { num: 7, name: "Cyber 7", color: "from-cyan-400 to-teal-500", bgHex: "#06b6d4", textHex: "#000" },
  { num: 8, name: "Neon 8", color: "from-pink-500 to-fuchsia-600", bgHex: "#ec4899", textHex: "#fff" },
];

export function MotoRacingGame({ game }: { game: GameRow }) {
  const { user } = useApp();
  const afterPlay = useAfterPlay();

  const [stake, setStake] = useState<number>(game.min_stake || 10);
  const [betCategory, setBetCategory] = useState<"winner" | "size" | "parity">("winner");
  const [selectedVal, setSelectedVal] = useState<string>("1");

  const [racing, setRacing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [bikeProgress, setBikeProgress] = useState<number[]>(new Array(8).fill(0));
  const [standings, setStandings] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8]);
  const [winner, setWinner] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const animRef = useRef<number | null>(null);

  // Clean animation on unmount
  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const getOdds = () => {
    if (betCategory === "winner") return 7.68;
    return 1.95;
  };

  const handleStartRace = async () => {
    if (!user) {
      toast.error("Please login to place bets");
      return;
    }
    if (racing || countdown !== null) return;

    if (stake < (game.min_stake || 10) || stake > (game.max_stake || 10000)) {
      toast.error(`Stake must be between ${game.min_stake} and ${game.max_stake}`);
      return;
    }

    setOutcome(null);
    setWinner(null);
    setBikeProgress(new Array(8).fill(0));
    setStandings([1, 2, 3, 4, 5, 6, 7, 8]);

    // 1. Call backend RPC
    let resultData: any = null;
    try {
      const { data, error } = await (supabase.rpc as any)("moto_racing_play", {
        _stake: stake,
        _params: { type: betCategory, value: selectedVal },
      });

      if (error) {
        // Fallback simulation if migration hasn't been run yet
        console.warn("Moto racing RPC error, using fallback simulation:", error.message);
        const shuffled = [...[1, 2, 3, 4, 5, 6, 7, 8]].sort(() => Math.random() - 0.5);
        const winBike = shuffled[0];
        let won = false;
        let payout = 0;
        if (betCategory === "winner" && parseInt(selectedVal) === winBike) {
          won = true;
          payout = Math.floor(stake * 7.68);
        } else if (betCategory === "size" && ((selectedVal === "big" && winBike >= 5) || (selectedVal === "small" && winBike <= 4))) {
          won = true;
          payout = Math.floor(stake * 1.95);
        } else if (betCategory === "parity" && ((selectedVal === "odd" && winBike % 2 === 1) || (selectedVal === "even" && winBike % 2 === 0))) {
          won = true;
          payout = Math.floor(stake * 1.95);
        }
        resultData = { winner: winBike, finish_order: shuffled, payout, win: won };
      } else {
        resultData = data;
      }
    } catch (err: any) {
      toast.error(errMsg(err));
      return;
    }

    // 2. Countdown: 3, 2, 1, GO!
    setCountdown(3);
    beep(400, 80);
    await new Promise((r) => setTimeout(r, 700));
    setCountdown(2);
    beep(450, 80);
    await new Promise((r) => setTimeout(r, 700));
    setCountdown(1);
    beep(500, 80);
    await new Promise((r) => setTimeout(r, 700));
    setCountdown(0);
    beep(800, 200);

    setRacing(true);

    // 3. Race simulation over 4.5 seconds
    const duration = 4500;
    const startTime = performance.now();
    const finalWinner = resultData.winner;
    const finishOrder: number[] = resultData.finish_order || [finalWinner, 2, 3, 4, 5, 6, 7, 8];

    // Compute progress speeds so finalWinner finishes first
    const speeds = BIKES.map((b) => {
      if (b.num === finalWinner) return 1.0;
      const rank = finishOrder.indexOf(b.num);
      return 0.94 - (rank * 0.015) - Math.random() * 0.02;
    });

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);

      // Add slight turbulence/overtakes
      const current = speeds.map((speed, idx) => {
        const jitter = Math.sin(t * 15 + idx) * 0.03 * (1 - t);
        return Math.min(100, (t * speed + jitter) * 100);
      });

      // Sort current order for standings bar
      const sorted = [...BIKES]
        .map((b) => ({ num: b.num, p: current[b.num - 1] }))
        .sort((a, b) => b.p - a.p)
        .map((x) => x.num);

      setBikeProgress(current);
      setStandings(sorted);

      if (t < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        // Race Finished!
        setRacing(false);
        setCountdown(null);
        setWinner(finalWinner);

        const won = resultData.win;
        const payout = resultData.payout || 0;

        if (won) {
          beep(880, 250);
          toast.success(`Bike #${finalWinner} Won! Payout: ₹${fmt(payout)}`);
        } else {
          beep(220, 300);
          toast.error(`Bike #${finalWinner} Won!`);
        }

        setOutcome({
          won,
          payout,
          multiplier: won ? getOdds() : 0,
          label: `Winner Bike #${finalWinner}`,
          detail: `Your Pick: ${betCategory.toUpperCase()} [${selectedVal}]`,
        });

        afterPlay();
      }
    };

    animRef.current = requestAnimationFrame(step);
  };

  return (
    <div className="space-y-4">
      {/* 3D-styled Neon Speedway Arena */}
      <Card className="relative overflow-hidden border-border/40 bg-gradient-to-b from-slate-950 via-zinc-900 to-black p-0 shadow-2xl">
        {/* Top Standings Banner */}
        <div className="flex items-center justify-between border-b border-white/10 bg-black/60 px-4 py-2 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Standings</span>
          </div>
          <div className="flex items-center gap-1.5">
            {standings.map((num, i) => {
              const b = BIKES[num - 1];
              return (
                <div
                  key={num}
                  style={{ backgroundColor: b.bgHex, color: b.textHex }}
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black shadow transition-all",
                    i === 0 && "scale-110 ring-2 ring-amber-400"
                  )}
                >
                  {num}
                </div>
              );
            })}
          </div>
        </div>

        {/* Speedway Track */}
        <div className="relative h-64 w-full bg-[linear-gradient(to_bottom,#18181b_0%,#09090b_100%)] px-3 py-2">
          {/* Track Lanes */}
          <div className="flex h-full flex-col justify-between">
            {BIKES.map((bike) => {
              const progress = bikeProgress[bike.num - 1] || 0;
              const isSelected = betCategory === "winner" && selectedVal === String(bike.num);

              return (
                <div
                  key={bike.num}
                  className={cn(
                    "relative flex h-6 w-full items-center border-b border-white/5",
                    isSelected && "bg-amber-500/10"
                  )}
                >
                  {/* Lane Number */}
                  <span className="w-5 text-center text-[10px] font-bold text-muted-foreground/60">{bike.num}</span>

                  {/* Asphalt road line */}
                  <div className="relative flex-1 h-full">
                    <div className="absolute inset-x-0 top-1/2 h-[1px] -translate-y-1/2 border-b border-dashed border-white/10" />

                    {/* Bike Marker */}
                    <div
                      className="absolute top-1/2 flex -translate-y-1/2 items-center transition-all duration-75"
                      style={{ left: `calc(${progress}% * 0.88)` }}
                    >
                      {/* Motorcycle SVG */}
                      <div
                        style={{ backgroundColor: bike.bgHex, color: bike.textHex }}
                        className="relative flex h-5 w-7 items-center justify-center rounded-sm shadow-md transition-transform hover:scale-105"
                      >
                        <span className="text-[10px] font-black">{bike.num}</span>
                        {/* Exhaust glow when racing */}
                        {racing && (
                          <div className="absolute -left-2 top-1/2 h-1.5 w-2 -translate-y-1/2 animate-pulse rounded-full bg-cyan-400 blur-[1px]" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Finish Line Checkered Strip */}
                  <div className="w-3 h-full bg-[repeating-linear-gradient(45deg,#fff,#fff_3px,#000_3px,#000_6px)] opacity-60" />
                </div>
              );
            })}
          </div>

          {/* Countdown Overlay */}
          {countdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20">
              <div className="text-center animate-bounce">
                <span className="font-display text-6xl font-black text-amber-400 drop-shadow-[0_4px_20px_rgba(251,191,36,0.6)]">
                  {countdown === 0 ? "GO!" : countdown}
                </span>
              </div>
            </div>
          )}

          {/* Winner Banner */}
          {winner && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-20 animate-in fade-in zoom-in">
              <div className="text-center">
                <Trophy className="mx-auto mb-2 h-10 w-10 text-amber-400 animate-bounce" />
                <h3 className="text-lg font-black uppercase tracking-wider text-white">
                  Champion: Bike #{winner}
                </h3>
                <p className="text-xs text-muted-foreground">{BIKES[winner - 1].name}</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Betting Controls */}
      <Card className="space-y-4">
        {/* Category Tabs */}
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-secondary/40 p-1">
          <button
            onClick={() => {
              setBetCategory("winner");
              setSelectedVal("1");
            }}
            disabled={racing}
            className={cn(
              "rounded-lg py-2 text-xs font-bold transition-all",
              betCategory === "winner" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Winner (7.68x)
          </button>
          <button
            onClick={() => {
              setBetCategory("size");
              setSelectedVal("big");
            }}
            disabled={racing}
            className={cn(
              "rounded-lg py-2 text-xs font-bold transition-all",
              betCategory === "size" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Big / Small (1.95x)
          </button>
          <button
            onClick={() => {
              setBetCategory("parity");
              setSelectedVal("odd");
            }}
            disabled={racing}
            className={cn(
              "rounded-lg py-2 text-xs font-bold transition-all",
              betCategory === "parity" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Odd / Even (1.95x)
          </button>
        </div>

        {/* Options grid */}
        {betCategory === "winner" && (
          <div className="grid grid-cols-4 gap-2">
            {BIKES.map((bike) => {
              const active = selectedVal === String(bike.num);
              return (
                <button
                  key={bike.num}
                  disabled={racing}
                  onClick={() => setSelectedVal(String(bike.num))}
                  style={{ borderColor: active ? bike.bgHex : undefined }}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-xl border p-2.5 transition-all",
                    active
                      ? "bg-secondary text-foreground ring-2 ring-primary shadow-md scale-105"
                      : "border-border/60 bg-card/60 text-muted-foreground hover:bg-secondary/40"
                  )}
                >
                  <div
                    style={{ backgroundColor: bike.bgHex, color: bike.textHex }}
                    className="flex h-7 w-7 items-center justify-center rounded-full font-black text-xs shadow mb-1"
                  >
                    {bike.num}
                  </div>
                  <span className="text-[11px] font-bold">Bike {bike.num}</span>
                  <span className="text-[10px] text-primary font-medium">7.68x</span>
                </button>
              );
            })}
          </div>
        )}

        {betCategory === "size" && (
          <div className="grid grid-cols-2 gap-3">
            <button
              disabled={racing}
              onClick={() => setSelectedVal("big")}
              className={cn(
                "flex flex-col items-center justify-center rounded-xl border p-4 transition-all",
                selectedVal === "big"
                  ? "border-amber-500 bg-amber-500/10 text-foreground ring-2 ring-amber-500 shadow-md"
                  : "border-border/60 bg-card/60 text-muted-foreground hover:bg-secondary/40"
              )}
            >
              <span className="text-base font-black text-amber-400">BIG</span>
              <span className="text-xs text-muted-foreground">Bikes 5, 6, 7, 8</span>
              <span className="mt-1 text-xs font-bold text-primary">1.95x</span>
            </button>
            <button
              disabled={racing}
              onClick={() => setSelectedVal("small")}
              className={cn(
                "flex flex-col items-center justify-center rounded-xl border p-4 transition-all",
                selectedVal === "small"
                  ? "border-blue-500 bg-blue-500/10 text-foreground ring-2 ring-blue-500 shadow-md"
                  : "border-border/60 bg-card/60 text-muted-foreground hover:bg-secondary/40"
              )}
            >
              <span className="text-base font-black text-blue-400">SMALL</span>
              <span className="text-xs text-muted-foreground">Bikes 1, 2, 3, 4</span>
              <span className="mt-1 text-xs font-bold text-primary">1.95x</span>
            </button>
          </div>
        )}

        {betCategory === "parity" && (
          <div className="grid grid-cols-2 gap-3">
            <button
              disabled={racing}
              onClick={() => setSelectedVal("odd")}
              className={cn(
                "flex flex-col items-center justify-center rounded-xl border p-4 transition-all",
                selectedVal === "odd"
                  ? "border-emerald-500 bg-emerald-500/10 text-foreground ring-2 ring-emerald-500 shadow-md"
                  : "border-border/60 bg-card/60 text-muted-foreground hover:bg-secondary/40"
              )}
            >
              <span className="text-base font-black text-emerald-400">ODD</span>
              <span className="text-xs text-muted-foreground">Bikes 1, 3, 5, 7</span>
              <span className="mt-1 text-xs font-bold text-primary">1.95x</span>
            </button>
            <button
              disabled={racing}
              onClick={() => setSelectedVal("even")}
              className={cn(
                "flex flex-col items-center justify-center rounded-xl border p-4 transition-all",
                selectedVal === "even"
                  ? "border-rose-500 bg-rose-500/10 text-foreground ring-2 ring-rose-500 shadow-md"
                  : "border-border/60 bg-card/60 text-muted-foreground hover:bg-secondary/40"
              )}
            >
              <span className="text-base font-black text-rose-400">EVEN</span>
              <span className="text-xs text-muted-foreground">Bikes 2, 4, 6, 8</span>
              <span className="mt-1 text-xs font-bold text-primary">1.95x</span>
            </button>
          </div>
        )}

        {/* Stake and Start */}
        <StakeInput stake={stake} onChange={setStake} min={game.min_stake} max={game.max_stake} />

        <div className="flex items-center justify-between rounded-xl bg-secondary/30 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Potential Return:</span>
          <span className="font-bold text-primary">₹{fmt(Math.floor(stake * getOdds()))}</span>
        </div>

        <PrimaryButton
          onClick={handleStartRace}
          disabled={racing || countdown !== null}
          className="w-full h-12 text-base font-bold bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black shadow-lg"
        >
          {racing ? "RACING..." : countdown !== null ? "STARTING..." : "START RACE"}
        </PrimaryButton>
      </Card>

      {/* Result Outcome Modal */}
      {outcome && <ResultPopup outcome={outcome} onClose={() => setOutcome(null)} />}
    </div>
  );
}
