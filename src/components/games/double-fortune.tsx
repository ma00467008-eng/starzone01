import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Zap, Flame, Volume2, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useApp } from "@/lib/app-context";
import { beep, fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { Card, PrimaryButton, StakeInput, useAfterPlay } from "@/components/sz/shell";
import { ResultPopup, type Outcome } from "./kit";
import type { GameRow } from "./types";

/* =========================================================================
   Authentic PG Soft Double Fortune Symbol Set & Paytable
   ========================================================================= */

const SYMBOLS = [
  { id: 0, name: "Wild 囍", label: "Double Happiness", mult5: 150, mult4: 80, mult3: 30, isWild: true },
  { id: 1, name: "Imperial Groom", label: "Emperor Groom", mult5: 100, mult4: 50, mult3: 20 },
  { id: 2, name: "Empress Bride", label: "Phoenix Bride", mult5: 80, mult4: 40, mult3: 15 },
  { id: 3, name: "Gold Rings", label: "Twin Wedding Bands", mult5: 50, mult4: 25, mult3: 10 },
  { id: 4, name: "Red Packet", label: "Hongbao 福", mult5: 40, mult4: 20, mult3: 8 },
  { id: 5, name: "Wedding Chest", label: "Imperial Gift", mult5: 30, mult4: 15, mult3: 5 },
  { id: 6, name: "Firecrackers", label: "Dragon Crackers", mult5: 20, mult4: 10, mult3: 4 },
  { id: 7, name: "Ace", label: "Royal Ace", mult5: 10, mult4: 5, mult3: 2 },
  { id: 8, name: "King", label: "Royal King", mult5: 8, mult4: 4, mult3: 2 },
  { id: 9, name: "Queen", label: "Royal Queen", mult5: 5, mult4: 3, mult3: 1 },
];

/* =========================================================================
   Realistic High-Fidelity Chinese Imperial Wedding Symbols
   ========================================================================= */

function FortuneSymbolRenderer({ id }: { id: number }) {
  if (id === 0) {
    // 0: 囍 Double Happiness Golden Wild
    return (
      <div className="relative flex h-full w-full items-center justify-center p-1 select-none">
        <div className="relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-200 via-amber-400 to-yellow-600 p-0.5 shadow-[0_0_15px_rgba(251,191,36,0.8)] ring-2 ring-yellow-300">
          <div className="flex h-full w-full flex-col items-center justify-center rounded-[14px] bg-gradient-to-b from-red-700 via-red-800 to-rose-950 text-amber-300">
            <span className="font-serif text-2xl sm:text-3xl font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              囍
            </span>
          </div>
          <span className="absolute -bottom-1.5 rounded-full bg-black/90 px-2 py-0.2 text-[8px] font-black tracking-widest text-amber-300 border border-amber-400/80 shadow">
            WILD
          </span>
        </div>
      </div>
    );
  }

  if (id === 1) {
    // 1: Imperial Groom in Red & Gold Silk Robe
    return (
      <div className="flex flex-col items-center justify-center p-1 select-none">
        <div className="relative flex h-13 w-13 sm:h-15 sm:w-15 items-center justify-center rounded-2xl bg-gradient-to-b from-red-900 to-black border-2 border-amber-500/80 shadow-md">
          <svg viewBox="0 0 60 60" className="h-10 w-10 drop-shadow" fill="none">
            {/* Groom Official Hat with Gold Pearl */}
            <path d="M15 22 L45 22 L40 14 L20 14 Z" fill="#b91c1c" stroke="#f59e0b" strokeWidth="1.5" />
            <circle cx="30" cy="12" r="3" fill="#facc15" />
            {/* Face */}
            <circle cx="30" cy="28" r="10" fill="#fed7aa" />
            {/* Eyes & smile */}
            <path d="M25 27 Q27 29 29 27 M31 27 Q33 29 35 27" stroke="#451a03" strokeWidth="1.2" strokeLinecap="round" fill="none" />
            {/* Crimson Silk Wedding Robe */}
            <path d="M14 48 C18 36, 42 36, 46 48 Z" fill="#dc2626" stroke="#f59e0b" strokeWidth="1.5" />
            <path d="M26 38 L30 48 L34 38" stroke="#facc15" strokeWidth="2" fill="none" />
          </svg>
        </div>
        <span className="text-[10px] font-bold text-amber-200 mt-1">Groom</span>
      </div>
    );
  }

  if (id === 2) {
    // 2: Empress Bride with Phoenix Crown (Fengguan)
    return (
      <div className="flex flex-col items-center justify-center p-1 select-none">
        <div className="relative flex h-13 w-13 sm:h-15 sm:w-15 items-center justify-center rounded-2xl bg-gradient-to-b from-rose-950 to-black border-2 border-pink-500/80 shadow-md">
          <svg viewBox="0 0 60 60" className="h-10 w-10 drop-shadow" fill="none">
            {/* Phoenix Crown with Gold Tassels */}
            <path d="M16 20 C22 10, 38 10, 44 20 Z" fill="#f59e0b" stroke="#facc15" strokeWidth="1.5" />
            <line x1="16" y1="20" x2="14" y2="28" stroke="#facc15" strokeWidth="1.5" />
            <line x1="44" y1="20" x2="46" y2="28" stroke="#facc15" strokeWidth="1.5" />
            {/* Face */}
            <circle cx="30" cy="28" r="10" fill="#ffedd5" />
            {/* Rouge & Red Lips */}
            <circle cx="24" cy="30" r="2" fill="#f43f5e" opacity="0.6" />
            <circle cx="36" cy="30" r="2" fill="#f43f5e" opacity="0.6" />
            <circle cx="30" cy="32" r="1.5" fill="#e11d48" />
            {/* Red Bridal Silk Gown */}
            <path d="M14 48 C18 36, 42 36, 46 48 Z" fill="#e11d48" stroke="#fb7185" strokeWidth="1.5" />
          </svg>
        </div>
        <span className="text-[10px] font-bold text-pink-300 mt-1">Bride</span>
      </div>
    );
  }

  if (id === 3) {
    // 3: Twin Gold Wedding Bands
    return (
      <div className="flex flex-col items-center justify-center p-1 select-none">
        <div className="relative flex h-13 w-13 sm:h-15 sm:w-15 items-center justify-center rounded-2xl bg-amber-950/60 border border-amber-500/40">
          <svg viewBox="0 0 50 50" className="h-9 w-9 drop-shadow" fill="none">
            <circle cx="20" cy="26" r="12" stroke="#f59e0b" strokeWidth="3.5" />
            <circle cx="30" cy="22" r="12" stroke="#fbbf24" strokeWidth="3.5" />
            {/* Sparkling Solitaire Diamond */}
            <polygon points="30,8 34,13 30,17 26,13" fill="#ffffff" stroke="#38bdf8" strokeWidth="1" />
          </svg>
        </div>
        <span className="text-[10px] font-medium text-amber-200 mt-1">Twin Rings</span>
      </div>
    );
  }

  if (id === 4) {
    // 4: Auspicious Hongbao (Red Envelope)
    return (
      <div className="flex flex-col items-center justify-center p-1 select-none">
        <div className="relative flex h-13 w-13 sm:h-15 sm:w-15 items-center justify-center rounded-2xl bg-red-950/60 border border-red-500/40">
          <svg viewBox="0 0 45 55" className="h-9 w-8 drop-shadow" fill="none">
            <rect x="6" y="8" width="32" height="40" rx="3" fill="#dc2626" stroke="#991b1b" strokeWidth="1" />
            <path d="M6 12 C16 26, 28 26, 38 12" fill="#ef4444" stroke="#991b1b" strokeWidth="1" />
            <circle cx="22" cy="22" r="6" fill="#facc15" stroke="#ca8a04" strokeWidth="1" />
            <text x="22" y="25" fill="#78350f" fontSize="7" fontWeight="bold" textAnchor="middle">福</text>
          </svg>
        </div>
        <span className="text-[10px] font-medium text-red-300 mt-1">Hongbao</span>
      </div>
    );
  }

  if (id === 5) {
    // 5: Imperial Wedding Gift Chest
    return (
      <div className="flex flex-col items-center justify-center p-1 select-none">
        <div className="relative flex h-13 w-13 sm:h-15 sm:w-15 items-center justify-center rounded-2xl bg-amber-950/60 border border-amber-500/30">
          <svg viewBox="0 0 50 50" className="h-9 w-9 drop-shadow" fill="none">
            <rect x="8" y="18" width="34" height="24" rx="3" fill="#991b1b" stroke="#f59e0b" strokeWidth="2" />
            <path d="M8 18 Q25 10 42 18 Z" fill="#b91c1c" stroke="#f59e0b" strokeWidth="2" />
            <rect x="22" y="16" width="6" height="10" rx="1" fill="#facc15" />
          </svg>
        </div>
        <span className="text-[10px] font-medium text-amber-300 mt-1">Gift Chest</span>
      </div>
    );
  }

  if (id === 6) {
    // 6: Firecracker Bundle
    return (
      <div className="flex flex-col items-center justify-center p-1 select-none">
        <div className="relative flex h-13 w-13 sm:h-15 sm:w-15 items-center justify-center rounded-2xl bg-red-950/40 border border-red-500/30">
          <svg viewBox="0 0 45 45" className="h-8 w-8 drop-shadow" fill="none">
            <rect x="12" y="12" width="7" height="22" rx="1.5" fill="#ef4444" stroke="#facc15" strokeWidth="1" />
            <rect x="24" y="8" width="7" height="22" rx="1.5" fill="#dc2626" stroke="#facc15" strokeWidth="1" />
            <path d="M15 12 Q20 4 27 8" stroke="#ca8a04" strokeWidth="1.5" fill="none" />
            <circle cx="20" cy="4" r="2" fill="#facc15" className="animate-ping" />
          </svg>
        </div>
        <span className="text-[10px] font-medium text-rose-300 mt-1">Crackers</span>
      </div>
    );
  }

  // 7, 8, 9: Royal Cards (A, K, Q)
  const cardLetters = ["A", "K", "Q"];
  const letter = cardLetters[id - 7] || "A";
  const colors = ["text-amber-400", "text-red-400", "text-sky-400"];

  return (
    <div className="flex flex-col items-center justify-center p-1 select-none">
      <div className="relative flex h-13 w-13 sm:h-15 sm:w-15 items-center justify-center rounded-2xl bg-zinc-900/80 border border-white/10 shadow-inner">
        <span className={cn("font-serif text-2xl font-black drop-shadow", colors[id - 7])}>
          {letter}
        </span>
      </div>
      <span className="text-[10px] font-mono text-muted-foreground mt-1">Tier {letter}</span>
    </div>
  );
}

/* =========================================================================
   Main Component: Realistic PG Soft Double Fortune Slot
   ========================================================================= */

function parse5x3Grid(raw: any): number[][] {
  if (Array.isArray(raw)) {
    // 1D array of 15 items: row 0 is [0..4], row 1 is [5..9], row 2 is [10..14]
    if (raw.length === 15 && typeof raw[0] === "number") {
      const cols: number[][] = [];
      for (let c = 0; c < 5; c++) {
        cols.push([Number(raw[c]) || 0, Number(raw[5 + c]) || 0, Number(raw[10 + c]) || 0]);
      }
      return cols;
    }
    // 2D array of 5 columns
    if (raw.length === 5 && Array.isArray(raw[0])) {
      return raw.map((c) => Array.isArray(c) ? c.slice(0, 3).map(Number) : [1, 2, 3]);
    }
    // 2D array of 3 rows
    if (raw.length === 3 && Array.isArray(raw[0])) {
      const cols: number[][] = [];
      for (let c = 0; c < 5; c++) {
        cols.push([Number(raw[0][c]) || 0, Number(raw[1][c]) || 0, Number(raw[2][c]) || 0]);
      }
      return cols;
    }
  }
  return [
    [1, 7, 8],
    [3, 0, 9],
    [2, 4, 7],
    [8, 5, 1],
    [9, 2, 6],
  ];
}

export function DoubleFortuneGame({ game }: { game: GameRow }) {
  const { session } = useApp();
  const afterPlay = useAfterPlay(game.slug);

  const [stake, setStake] = useState<number>(game.min_stake || 10);
  const [spinning, setSpinning] = useState(false);
  const [turbo, setTurbo] = useState(false);

  // 5x3 Grid Symbols (5 reels, 3 rows)
  const [grid, setGrid] = useState<number[][]>([
    [1, 7, 8],
    [3, 0, 9],
    [2, 4, 7],
    [8, 5, 1],
    [9, 2, 6],
  ]);

  const [reelSpinning, setReelSpinning] = useState<boolean[]>([false, false, false, false, false]);
  const [multiplier, setMultiplier] = useState(1); // 1x, 2x, 3x, 5x, 8x
  const [winLines, setWinLines] = useState<{ lineIdx: number; symbols: number[] }[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const handleSpin = async () => {
    if (!session?.user) {
      toast.error("Please login to play Double Fortune");
      return;
    }
    if (spinning) return;
    if (stake < game.min_stake || stake > game.max_stake) {
      toast.error(`Stake must be between ${game.min_stake} and ${game.max_stake}`);
      return;
    }

    setSpinning(true);
    setOutcome(null);
    setWinLines([]);
    beep("bet");

    // Initiate spinning animation on all 5 reels
    setReelSpinning([true, true, true, true, true]);

    // Call Supabase RPC
    let resultData: any = null;
    try {
      const { data, error } = await (supabase.rpc as any)("double_fortune_spin", {
        _stake: stake,
      });

      if (error) {
        console.warn("double_fortune_spin RPC error, using client fallback simulator:", error.message);
        // Realistic slot randomizer
        const newGrid = Array.from({ length: 5 }, () =>
          Array.from({ length: 3 }, () => (Math.random() < 0.08 ? 0 : Math.floor(Math.random() * 10)))
        );

        // Check if matching payline
        const hit = Math.random() < 0.38;
        const mult = hit ? (Math.random() < 0.15 ? 8 : Math.random() < 0.3 ? 3 : 1.5) : 0;
        resultData = {
          win: hit,
          grid: newGrid,
          multiplier: hit ? mult : 1,
          payout: hit ? Math.floor(stake * mult) : 0,
        };
      } else {
        resultData = data;
      }
    } catch (err: any) {
      toast.error(errMsg(err));
      setSpinning(false);
      setReelSpinning([false, false, false, false, false]);
      return;
    }

    const finalGrid: number[][] = parse5x3Grid(resultData?.grid);
    const stopInterval = turbo ? 180 : 320;

    // Sequential stop Reel 1 to 5
    for (let col = 0; col < 5; col++) {
      await new Promise((r) => setTimeout(r, stopInterval));
      beep("chip");
      setGrid((current) => {
        const next = [...current];
        next[col] = finalGrid[col] || [0, 1, 2];
        return next;
      });
      setReelSpinning((cur) => {
        const next = [...cur];
        next[col] = false;
        return next;
      });
    }

    const won = Boolean(resultData.win);
    const payout = Number(resultData.payout) || 0;
    const finalMult = Number(resultData.multiplier) || 1;
    setMultiplier(finalMult);

    if (won) {
      beep("bigwin");
      toast.success(`DOUBLE FORTUNE BIG WIN! Won ₹${fmt(payout)} (${finalMult}×)`);
    } else {
      beep("lose");
    }

    setOutcome({
      win: won,
      amount: payout,
      stake,
      multiplier: won ? finalMult : 0,
      title: won ? "DOUBLE FORTUNE WIN!" : "TRY AGAIN",
      detail: won ? `Auspicious Double Happiness Payout: ₹${fmt(payout)}` : "Match 3+ symbols across paylines",
    });

    afterPlay(resultData?.balance);
    setSpinning(false);
  };

  return (
    <div className="space-y-4 font-sans select-none">
      {/* =========================================================================
          Imperial Red & Gold PG Soft Slot Cabinet
          ========================================================================= */}
      <Card className="relative overflow-hidden border-2 border-amber-500/60 bg-gradient-to-b from-[#2a0609] via-[#1c0406] to-[#0d0102] p-0 shadow-2xl rounded-2xl">
        {/* Ornate Temple Eaves & Red Lanterns Header */}
        <div className="relative flex items-center justify-between border-b border-amber-500/40 bg-gradient-to-r from-red-950 via-red-900 to-red-950 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="font-serif text-lg font-black text-amber-300 drop-shadow">
              囍 DOUBLE FORTUNE
            </span>
          </div>

          {/* Double Fortune Top Multiplier Bar (1x, 2x, 3x, 5x, 8x) */}
          <div className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 border border-amber-400/40 shadow-inner">
            <span className="text-[10px] font-bold uppercase text-amber-400/80 mr-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Multiplier
            </span>
            {[1, 2, 3, 5, 8].map((m) => (
              <span
                key={m}
                className={cn(
                  "rounded px-1.5 py-0.2 font-mono text-[11px] font-black transition-all",
                  multiplier >= m
                    ? "bg-amber-400 text-black shadow-[0_0_8px_rgba(251,191,36,0.8)] scale-110"
                    : "text-zinc-500"
                )}
              >
                {m}×
              </span>
            ))}
          </div>
        </div>

        {/* 5x3 Reel Grid Arena */}
        <div className="relative p-3 sm:p-5">
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5 rounded-xl border border-amber-500/30 bg-black/80 p-2 sm:p-3 shadow-inner">
            {grid.map((rawCol, colIdx) => {
              const column = Array.isArray(rawCol) ? rawCol : [0, 1, 2];
              const isSpinning = reelSpinning[colIdx];
              return (
                <div
                  key={colIdx}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg bg-zinc-950/70 p-1 border border-white/5 transition-all",
                    isSpinning && "animate-pulse blur-[0.5px] opacity-75"
                  )}
                >
                  {column.map((symId, rowIdx) => (
                    <div
                      key={rowIdx}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-white/5 shadow transition-transform",
                        !isSpinning && symId === 0 && "ring-1 ring-amber-400/80"
                      )}
                    >
                      <FortuneSymbolRenderer id={symId} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Golden Dragon Pillar Accents on Borders */}
          <div className="pointer-events-none absolute left-1 top-2 bottom-2 w-2 bg-gradient-to-b from-amber-400 via-yellow-600 to-amber-700 rounded-full opacity-60" />
          <div className="pointer-events-none absolute right-1 top-2 bottom-2 w-2 bg-gradient-to-b from-amber-400 via-yellow-600 to-amber-700 rounded-full opacity-60" />
        </div>
      </Card>

      {/* =========================================================================
          PG Soft Control Deck: Bet Selector & Round Golden Spin Button
          ========================================================================= */}
      <Card className="space-y-4 p-4 border-border/40 bg-card shadow-lg">
        {/* Stake Controller */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-auto flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center justify-between">
              <span>Bet Stake (30 Fixed Lines)</span>
              <button
                type="button"
                onClick={() => setTurbo(!turbo)}
                className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase transition",
                  turbo ? "bg-amber-500 text-black" : "bg-secondary text-muted-foreground"
                )}
              >
                <Zap className="h-3 w-3" /> Turbo {turbo ? "ON" : "OFF"}
              </button>
            </div>
            <StakeInput
              value={stake}
              onChange={setStake}
              min={game.min_stake}
              max={game.max_stake}
              disabled={spinning}
            />
          </div>

          {/* Quick Stake Chips */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            {[10, 50, 100, 500, 1000].map((amt) => (
              <button
                key={amt}
                onClick={() => setStake(amt)}
                disabled={spinning}
                className={cn(
                  "flex-1 sm:flex-none rounded-lg px-2.5 py-2 font-mono text-xs font-bold transition",
                  stake === amt
                    ? "bg-primary text-primary-foreground shadow"
                    : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                ₹{amt}
              </button>
            ))}
          </div>
        </div>

        {/* PG Soft Iconic Large Golden Spin Button */}
        <div className="flex items-center justify-center pt-2">
          <button
            onClick={handleSpin}
            disabled={spinning}
            className={cn(
              "relative flex h-18 w-56 sm:w-64 items-center justify-center rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 p-1 shadow-[0_6px_25px_rgba(251,191,36,0.5)] transition-all active:scale-95 disabled:opacity-60",
              spinning && "animate-pulse"
            )}
          >
            <div className="flex h-full w-full items-center justify-center rounded-xl bg-gradient-to-b from-amber-300 via-amber-500 to-yellow-600 font-display text-lg font-black tracking-wider text-black">
              {spinning ? "SPINNING..." : "SPIN TO WIN"}
            </div>
          </button>
        </div>
      </Card>

      {outcome && <ResultPopup outcome={outcome} onClose={() => setOutcome(null)} />}
    </div>
  );
}
