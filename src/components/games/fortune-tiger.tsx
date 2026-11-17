import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useApp } from "@/lib/app-context";
import { beep, fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { useAfterPlay } from "@/components/sz/shell";
import { ActionButton, BetAmount, Panel, ResultPopup, type Outcome } from "./kit";
import type { GameRow } from "./types";
import { Sparkles, Zap, RotateCw, Info, Volume2, X } from "lucide-react";

/*
  Fortune Tiger Symbols:
  0: Wild Tiger (250x)
  1: Gold Ingot (100x)
  2: Green Jade Amulet (25x)
  3: Red Coin Pouch (10x)
  4: Red Envelopes (8x)
  5: Firecrackers (5x)
  6: Tangerines (3x)
*/
const SYMBOL_NAMES = [
  "Golden Tiger (Wild)",
  "Gold Ingot",
  "Jade Amulet",
  "Coin Pouch",
  "Red Envelopes",
  "Firecrackers",
  "Tangerines"
];

const PAYOUTS_MULT = [250, 100, 25, 10, 8, 5, 3];
const LINES = [
  [0, 1, 2], // Top row
  [3, 4, 5], // Middle row
  [6, 7, 8], // Bottom row
  [0, 4, 8], // Diagonal top-left to bottom-right
  [6, 4, 2], // Diagonal bottom-left to top-right
];

// Rich vector SVGs for Fortune Tiger symbols
function TigerSymbol({ id }: { id: number }) {
  if (id === 0) {
    // 0: Golden Tiger Wild
    return (
      <div className="relative flex h-full w-full items-center justify-center p-1">
        <svg viewBox="0 0 100 100" className="h-[92%] w-[92%] drop-shadow-[0_4px_10px_rgba(255,215,0,0.7)]">
          <defs>
            <radialGradient id="tigerGold" cx="50%" cy="40%" r="55%">
              <stop offset="0%" stopColor="#fff2a3" />
              <stop offset="45%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#b45309" />
            </radialGradient>
            <linearGradient id="tigerRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#991b1b" />
            </linearGradient>
          </defs>
          {/* Golden Aura Ring */}
          <circle cx="50" cy="50" r="46" fill="url(#tigerGold)" stroke="#fef08a" strokeWidth="2.5" />
          <circle cx="50" cy="50" r="41" fill="#78350f" opacity="0.4" />
          {/* Tiger Ears */}
          <path d="M 24 35 C 18 20, 32 15, 38 28 Z" fill="#f59e0b" stroke="#78350f" strokeWidth="2" />
          <path d="M 26 32 C 22 24, 30 20, 34 28 Z" fill="#fee2e2" />
          <path d="M 76 35 C 82 20, 68 15, 62 28 Z" fill="#f59e0b" stroke="#78350f" strokeWidth="2" />
          <path d="M 74 32 C 78 24, 70 20, 66 28 Z" fill="#fee2e2" />
          {/* Tiger Face Base */}
          <ellipse cx="50" cy="54" rx="30" ry="26" fill="#fbbf24" stroke="#78350f" strokeWidth="2" />
          {/* Stripes */}
          <path d="M 50 30 L 50 40 M 42 33 L 47 41 M 58 33 L 53 41" stroke="#78350f" strokeWidth="3" strokeLinecap="round" />
          <path d="M 23 52 L 31 52 M 77 52 L 69 52" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round" />
          {/* Cheeks */}
          <ellipse cx="37" cy="59" rx="10" ry="8" fill="#fff" opacity="0.9" />
          <ellipse cx="63" cy="59" rx="10" ry="8" fill="#fff" opacity="0.9" />
          {/* Eyes with gleam */}
          <ellipse cx="37" cy="48" rx="4.5" ry="5.5" fill="#1e1b4b" />
          <circle cx="35.5" cy="46" r="1.5" fill="#fff" />
          <ellipse cx="63" cy="48" rx="4.5" ry="5.5" fill="#1e1b4b" />
          <circle cx="61.5" cy="46" r="1.5" fill="#fff" />
          {/* Cute Nose and Mouth */}
          <polygon points="50,55 45,51 55,51" fill="#dc2626" />
          <path d="M 45 57 Q 50 62 55 57" fill="none" stroke="#78350f" strokeWidth="2" strokeLinecap="round" />
          {/* Gold Ingot held below mouth */}
          <path d="M 36 68 L 64 68 L 60 78 L 40 78 Z" fill="#fef08a" stroke="#d97706" strokeWidth="1.5" />
          <ellipse cx="50" cy="68" rx="14" ry="4" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
          {/* Wild Banner */}
          <rect x="18" y="77" width="64" height="18" rx="5" fill="url(#tigerRed)" stroke="#fef08a" strokeWidth="1.5" />
          <text x="50" y="90" textAnchor="middle" fill="#fef08a" fontSize="11" fontWeight="900" fontFamily="sans-serif" letterSpacing="1">WILD</text>
        </svg>
      </div>
    );
  }

  if (id === 1) {
    // 1: Gold Sycee / Ingot (100x)
    return (
      <div className="flex h-full w-full items-center justify-center p-1">
        <svg viewBox="0 0 100 100" className="h-[88%] w-[88%] drop-shadow-[0_4px_8px_rgba(234,179,8,0.6)]">
          <defs>
            <linearGradient id="ingotGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#a16207" />
            </linearGradient>
            <radialGradient id="ingotTop" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fffbeb" />
              <stop offset="100%" stopColor="#facc15" />
            </radialGradient>
          </defs>
          {/* Bottom base */}
          <path d="M 18 48 C 18 80, 82 80, 82 48 C 88 40, 80 32, 72 36 C 62 42, 38 42, 28 36 C 20 32, 12 40, 18 48 Z" fill="url(#ingotGrad)" stroke="#78350f" strokeWidth="2.5" />
          {/* Center mound */}
          <ellipse cx="50" cy="42" rx="22" ry="14" fill="url(#ingotTop)" stroke="#b45309" strokeWidth="2" />
          {/* Shine detail */}
          <path d="M 38 38 Q 50 32 62 38" stroke="#ffffff" strokeWidth="2" fill="none" opacity="0.8" strokeLinecap="round" />
          <circle cx="50" cy="42" r="5" fill="#f59e0b" opacity="0.6" />
          {/* Red Ribbon accent */}
          <path d="M 50 56 L 46 72 M 50 56 L 54 72" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (id === 2) {
    // 2: Green Jade Disc / Amulet (25x)
    return (
      <div className="flex h-full w-full items-center justify-center p-1">
        <svg viewBox="0 0 100 100" className="h-[88%] w-[88%] drop-shadow-[0_4px_8px_rgba(16,185,129,0.5)]">
          <defs>
            <radialGradient id="jadeGrad" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#6ee7b7" />
              <stop offset="55%" stopColor="#059669" />
              <stop offset="100%" stopColor="#064e3b" />
            </radialGradient>
          </defs>
          {/* Gold loop at top */}
          <circle cx="50" cy="18" r="7" fill="none" stroke="#f59e0b" strokeWidth="3" />
          {/* Jade Outer Ring */}
          <circle cx="50" cy="52" r="34" fill="url(#jadeGrad)" stroke="#fef08a" strokeWidth="2.5" />
          {/* Inner cut-out */}
          <circle cx="50" cy="52" r="14" fill="#2d0a31" stroke="#fef08a" strokeWidth="2" />
          {/* Carved spiral detail on jade */}
          <circle cx="50" cy="52" r="24" fill="none" stroke="#a7f3d0" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.7" />
          {/* Golden tassel at bottom */}
          <path d="M 46 86 L 44 98 M 50 86 L 50 99 M 54 86 L 56 98" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (id === 3) {
    // 3: Red Coin Pouch (10x)
    return (
      <div className="flex h-full w-full items-center justify-center p-1">
        <svg viewBox="0 0 100 100" className="h-[88%] w-[88%] drop-shadow-[0_4px_8px_rgba(220,38,38,0.5)]">
          <defs>
            <linearGradient id="pouchGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="60%" stopColor="#b91c1c" />
              <stop offset="100%" stopColor="#7f1d1d" />
            </linearGradient>
          </defs>
          {/* Gold coins overflowing from pouch neck */}
          <circle cx="44" cy="30" r="9" fill="#facc15" stroke="#78350f" strokeWidth="1.5" />
          <circle cx="56" cy="30" r="9" fill="#facc15" stroke="#78350f" strokeWidth="1.5" />
          <circle cx="50" cy="24" r="9" fill="#fef08a" stroke="#78350f" strokeWidth="1.5" />
          {/* Pouch body */}
          <path d="M 32 38 C 20 44, 16 75, 30 84 C 40 90, 60 90, 70 84 C 84 75, 80 44, 68 38 Z" fill="url(#pouchGrad)" stroke="#fbbf24" strokeWidth="2" />
          {/* Golden Tie rope */}
          <ellipse cx="50" cy="38" rx="16" ry="4" fill="#f59e0b" stroke="#78350f" strokeWidth="1.5" />
          {/* Golden Character / Emblem on belly */}
          <circle cx="50" cy="62" r="13" fill="#fbbf24" stroke="#78350f" strokeWidth="1.5" />
          <text x="50" y="67" textAnchor="middle" fill="#78350f" fontSize="13" fontWeight="900" fontFamily="sans-serif">福</text>
        </svg>
      </div>
    );
  }

  if (id === 4) {
    // 4: Red Envelopes (8x)
    return (
      <div className="flex h-full w-full items-center justify-center p-1">
        <svg viewBox="0 0 100 100" className="h-[88%] w-[88%] drop-shadow-[0_4px_8px_rgba(239,68,68,0.5)]">
          {/* Back envelope tilted */}
          <g transform="rotate(-12 50 50)">
            <rect x="26" y="20" width="48" height="64" rx="4" fill="#b91c1c" stroke="#facc15" strokeWidth="1.5" />
            <path d="M 26 20 Q 50 42 74 20" fill="#991b1b" stroke="#facc15" strokeWidth="1.5" />
          </g>
          {/* Front envelope upright */}
          <g transform="rotate(8 50 50)">
            <rect x="28" y="22" width="48" height="64" rx="4" fill="#dc2626" stroke="#fef08a" strokeWidth="2" />
            <path d="M 28 22 Q 52 46 76 22" fill="#b91c1c" stroke="#fef08a" strokeWidth="1.5" />
            <circle cx="52" cy="46" r="8" fill="#facc15" stroke="#78350f" strokeWidth="1" />
            <text x="52" y="50" textAnchor="middle" fill="#78350f" fontSize="9" fontWeight="bold">吉</text>
          </g>
        </svg>
      </div>
    );
  }

  if (id === 5) {
    // 5: Firecrackers (5x)
    return (
      <div className="flex h-full w-full items-center justify-center p-1">
        <svg viewBox="0 0 100 100" className="h-[88%] w-[88%] drop-shadow-[0_4px_8px_rgba(220,38,38,0.6)]">
          {/* String */}
          <path d="M 50 10 Q 52 50 50 90" stroke="#f59e0b" strokeWidth="2.5" fill="none" />
          {/* Firecracker 1 */}
          <g transform="rotate(25 40 30)">
            <rect x="24" y="24" width="22" height="12" rx="2" fill="#dc2626" stroke="#facc15" strokeWidth="1.5" />
            <rect x="24" y="27" width="22" height="5" fill="#facc15" />
          </g>
          {/* Firecracker 2 */}
          <g transform="rotate(-20 60 45)">
            <rect x="52" y="40" width="22" height="12" rx="2" fill="#dc2626" stroke="#facc15" strokeWidth="1.5" />
            <rect x="52" y="43" width="22" height="5" fill="#facc15" />
          </g>
          {/* Firecracker 3 */}
          <g transform="rotate(22 40 65)">
            <rect x="24" y="60" width="22" height="12" rx="2" fill="#dc2626" stroke="#facc15" strokeWidth="1.5" />
            <rect x="24" y="63" width="22" height="5" fill="#facc15" />
          </g>
          {/* Sparks at bottom */}
          <circle cx="50" cy="88" r="3" fill="#fef08a" />
          <polygon points="50,82 53,88 59,90 53,92 50,98 47,92 41,90 47,88" fill="#fbbf24" />
        </svg>
      </div>
    );
  }

  if (id === 6) {
    // 6: Tangerines / Lucky Oranges (3x)
    return (
      <div className="flex h-full w-full items-center justify-center p-1">
        <svg viewBox="0 0 100 100" className="h-[88%] w-[88%] drop-shadow-[0_4px_8px_rgba(249,115,22,0.6)]">
          <defs>
            <radialGradient id="orangeGrad1" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#fed7aa" />
              <stop offset="45%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#c2410c" />
            </radialGradient>
          </defs>
          {/* Left / back Orange */}
          <circle cx="38" cy="56" r="22" fill="url(#orangeGrad1)" stroke="#7c2d12" strokeWidth="1.5" />
          {/* Right / front Orange */}
          <circle cx="62" cy="58" r="23" fill="url(#orangeGrad1)" stroke="#7c2d12" strokeWidth="1.5" />
          {/* Green Leaves */}
          <path d="M 50 36 C 45 22, 32 24, 34 34 Z" fill="#16a34a" stroke="#14532d" strokeWidth="1.5" />
          <path d="M 50 36 C 58 22, 70 24, 66 34 Z" fill="#22c55e" stroke="#14532d" strokeWidth="1.5" />
          {/* Stems */}
          <circle cx="50" cy="37" r="2.5" fill="#78350f" />
        </svg>
      </div>
    );
  }

  // Blank symbol (-1 during Respin Feature)
  return (
    <div className="flex h-full w-full items-center justify-center opacity-25">
      <div className="h-10 w-10 rounded-full border border-dashed border-amber-300/40" />
    </div>
  );
}

// Animated Mascot Tiger on Top
function TigerMascot({
  isRoaring,
  isFeature,
  isSpinning
}: {
  isRoaring: boolean;
  isFeature: boolean;
  isSpinning: boolean;
}) {
  return (
    <div className="relative flex flex-col items-center">
      {/* Pagoda Roof Trim */}
      <div className="relative z-10 flex w-full max-w-xs items-center justify-between px-2">
        <div className="h-3 w-8 rounded-full bg-amber-500/80 shadow-[0_0_8px_gold]" />
        <div className="flex items-center gap-1">
          <Sparkles className="h-4 w-4 animate-pulse text-amber-300" />
          <span className="font-display text-xs font-black tracking-widest text-amber-300 uppercase drop-shadow-[0_2px_4px_black]">
            {isFeature ? "FORTUNE RESPIN ACTIVE" : "FORTUNE TIGER"}
          </span>
          <Sparkles className="h-4 w-4 animate-pulse text-amber-300" />
        </div>
        <div className="h-3 w-8 rounded-full bg-amber-500/80 shadow-[0_0_8px_gold]" />
      </div>

      {/* The Tiger Character */}
      <div
        className={cn(
          "relative -mt-1 h-28 w-28 transition-transform duration-300",
          isSpinning && "animate-bounce",
          isRoaring && "scale-115 rotate-2",
          !isSpinning && !isRoaring && "animate-pulse"
        )}
      >
        <svg viewBox="0 0 120 120" className="h-full w-full drop-shadow-[0_6px_14px_rgba(0,0,0,0.8)]">
          <defs>
            <radialGradient id="mGold" cx="50%" cy="40%" r="55%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#b45309" />
            </radialGradient>
            <linearGradient id="mChest" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#fef3c7" />
            </linearGradient>
          </defs>

          {/* Ears with pink insides */}
          <path d="M 28 32 C 18 10, 42 6, 48 24 Z" fill="#f59e0b" stroke="#78350f" strokeWidth="2.5" />
          <path d="M 32 28 C 26 15, 38 13, 44 24 Z" fill="#fecdd3" />
          <path d="M 92 32 C 102 10, 78 6, 72 24 Z" fill="#f59e0b" stroke="#78350f" strokeWidth="2.5" />
          <path d="M 88 28 C 94 15, 82 13, 76 24 Z" fill="#fecdd3" />

          {/* Head */}
          <ellipse cx="60" cy="54" rx="36" ry="32" fill="url(#mGold)" stroke="#78350f" strokeWidth="2.5" />

          {/* Crown / Golden Headband */}
          <path d="M 44 26 L 60 16 L 76 26 L 70 32 L 50 32 Z" fill="#fef08a" stroke="#b45309" strokeWidth="2" />
          <circle cx="60" cy="23" r="3" fill="#dc2626" />

          {/* Tiger Stripes */}
          <path d="M 60 30 L 60 40 M 52 32 L 57 39 M 68 32 L 63 39" stroke="#78350f" strokeWidth="3" strokeLinecap="round" />
          <path d="M 28 50 L 36 50 M 92 50 L 84 50" stroke="#78350f" strokeWidth="3" strokeLinecap="round" />

          {/* White Cheeks */}
          <ellipse cx="44" cy="62" rx="13" ry="10" fill="url(#mChest)" />
          <ellipse cx="76" cy="62" rx="13" ry="10" fill="url(#mChest)" />

          {/* Eyes (Happy winks when roaring, big gleam when spinning) */}
          {isRoaring ? (
            <>
              <path d="M 38 48 Q 44 42 50 48" stroke="#1e1b4b" strokeWidth="3" fill="none" strokeLinecap="round" />
              <path d="M 70 48 Q 76 42 82 48" stroke="#1e1b4b" strokeWidth="3" fill="none" strokeLinecap="round" />
            </>
          ) : (
            <>
              <ellipse cx="44" cy="48" rx="6" ry="7" fill="#1e1b4b" />
              <circle cx="42" cy="45" r="2.5" fill="#ffffff" />
              <ellipse cx="76" cy="48" rx="6" ry="7" fill="#1e1b4b" />
              <circle cx="74" cy="45" r="2.5" fill="#ffffff" />
            </>
          )}

          {/* Red Nose */}
          <polygon points="60,56 54,51 66,51" fill="#dc2626" />

          {/* Cute Mouth */}
          {isRoaring ? (
            <path d="M 50 63 Q 60 78 70 63 Z" fill="#991b1b" stroke="#78350f" strokeWidth="2" />
          ) : (
            <path d="M 52 61 Q 60 67 68 61" stroke="#78350f" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          )}

          {/* Paws holding Gold Ingot */}
          <ellipse cx="40" cy="82" rx="8" ry="7" fill="#f59e0b" stroke="#78350f" strokeWidth="2" />
          <ellipse cx="80" cy="82" rx="8" ry="7" fill="#f59e0b" stroke="#78350f" strokeWidth="2" />
          <ellipse cx="60" cy="80" rx="16" ry="7" fill="#fef08a" stroke="#d97706" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
}

type SpinResponse = {
  grid: number[];
  multiplier: number;
  is_feature: boolean;
  feature_symbol: number | null;
  full_screen: boolean;
  wins: { line: number; symbol: number; pay: number }[];
  payout: number;
  round_code: string;
  balance: number;
  win: boolean;
};

export function FortuneTigerGame({ game }: { game: GameRow }) {
  const { profile } = useApp();
  const after = useAfterPlay(game.slug);

  const [stake, setStake] = useState(game.min_stake || 10);
  const [grid, setGrid] = useState<number[]>([1, 2, 3, 4, 0, 5, 6, 1, 2]);
  const [spinning, setSpinning] = useState<boolean[]>([false, false, false]);
  const [wins, setWins] = useState<SpinResponse["wins"]>([]);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [auto, setAuto] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [showPaytable, setShowPaytable] = useState(false);
  const [isFeature, setIsFeature] = useState(false);
  const [featureSym, setFeatureSym] = useState<number | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const autoRef = useRef(0);
  autoRef.current = auto;

  const isAnySpinning = spinning.some(Boolean);

  // Quick bet helpers
  const adjustStake = (delta: number) => {
    setStake((prev) => {
      const next = prev + delta;
      if (next < (game.min_stake || 10)) return game.min_stake || 10;
      if (next > (game.max_stake || 10000)) return game.max_stake || 10000;
      return next;
    });
  };

  const handleSpin = async () => {
    if (busy || isAnySpinning) return;
    if ((profile?.balance ?? 0) < stake) {
      toast.error("Insufficient balance");
      setAuto(0);
      return;
    }

    setBusy(true);
    setWins([]);
    setLastWin(null);
    setIsFullScreen(false);

    // Play spin start click
    beep("click");

    // Start reel animations
    setSpinning([true, true, true]);

    try {
      const { data, error } = await supabase.rpc("fortune_tiger_spin", { _stake: stake });
      if (error) throw error;
      const res = data as SpinResponse;

      const baseDelay = turbo ? 300 : 700;
      const stepDelay = turbo ? 150 : 350;

      // Reel 1 stop
      setTimeout(() => {
        setSpinning([false, true, true]);
        beep("card");
      }, baseDelay);

      // Reel 2 stop
      setTimeout(() => {
        setSpinning([false, false, true]);
        beep("card");
      }, baseDelay + stepDelay);

      // Reel 3 stop & finalize
      setTimeout(() => {
        setSpinning([false, false, false]);
        setGrid(res.grid);
        setWins(res.wins || []);
        setIsFeature(Boolean(res.is_feature));
        setFeatureSym(res.feature_symbol);
        setIsFullScreen(Boolean(res.full_screen));

        if (res.payout > 0) {
          setLastWin(res.payout);
          beep("win");

          if (res.full_screen || res.payout >= stake * 20) {
            setOutcome({
              won: true,
              amount: res.payout,
              title: res.full_screen ? "10x FULL SCREEN WIN!" : "MEGA WIN!",
            });
          }
        } else {
          setLastWin(0);
        }

        after(res.balance);
        setBusy(false);

        // Auto-spin next round handler
        if (autoRef.current > 0) {
          setAuto((a) => a - 1);
          setTimeout(() => {
            if (autoRef.current > 0) handleSpin();
          }, turbo ? 500 : 1000);
        }
      }, baseDelay + stepDelay * 2);
    } catch (e) {
      toast.error(errMsg(e));
      setSpinning([false, false, false]);
      setBusy(false);
      setAuto(0);
    }
  };

  // Check if a slot belongs to an active winning line
  const activeWinLines = new Set<number>();
  wins.forEach((w) => activeWinLines.add(w.line));

  const isWinningSlot = (idx: number) => {
    return wins.some((w) => LINES[w.line]?.includes(idx));
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3">
      {/* Game Stage Container */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500/40 bg-gradient-to-b from-[#2a0438] via-[#1a0024] to-[#0d0014] p-3 shadow-2xl">
        {/* Animated Mascot Tiger */}
        <TigerMascot
          isRoaring={wins.length > 0 || isFullScreen}
          isFeature={isFeature}
          isSpinning={isAnySpinning}
        />

        {/* Feature Banner if active */}
        {isFeature && featureSym !== null && (
          <div className="relative z-10 mb-2 flex items-center justify-center gap-2 rounded-xl border border-amber-400 bg-amber-500/20 px-3 py-1.5 shadow-[0_0_15px_rgba(251,191,36,0.3)]">
            <span className="font-display text-xs font-bold text-amber-200">LUCKY SYMBOL:</span>
            <div className="h-7 w-7 rounded-lg border border-amber-300 bg-black/40 p-0.5">
              <TigerSymbol id={featureSym} />
            </div>
            <span className="text-[11px] font-semibold text-amber-300">Respins Locked!</span>
          </div>
        )}

        {/* 10x Full Screen Multiplier Alert */}
        {isFullScreen && (
          <div className="mb-2 animate-bounce rounded-xl border-2 border-yellow-300 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 py-1.5 text-center font-display text-sm font-black text-black shadow-[0_0_20px_gold]">
            ★ 10x FULL GRID MULTIPLIER ACTIVATED! ★
          </div>
        )}

        {/* 3x3 Slot Reels Frame */}
        <div className="relative rounded-2xl border-4 border-amber-500/70 bg-gradient-to-b from-[#4a0e4e] via-[#240626] to-[#120014] p-2 shadow-[inset_0_0_20px_rgba(0,0,0,0.9)]">
          {/* Decorative Corner Embellishments */}
          <div className="pointer-events-none absolute -top-2 -left-2 h-5 w-5 rounded-tl-lg border-t-2 border-l-2 border-yellow-300" />
          <div className="pointer-events-none absolute -top-2 -right-2 h-5 w-5 rounded-tr-lg border-t-2 border-r-2 border-yellow-300" />
          <div className="pointer-events-none absolute -bottom-2 -left-2 h-5 w-5 rounded-bl-lg border-b-2 border-l-2 border-yellow-300" />
          <div className="pointer-events-none absolute -bottom-2 -right-2 h-5 w-5 rounded-br-lg border-b-2 border-r-2 border-yellow-300" />

          {/* 3 Columns (Reels) */}
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((colIdx) => {
              const isColSpinning = spinning[colIdx];
              const slotIndices = [colIdx, colIdx + 3, colIdx + 6];

              return (
                <div
                  key={colIdx}
                  className="flex flex-col gap-2 overflow-hidden rounded-xl bg-black/50 p-1 shadow-inner"
                >
                  {slotIndices.map((slotIdx) => {
                    const isWin = isWinningSlot(slotIdx);
                    return (
                      <div
                        key={slotIdx}
                        className={cn(
                          "relative flex aspect-square items-center justify-center rounded-lg border transition-all duration-200",
                          isWin
                            ? "border-yellow-300 bg-yellow-500/20 shadow-[0_0_15px_rgba(253,224,71,0.8)] scale-102"
                            : "border-purple-900/40 bg-gradient-to-b from-purple-950/30 to-black/40",
                          isColSpinning && "animate-pulse blur-[1px]"
                        )}
                      >
                        {isColSpinning ? (
                          <div className="animate-spin text-amber-300/60">
                            <RotateCw className="h-6 w-6" />
                          </div>
                        ) : (
                          <TigerSymbol id={grid[slotIdx] ?? 0} />
                        )}

                        {/* Win highlight pulse badge */}
                        {isWin && (
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
                            <span className="relative inline-flex h-3 w-3 rounded-full bg-yellow-500" />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Win Lines Laser Overlay */}
          {wins.length > 0 && !isAnySpinning && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-center">
              {wins.map((w, idx) => (
                <span
                  key={idx}
                  className="rounded-full border border-yellow-400/80 bg-yellow-500/20 px-2 py-0.5 text-[11px] font-bold text-yellow-300 shadow"
                >
                  Line {w.line + 1}: +{fmt(w.pay)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Win Display Bar */}
        <div className="mt-3 flex items-center justify-between rounded-xl bg-black/60 px-4 py-2 border border-amber-500/30 shadow-inner">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              LAST WIN
            </span>
            <span className="font-display text-lg font-black text-amber-300">
              {lastWin !== null && lastWin > 0 ? `+${fmt(lastWin)}` : "—"}
            </span>
          </div>

          <button
            onClick={() => setShowPaytable(true)}
            className="flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/20"
          >
            <Info className="h-3.5 w-3.5" />
            <span>Paytable</span>
          </button>
        </div>
      </div>

      {/* Control Panel: Bet size & Spin controls */}
      <div className="flex flex-col gap-2 rounded-2xl border border-purple-900/60 bg-card p-3 shadow-card">
        {/* Stake adjusters */}
        <div className="flex items-center justify-between gap-2">
          <button
            disabled={busy || isAnySpinning}
            onClick={() => adjustStake(-10)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-secondary font-display text-base font-bold transition hover:bg-muted active:scale-95 disabled:opacity-50"
          >
            -
          </button>

          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-purple-900/40 bg-background/80 py-1">
            <span className="text-[10px] text-muted-foreground">TOTAL BET (5 Lines)</span>
            <span className="font-display text-base font-black text-foreground">
              {fmt(stake)}
            </span>
          </div>

          <button
            disabled={busy || isAnySpinning}
            onClick={() => adjustStake(10)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-secondary font-display text-base font-bold transition hover:bg-muted active:scale-95 disabled:opacity-50"
          >
            +
          </button>
        </div>

        {/* Quick Bet Preset Chips */}
        <div className="grid grid-cols-5 gap-1.5">
          {[10, 50, 100, 500, 1000].map((amt) => (
            <button
              key={amt}
              disabled={busy || isAnySpinning}
              onClick={() => setStake(amt)}
              className={cn(
                "rounded-lg border py-1 font-display text-xs font-bold transition active:scale-95 disabled:opacity-50",
                stake === amt
                  ? "border-amber-400 bg-amber-500/20 text-amber-300 shadow"
                  : "border-border bg-secondary/60 text-muted-foreground hover:bg-secondary"
              )}
            >
              {amt}
            </button>
          ))}
        </div>

        {/* Action Controls: Turbo, Auto, Giant Spin */}
        <div className="mt-1 flex items-center gap-2">
          {/* Turbo Toggle */}
          <button
            disabled={busy || isAnySpinning}
            onClick={() => setTurbo(!turbo)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center rounded-xl border py-2 transition active:scale-95 disabled:opacity-50",
              turbo
                ? "border-amber-400 bg-amber-500/20 text-amber-300 shadow"
                : "border-border bg-secondary text-muted-foreground"
            )}
          >
            <Zap className={cn("h-4 w-4", turbo && "fill-amber-300 text-amber-300")} />
            <span className="text-[10px] font-bold">TURBO</span>
          </button>

          {/* Auto Spin Toggle */}
          <button
            disabled={busy || isAnySpinning}
            onClick={() => setAuto((prev) => (prev > 0 ? 0 : 30))}
            className={cn(
              "flex flex-1 flex-col items-center justify-center rounded-xl border py-2 transition active:scale-95 disabled:opacity-50",
              auto > 0
                ? "border-amber-400 bg-amber-500/20 text-amber-300 shadow"
                : "border-border bg-secondary text-muted-foreground"
            )}
          >
            <RotateCw className={cn("h-4 w-4", auto > 0 && "animate-spin text-amber-300")} />
            <span className="text-[10px] font-bold">{auto > 0 ? `AUTO (${auto})` : "AUTO"}</span>
          </button>

          {/* Main Spin Button */}
          <button
            disabled={busy || isAnySpinning}
            onClick={handleSpin}
            className={cn(
              "relative flex flex-2 items-center justify-center gap-2 rounded-2xl py-3.5 font-display text-base font-black tracking-wider uppercase text-black transition-all active:scale-95 disabled:opacity-60",
              "border-2 border-yellow-200 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 shadow-[0_4px_16px_rgba(245,158,11,0.5)]"
            )}
          >
            <Sparkles className="h-5 w-5 fill-black" />
            <span>{isAnySpinning ? "SPINNING" : "SPIN"}</span>
          </button>
        </div>
      </div>

      {/* Paytable Modal */}
      {showPaytable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border-2 border-amber-500/60 bg-[#1e0326] p-4 text-foreground shadow-2xl">
            <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
              <h3 className="font-display text-base font-black text-amber-300">
                FORTUNE TIGER PAYTABLE
              </h3>
              <button
                onClick={() => setShowPaytable(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1 text-xs">
              <div className="rounded-xl border border-amber-500/30 bg-black/40 p-2.5">
                <span className="font-bold text-amber-300">5 FIXED PAYLINES:</span>
                <p className="mt-1 text-muted-foreground">
                  3 Horizontal Rows + 2 Diagonals. Line wins are multiplied by line stake (Total Bet ÷ 5).
                </p>
              </div>

              <div className="space-y-1.5">
                {SYMBOL_NAMES.map((name, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg border border-purple-900/40 bg-purple-950/30 px-3 py-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-md bg-black/40 p-0.5">
                        <TigerSymbol id={idx} />
                      </div>
                      <span className="font-semibold text-foreground">{name}</span>
                    </div>
                    <span className="font-display font-black text-amber-300">
                      3x = {PAYOUTS_MULT[idx]}x
                    </span>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5">
                <span className="font-bold text-amber-300">★ 10x FULL SCREEN BONUS:</span>
                <p className="mt-1 text-muted-foreground">
                  When all 9 grid spots are filled with matching symbols and/or Wilds, all 5 payline wins are multiplied by 10x!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Big Win Popup celebration */}
      {outcome && <ResultPopup outcome={outcome} onClose={() => setOutcome(null)} />}
    </div>
  );
}
