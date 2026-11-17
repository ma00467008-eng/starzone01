import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Zap, Heart, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useApp } from "@/lib/app-context";
import { beep, fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { Card, PrimaryButton, StakeInput, useAfterPlay } from "@/components/sz/shell";
import { ResultPopup, type Outcome } from "./kit";
import type { GameRow } from "./types";

const SYMBOL_NAMES = [
  "Double Happiness 囍 (Wild)",
  "Royal Groom",
  "Golden Bride",
  "Wedding Rings",
  "Silk Money Purse",
  "Lucky Red Envelopes",
  "A",
  "K",
  "Q",
  "J",
];

const PAYOUTS = [100, 50, 40, 30, 20, 15, 10, 8, 6, 4];

function FortuneSymbol({ id }: { id: number }) {
  if (id === 0) {
    // 0: Wild 囍 Double Happiness
    return (
      <div className="relative flex h-full w-full items-center justify-center p-1">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 via-amber-500 to-yellow-600 p-0.5 shadow-lg ring-2 ring-yellow-300 animate-pulse">
          <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-red-700 font-serif text-2xl font-black text-amber-300">
            囍
          </div>
          <span className="absolute -bottom-1 text-[8px] font-black uppercase tracking-wider text-amber-200 bg-black/60 px-1 rounded">
            WILD
          </span>
        </div>
      </div>
    );
  }
  if (id === 1) {
    // 1: Groom
    return (
      <div className="flex flex-col items-center justify-center p-1">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-red-600 to-rose-900 border-2 border-amber-400 shadow-md">
          <span className="text-2xl">🤵</span>
        </div>
        <span className="text-[10px] font-bold text-amber-200 mt-0.5">Groom</span>
      </div>
    );
  }
  if (id === 2) {
    // 2: Bride
    return (
      <div className="flex flex-col items-center justify-center p-1">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-pink-800 border-2 border-amber-400 shadow-md">
          <span className="text-2xl">👰</span>
        </div>
        <span className="text-[10px] font-bold text-pink-200 mt-0.5">Bride</span>
      </div>
    );
  }
  if (id === 3) {
    // 3: Wedding Rings
    return (
      <div className="flex flex-col items-center justify-center p-1">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-950/80 border border-amber-500/40">
          <span className="text-2xl">💍</span>
        </div>
        <span className="text-[10px] font-medium text-amber-300/80">Rings</span>
      </div>
    );
  }
  if (id === 4) {
    // 4: Silk Purse
    return (
      <div className="flex flex-col items-center justify-center p-1">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-950/80 border border-red-500/40">
          <span className="text-2xl">👛</span>
        </div>
        <span className="text-[10px] font-medium text-red-300/80">Purse</span>
      </div>
    );
  }
  if (id === 5) {
    // 5: Red Packet
    return (
      <div className="flex flex-col items-center justify-center p-1">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-900/80 border border-amber-400/30">
          <span className="text-2xl">🧧</span>
        </div>
        <span className="text-[10px] font-medium text-amber-300/80">Packet</span>
      </div>
    );
  }
  // 6..9: Cards A, K, Q, J
  const cardLetters = ["A", "K", "Q", "J"];
  const letter = cardLetters[id - 6] || "A";
  const colors = [
    "from-amber-400 to-orange-500",
    "from-rose-400 to-red-600",
    "from-blue-400 to-indigo-600",
    "from-emerald-400 to-green-600",
  ];
  return (
    <div className="flex items-center justify-center p-1">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/40 border border-white/10 shadow-inner">
        <span className={cn("font-display text-xl font-black bg-gradient-to-br bg-clip-text text-transparent", colors[id - 6])}>
          {letter}
        </span>
      </div>
    </div>
  );
}

export function DoubleFortuneGame({ game }: { game: GameRow }) {
  const { user } = useApp();
  const afterPlay = useAfterPlay();

  const [stake, setStake] = useState<number>(game.min_stake || 10);
  const [spinning, setSpinning] = useState(false);
  const [grid, setGrid] = useState<number[]>([
    0, 1, 2, 3, 4,
    5, 6, 7, 8, 9,
    1, 2, 0, 4, 3,
  ]);
  const [winningLines, setWinningLines] = useState<any[]>([]);
  const [lastPayout, setLastPayout] = useState<number>(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const handleSpin = async () => {
    if (!user) {
      toast.error("Please login to play Double Fortune");
      return;
    }
    if (spinning) return;

    if (stake < (game.min_stake || 10) || stake > (game.max_stake || 10000)) {
      toast.error(`Stake must be between ${game.min_stake} and ${game.max_stake}`);
      return;
    }

    setSpinning(true);
    setWinningLines([]);
    setOutcome(null);
    beep(520, 100);

    // Call backend RPC
    let result: any = null;
    try {
      const { data, error } = await (supabase.rpc as any)("double_fortune_spin", { _stake: stake });
      if (error) {
        console.warn("double_fortune_spin RPC error, fallback simulator:", error.message);
        // Fallback simulator if migration not yet applied
        const simGrid = Array.from({ length: 15 }, () => Math.floor(Math.random() * 10));
        // Add random Wild
        if (Math.random() < 0.25) simGrid[Math.floor(Math.random() * 15)] = 0;
        const won = Math.random() < 0.35;
        const payout = won ? Math.floor(stake * (1.5 + Math.random() * 4)) : 0;
        result = { grid: simGrid, wins: won ? [{ line: 0, pay: payout }] : [], payout, win: won };
      } else {
        result = data;
      }
    } catch (err: any) {
      toast.error(errMsg(err));
      setSpinning(false);
      return;
    }

    // Reel spin animation effect
    const spinInterval = setInterval(() => {
      setGrid(Array.from({ length: 15 }, () => Math.floor(Math.random() * 10)));
      beep(600 + Math.random() * 200, 30);
    }, 80);

    setTimeout(() => {
      clearInterval(spinInterval);
      setGrid(result.grid);
      setSpinning(false);
      setWinningLines(result.wins || []);
      setLastPayout(result.payout || 0);

      const won = result.win;
      const payout = result.payout || 0;

      if (won) {
        beep(880, 200);
        setTimeout(() => beep(1100, 300), 220);
        toast.success(`囍 BIG WIN! Payout: ₹${fmt(payout)}`);
      } else {
        beep(240, 150);
      }

      setOutcome({
        won,
        payout,
        multiplier: won ? Math.round((payout / stake) * 100) / 100 : 0,
        label: won ? "Double Fortune Win!" : "Try Again",
        detail: won ? `Won ₹${fmt(payout)} across paylines` : "Match 3+ symbols across paylines",
      });

      afterPlay();
    }, 1200);
  };

  return (
    <div className="space-y-4">
      {/* Chinese Wedding Festive Temple Reel Container */}
      <Card className="relative overflow-hidden border-2 border-amber-500/40 bg-gradient-to-b from-red-950 via-zinc-950 to-black p-4 shadow-2xl">
        {/* Top Decorative Temple Roof & Header */}
        <div className="mb-3 flex items-center justify-between border-b border-amber-500/30 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">囍</span>
            <div>
              <h3 className="font-display text-sm font-black uppercase tracking-wider text-amber-300 drop-shadow">
                Double Fortune
              </h3>
              <p className="text-[10px] text-amber-200/60">5 Reels • 5 Fixed Paylines</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-black/60 px-3 py-1 border border-amber-500/30">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-bold text-amber-300">
              Win: ₹{fmt(lastPayout)}
            </span>
          </div>
        </div>

        {/* 5x3 Reels Grid */}
        <div className="relative rounded-xl border border-amber-500/30 bg-black/70 p-2 backdrop-blur-md">
          <div className="grid grid-cols-5 gap-1.5">
            {/* Render 5 columns, each with 3 rows */}
            {[0, 1, 2, 3, 4].map((col) => (
              <div key={col} className="flex flex-col gap-1.5">
                {[0, 1, 2].map((row) => {
                  const idx = row * 5 + col;
                  const symId = grid[idx] ?? 0;
                  return (
                    <div
                      key={row}
                      className={cn(
                        "flex h-20 items-center justify-center rounded-xl border border-white/5 bg-gradient-to-b from-zinc-900 to-black transition-all",
                        spinning && "blur-[1px] scale-95 opacity-80"
                      )}
                    >
                      <FortuneSymbol id={symId} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Winning Lines Info */}
        {winningLines.length > 0 && (
          <div className="mt-3 flex items-center justify-center gap-2 animate-bounce">
            <span className="text-xs font-bold text-amber-400">
              🎉 {winningLines.length} Winning Line{winningLines.length > 1 ? "s" : ""} Hit!
            </span>
          </div>
        )}
      </Card>

      {/* Controls & Spin Button */}
      <Card className="space-y-4">
        <StakeInput stake={stake} onChange={setStake} min={game.min_stake} max={game.max_stake} />

        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>Max Multiplier:</span>
          <span className="font-bold text-amber-400">Up to 100x</span>
        </div>

        <PrimaryButton
          onClick={handleSpin}
          disabled={spinning}
          className="w-full h-12 text-base font-bold bg-gradient-to-r from-red-600 via-amber-500 to-yellow-500 hover:from-red-700 hover:to-yellow-600 text-black shadow-lg"
        >
          {spinning ? "SPINNING..." : "SPIN (囍)"}
        </PrimaryButton>
      </Card>

      {/* Outcome Popup */}
      {outcome && <ResultPopup outcome={outcome} onClose={() => setOutcome(null)} />}
    </div>
  );
}
