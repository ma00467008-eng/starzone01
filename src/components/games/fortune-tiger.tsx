import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useApp } from "@/lib/app-context";
import { beep, fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { useAfterPlay } from "@/components/sz/shell";
import { ResultPopup, type Outcome } from "./kit";
import type { GameRow } from "./types";
import { Sparkles, Zap, Info, Volume2, VolumeX, Flame } from "lucide-react";

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
    // 0: Master Tigress Wild (Kung Fu Tiger)
    return (
      <div className="relative flex h-full w-full items-center justify-center p-1">
        <svg viewBox="0 0 100 100" className="h-[92%] w-[92%] drop-shadow-[0_4px_12px_rgba(245,158,11,0.8)]">
          <defs>
            <radialGradient id="symTigressFur" cx="50%" cy="40%" r="55%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="35%" stopColor="#f59e0b" />
              <stop offset="85%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#92400e" />
            </radialGradient>
            <linearGradient id="symTigressVest" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b91c1c" />
              <stop offset="60%" stopColor="#7f1d1d" />
              <stop offset="100%" stopColor="#450a0a" />
            </linearGradient>
            <radialGradient id="symEyeGold" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="70%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#b45309" />
            </radialGradient>
          </defs>
          {/* Gold Glowing Ring */}
          <circle cx="50" cy="50" r="47" fill="url(#symTigressFur)" stroke="#fef08a" strokeWidth="2.5" />
          <circle cx="50" cy="50" r="42" fill="#1c1917" opacity="0.6" />
          {/* Feline Ears with dark tips */}
          <path d="M 22 35 C 16 18, 32 14, 38 27 Z" fill="#d97706" stroke="#1c1917" strokeWidth="2" />
          <path d="M 25 32 C 20 22, 30 18, 34 26 Z" fill="#fbcfe8" />
          <path d="M 78 35 C 84 18, 68 14, 62 27 Z" fill="#d97706" stroke="#1c1917" strokeWidth="2" />
          <path d="M 75 32 C 80 22, 70 18, 66 26 Z" fill="#fbcfe8" />
          {/* Ear dark tufts */}
          <path d="M 20 28 L 24 18 L 28 26 Z" fill="#1c1917" />
          <path d="M 80 28 L 76 18 L 72 26 Z" fill="#1c1917" />
          {/* Tigress Athletic Face */}
          <ellipse cx="50" cy="52" rx="28" ry="25" fill="url(#symTigressFur)" stroke="#1c1917" strokeWidth="2" />
          {/* Kung Fu Stripes (Forehead and cheeks) */}
          <path d="M 50 30 L 50 41 M 42 34 L 48 42 M 58 34 L 52 42" stroke="#1c1917" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M 24 50 L 32 49 M 23 55 L 30 55 M 76 50 L 68 49 M 77 55 L 70 55" stroke="#1c1917" strokeWidth="2.5" strokeLinecap="round" />
          {/* White Chin & Muzzle */}
          <ellipse cx="40" cy="60" rx="9" ry="7" fill="#fefce8" opacity="0.95" />
          <ellipse cx="60" cy="60" rx="9" ry="7" fill="#fefce8" opacity="0.95" />
          {/* Fierce Amber Eyes with Black Liner */}
          <path d="M 32 48 Q 40 43 47 48 Q 40 54 32 48 Z" fill="#1c1917" />
          <ellipse cx="40" cy="48" rx="4" ry="4" fill="url(#symEyeGold)" />
          <ellipse cx="40" cy="48" rx="1.5" ry="3.5" fill="#000000" />
          <circle cx="39" cy="46" r="1.2" fill="#ffffff" />
          <path d="M 68 48 Q 60 43 53 48 Q 60 54 68 48 Z" fill="#1c1917" />
          <ellipse cx="60" cy="48" rx="4" ry="4" fill="url(#symEyeGold)" />
          <ellipse cx="60" cy="48" rx="1.5" ry="3.5" fill="#000000" />
          <circle cx="59" cy="46" r="1.2" fill="#ffffff" />
          {/* Nose and mouth */}
          <polygon points="50,56 46,52 54,52" fill="#dc2626" />
          <path d="M 46 59 Q 50 63 54 59" fill="none" stroke="#1c1917" strokeWidth="2" strokeLinecap="round" />
          {/* Red Wild Banner */}
          <rect x="18" y="75" width="64" height="19" rx="5" fill="url(#symTigressVest)" stroke="#fef08a" strokeWidth="1.8" />
          <text x="50" y="89" textAnchor="middle" fill="#fef08a" fontSize="11" fontWeight="900" fontFamily="sans-serif" letterSpacing="1">WILD</text>
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
          <path d="M 18 48 C 18 80, 82 80, 82 48 C 88 40, 80 32, 72 36 C 62 42, 38 42, 28 36 C 20 32, 12 40, 18 48 Z" fill="url(#ingotGrad)" stroke="#78350f" strokeWidth="2.5" />
          <ellipse cx="50" cy="42" rx="22" ry="14" fill="url(#ingotTop)" stroke="#b45309" strokeWidth="2" />
          <path d="M 38 38 Q 50 32 62 38" stroke="#ffffff" strokeWidth="2" fill="none" opacity="0.8" strokeLinecap="round" />
          <circle cx="50" cy="42" r="5" fill="#f59e0b" opacity="0.6" />
          <path d="M 50 56 L 46 72 M 50 56 L 54 72" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (id === 2) {
    // 2: Green Jade Amulet (25x)
    return (
      <div className="flex h-full w-full items-center justify-center p-1">
        <svg viewBox="0 0 100 100" className="h-[88%] w-[88%] drop-shadow-[0_4px_8px_rgba(16,185,129,0.5)]">
          <defs>
            <radialGradient id="jadeGrad" cx="45%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#6ee7b7" />
              <stop offset="45%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#064e3b" />
            </radialGradient>
          </defs>
          <path d="M 50 10 L 50 26" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="50" cy="24" r="4" fill="#fbbf24" stroke="#78350f" strokeWidth="1.5" />
          <circle cx="50" cy="56" r="30" fill="url(#jadeGrad)" stroke="#065f46" strokeWidth="3" />
          <circle cx="50" cy="56" r="14" fill="#064e3b" stroke="#34d399" strokeWidth="2" opacity="0.7" />
          <path d="M 40 46 C 45 42, 55 42, 60 46 C 65 52, 65 60, 60 66 C 55 70, 45 70, 40 66 C 35 60, 35 52, 40 46 Z" fill="none" stroke="#fef08a" strokeWidth="1.8" opacity="0.8" />
          <path d="M 46 84 L 46 95 M 50 86 L 50 97 M 54 84 L 54 95" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (id === 3) {
    // 3: Red Silk Coin Pouch (10x)
    return (
      <div className="flex h-full w-full items-center justify-center p-1">
        <svg viewBox="0 0 100 100" className="h-[88%] w-[88%] drop-shadow-[0_4px_8px_rgba(239,68,68,0.5)]">
          <defs>
            <radialGradient id="pouchGrad" cx="50%" cy="55%" r="55%">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="50%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#7f1d1d" />
            </radialGradient>
          </defs>
          <path d="M 32 30 C 25 15, 75 15, 68 30 Z" fill="#b91c1c" stroke="#fbbf24" strokeWidth="2" />
          <ellipse cx="50" cy="62" rx="34" ry="30" fill="url(#pouchGrad)" stroke="#991b1b" strokeWidth="2.5" />
          <rect x="36" y="32" width="28" height="7" rx="3.5" fill="#f59e0b" stroke="#78350f" strokeWidth="1.5" />
          <circle cx="50" cy="60" r="14" fill="#fbbf24" stroke="#b45309" strokeWidth="2" />
          <rect x="45" y="55" width="10" height="10" fill="none" stroke="#78350f" strokeWidth="2" />
          <path d="M 44 38 L 40 50 M 56 38 L 60 50" stroke="#fef08a" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (id === 4) {
    // 4: Red Lucky Envelopes (8x)
    return (
      <div className="flex h-full w-full items-center justify-center p-1">
        <svg viewBox="0 0 100 100" className="h-[88%] w-[88%] drop-shadow-[0_4px_8px_rgba(239,68,68,0.5)]">
          <defs>
            <linearGradient id="envGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="60%" stopColor="#b91c1c" />
              <stop offset="100%" stopColor="#7f1d1d" />
            </linearGradient>
          </defs>
          <rect x="18" y="24" width="46" height="60" rx="5" fill="#991b1b" stroke="#fbbf24" strokeWidth="2" transform="rotate(-10 41 54)" />
          <rect x="34" y="20" width="48" height="64" rx="5" fill="url(#envGrad)" stroke="#fef08a" strokeWidth="2" transform="rotate(8 58 52)" />
          <path d="M 35 24 L 58 46 L 81 26" fill="none" stroke="#fef08a" strokeWidth="2" transform="rotate(8 58 52)" />
          <circle cx="58" cy="46" r="6" fill="#fbbf24" stroke="#78350f" strokeWidth="1.5" transform="rotate(8 58 52)" />
          <text x="58" y="68" textAnchor="middle" fill="#fef08a" fontSize="13" fontWeight="bold" transform="rotate(8 58 52)">福</text>
        </svg>
      </div>
    );
  }

  if (id === 5) {
    // 5: Red Firecrackers (5x)
    return (
      <div className="flex h-full w-full items-center justify-center p-1">
        <svg viewBox="0 0 100 100" className="h-[88%] w-[88%] drop-shadow-[0_4px_8px_rgba(245,158,11,0.5)]">
          <path d="M 50 10 Q 52 25 50 88" stroke="#f59e0b" strokeWidth="3" fill="none" />
          <rect x="34" y="22" width="22" height="12" rx="3" fill="#dc2626" stroke="#fbbf24" strokeWidth="1.5" />
          <rect x="46" y="38" width="22" height="12" rx="3" fill="#dc2626" stroke="#fbbf24" strokeWidth="1.5" />
          <rect x="32" y="54" width="22" height="12" rx="3" fill="#dc2626" stroke="#fbbf24" strokeWidth="1.5" />
          <rect x="48" y="70" width="22" height="12" rx="3" fill="#dc2626" stroke="#fbbf24" strokeWidth="1.5" />
          <polygon points="50,14 46,6 54,8 58,2 58,10" fill="#facc15" />
        </svg>
      </div>
    );
  }

  // 6: Lucky Tangerines (3x)
  return (
    <div className="flex h-full w-full items-center justify-center p-1">
      <svg viewBox="0 0 100 100" className="h-[88%] w-[88%] drop-shadow-[0_4px_8px_rgba(249,115,22,0.5)]">
        <defs>
          <radialGradient id="tangerineGrad" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fdba74" />
            <stop offset="50%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#c2410c" />
          </radialGradient>
        </defs>
        <circle cx="42" cy="56" r="24" fill="url(#tangerineGrad)" stroke="#9a3412" strokeWidth="2" />
        <circle cx="64" cy="62" r="20" fill="url(#tangerineGrad)" stroke="#9a3412" strokeWidth="2" />
        <path d="M 42 32 C 40 22, 52 20, 56 26 C 60 20, 70 24, 66 32 Z" fill="#15803d" stroke="#166534" strokeWidth="1.5" />
        <path d="M 48 34 L 52 24" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// Master Tigress Mascot from Kung Fu Panda
function TigressMascot({
  isRoaring,
  isFeature,
  isSpinning,
}: {
  isRoaring: boolean;
  isFeature: boolean;
  isSpinning: boolean;
}) {
  return (
    <div className="relative mx-auto flex flex-col items-center justify-center pt-1 pb-2">
      {/* Golden Chi aura behind Tigress */}
      <div
        className={cn(
          "absolute h-36 w-36 rounded-full transition-all duration-500",
          isRoaring
            ? "bg-gradient-to-t from-amber-500/50 via-yellow-400/40 to-transparent scale-125 animate-pulse blur-xl"
            : isFeature
            ? "bg-gradient-to-t from-red-600/50 via-amber-500/40 to-transparent scale-110 animate-bounce blur-lg"
            : isSpinning
            ? "bg-amber-500/25 scale-105 animate-pulse blur-md"
            : "bg-amber-500/10 scale-95 blur-sm"
        )}
      />

      <div
        className={cn(
          "relative z-10 transition-transform duration-300",
          isRoaring ? "scale-110" : isSpinning ? "scale-105" : "hover:scale-102"
        )}
      >
        <svg
          viewBox="0 0 160 145"
          className="h-28 w-32 drop-shadow-[0_8px_16px_rgba(0,0,0,0.85)]"
        >
          <defs>
            <radialGradient id="tFur" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#fed7aa" />
              <stop offset="30%" stopColor="#f97316" />
              <stop offset="70%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="#9a3412" />
            </radialGradient>
            <linearGradient id="tVest" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b91c1c" />
              <stop offset="60%" stopColor="#7f1d1d" />
              <stop offset="100%" stopColor="#290707" />
            </linearGradient>
            <linearGradient id="tGoldTrim" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#ca8a04" />
            </linearGradient>
            <radialGradient id="tEyeGold" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="60%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#b45309" />
            </radialGradient>
          </defs>

          {/* Kung Fu Torso & Vest */}
          <path
            d="M 52 82 C 40 92, 42 135, 42 140 L 118 140 C 118 135, 120 92, 108 82 Z"
            fill="url(#tVest)"
            stroke="#1c1917"
            strokeWidth="2.5"
          />
          {/* Gold Trim Kung Fu Collar & Frog Closures */}
          <path d="M 80 82 L 80 140" stroke="url(#tGoldTrim)" strokeWidth="2.5" />
          <path d="M 72 96 L 88 96 M 70 110 L 90 110 M 72 124 L 88 124" stroke="url(#tGoldTrim)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="80" cy="96" r="2.5" fill="#fef08a" />
          <circle cx="80" cy="110" r="2.5" fill="#fef08a" />
          <circle cx="80" cy="124" r="2.5" fill="#fef08a" />

          {/* Martial Artist Paws (Tiger Fist / Tiger Claw Poise) */}
          {/* Left Kung Fu Paw with Wrist Wrap */}
          <ellipse cx="38" cy="116" rx="9" ry="8" fill="url(#tFur)" stroke="#1c1917" strokeWidth="2" />
          <rect x="32" y="122" width="12" height="6" rx="2" fill="#1c1917" stroke="#fef08a" strokeWidth="1" />
          {/* Right Kung Fu Paw (Poised Claw) */}
          <ellipse cx="122" cy="116" rx="9" ry="8" fill="url(#tFur)" stroke="#1c1917" strokeWidth="2" />
          <rect x="116" y="122" width="12" height="6" rx="2" fill="#1c1917" stroke="#fef08a" strokeWidth="1" />

          {/* Tigress Ears (Sleek feline ears with black tufts) */}
          <path d="M 44 42 C 30 14, 52 10, 60 28 Z" fill="#ea580c" stroke="#1c1917" strokeWidth="2.5" />
          <path d="M 47 38 C 38 20, 52 16, 56 28 Z" fill="#fbcfe8" />
          <path d="M 40 26 L 46 14 L 52 24 Z" fill="#1c1917" />

          <path d="M 116 42 C 130 14, 108 10, 100 28 Z" fill="#ea580c" stroke="#1c1917" strokeWidth="2.5" />
          <path d="M 113 38 C 122 20, 108 16, 104 28 Z" fill="#fbcfe8" />
          <path d="M 120 26 L 114 14 L 108 24 Z" fill="#1c1917" />

          {/* Tigress Athletic Feline Head */}
          <ellipse cx="80" cy="58" rx="42" ry="34" fill="url(#tFur)" stroke="#1c1917" strokeWidth="2.5" />

          {/* Signature Forehead Kung Fu Stripes */}
          <path d="M 80 28 L 80 43 M 70 33 L 78 45 M 90 33 L 82 45" stroke="#1c1917" strokeWidth="3.2" strokeLinecap="round" />
          {/* Side Stripes */}
          <path d="M 42 54 L 54 52 M 40 62 L 51 60 M 118 54 L 106 52 M 120 62 L 109 60" stroke="#1c1917" strokeWidth="2.8" strokeLinecap="round" />

          {/* Sleek White Cheeks & Muzzle */}
          <ellipse cx="64" cy="72" rx="14" ry="11" fill="#fffbeb" opacity="0.95" />
          <ellipse cx="96" cy="72" rx="14" ry="11" fill="#fffbeb" opacity="0.95" />

          {/* Fierce Amber Martial Artist Eyes with Dark Eyeliner */}
          {isRoaring ? (
            /* Triumphant Roar / Win Eyes */
            <>
              <path d="M 52 52 Q 64 42 74 52" stroke="#1c1917" strokeWidth="3.8" fill="none" strokeLinecap="round" />
              <path d="M 108 52 Q 96 42 86 52" stroke="#1c1917" strokeWidth="3.8" fill="none" strokeLinecap="round" />
            </>
          ) : (
            /* Focused Master Tigress Piercing Gaze */
            <>
              {/* Left Eye */}
              <path d="M 50 54 Q 63 46 74 53 Q 63 62 50 54 Z" fill="#1c1917" />
              <ellipse cx="63" cy="54" rx="5.5" ry="5.5" fill="url(#tEyeGold)" />
              <ellipse cx="63" cy="54" rx="2.2" ry="4.8" fill="#000000" />
              <circle cx="61.5" cy="51.5" r="1.6" fill="#ffffff" />
              <path d="M 48 50 L 76 47" stroke="#1c1917" strokeWidth="2.5" strokeLinecap="round" />

              {/* Right Eye */}
              <path d="M 110 54 Q 97 46 86 53 Q 97 62 110 54 Z" fill="#1c1917" />
              <ellipse cx="97" cy="54" rx="5.5" ry="5.5" fill="url(#tEyeGold)" />
              <ellipse cx="97" cy="54" rx="2.2" ry="4.8" fill="#000000" />
              <circle cx="95.5" cy="51.5" r="1.6" fill="#ffffff" />
              <path d="M 112 50 L 84 47" stroke="#1c1917" strokeWidth="2.5" strokeLinecap="round" />
            </>
          )}

          {/* Nose & Mouth */}
          <polygon points="80,66 74,60 86,60" fill="#dc2626" />
          {isRoaring ? (
            /* Roaring Kung Fu Grin with Fangs */
            <>
              <path d="M 70 73 Q 80 88 90 73 Z" fill="#7f1d1d" stroke="#1c1917" strokeWidth="2" />
              <polygon points="73,73 75,78 77,73" fill="#ffffff" />
              <polygon points="87,73 85,78 83,73" fill="#ffffff" />
            </>
          ) : (
            /* Stoic determined martial arts smirk */
            <path d="M 72 72 Q 80 77 88 72" stroke="#1c1917" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          )}

          {/* Golden Chi Sparks when Winning */}
          {isRoaring && (
            <>
              <circle cx="30" cy="80" r="3" fill="#fef08a" className="animate-ping" />
              <circle cx="130" cy="80" r="3" fill="#fef08a" className="animate-ping" />
              <polygon points="80,12 83,18 90,19 85,24 86,30 80,27 74,30 75,24 70,19 77,18" fill="#fef08a" />
            </>
          )}
        </svg>
      </div>

      {/* Tigress Title Badge */}
      <div className="relative -mt-2 z-20 flex items-center gap-1.5 rounded-full border border-amber-400/80 bg-gradient-to-r from-red-950 via-amber-950 to-red-950 px-3 py-0.5 shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
        <Flame className="h-3 w-3 text-amber-400" />
        <span className="font-display text-[10px] font-black tracking-widest text-amber-300 uppercase">
          MASTER TIGRESS
        </span>
        <Flame className="h-3 w-3 text-amber-400" />
      </div>
    </div>
  );
}

// Reel strip of cycling symbols for continuous spinning effect
const REEL_STRIP = [0, 1, 2, 3, 4, 5, 6, 1, 0, 2, 4, 3, 6, 5, 0, 1];

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
  const [bouncing, setBouncing] = useState<boolean[]>([false, false, false]);
  const [wins, setWins] = useState<SpinResponse["wins"]>([]);
  const [winAmount, setWinAmount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [sound, setSound] = useState(true);
  const [auto, setAuto] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [showPaytable, setShowPaytable] = useState(false);
  const [isFeature, setIsFeature] = useState(false);
  const [featureSym, setFeatureSym] = useState<number | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const autoRef = useRef(0);
  autoRef.current = auto;

  const isAnySpinning = spinning.some(Boolean);

  const playSfx = (kind: "click" | "chip" | "flip" | "win" | "bigwin" | "tick") => {
    if (sound) beep(kind);
  };

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
    // On loss or new spin, clear win banner completely (show nothing on loss)
    setWins([]);
    setWinAmount(null);
    setIsFullScreen(false);

    playSfx("click");

    // Start all 3 reels spinning with rolling slot animation
    setSpinning([true, true, true]);
    setBouncing([false, false, false]);

    try {
      const { data, error } = await (supabase.rpc as any)("fortune_tiger_spin", { _stake: stake });
      if (error) throw error;
      const res = data as SpinResponse;

      const baseDelay = turbo ? 300 : 700;
      const stepDelay = turbo ? 180 : 380;

      // Reel 1 stop with physical slot bounce
      setTimeout(() => {
        setSpinning([false, true, true]);
        setBouncing([true, false, false]);
        playSfx("flip");
        setTimeout(() => setBouncing((b) => [false, b[1] ?? false, b[2] ?? false]), 220);
      }, baseDelay);

      // Reel 2 stop with physical slot bounce
      setTimeout(() => {
        setSpinning([false, false, true]);
        setBouncing((b) => [b[0] ?? false, true, false]);
        playSfx("flip");
        setTimeout(() => setBouncing((b) => [b[0] ?? false, false, b[2] ?? false]), 220);
      }, baseDelay + stepDelay);

      // Reel 3 stop & finalize round
      setTimeout(() => {
        setSpinning([false, false, false]);
        setBouncing((b) => [b[0] ?? false, b[1] ?? false, true]);
        playSfx("flip");
        setTimeout(() => setBouncing([false, false, false]), 220);

        // Update grid to final result
        setGrid(res.grid);
        setIsFeature(Boolean(res.is_feature));
        setFeatureSym(res.feature_symbol);
        setIsFullScreen(Boolean(res.full_screen));

        if (res.payout > 0) {
          // On Win: show winning amount and win lines
          setWins(res.wins || []);
          setWinAmount(res.payout);
          playSfx("win");

          // Big Win / 10x Full screen celebration popup
          if (res.full_screen || res.payout >= stake * 15) {
            playSfx("bigwin");
            setOutcome({
              win: true,
              amount: res.payout,
              title: res.full_screen ? "10x FULL SCREEN TIGRESS WIN!" : "MEGA WIN!",
            });
          }
        } else {
          // On Loss: show NOTHING!
          setWins([]);
          setWinAmount(null);
        }

        after();
        setBusy(false);

        // Auto-spin handler
        if (autoRef.current > 0) {
          setAuto((a) => a - 1);
          setTimeout(() => {
            if (autoRef.current > 0) handleSpin();
          }, turbo ? 500 : 900);
        }
      }, baseDelay + stepDelay * 2);
    } catch (e) {
      toast.error(errMsg(e));
      setSpinning([false, false, false]);
      setBouncing([false, false, false]);
      setBusy(false);
      setAuto(0);
    }
  };

  const isWinningSlot = (idx: number) => {
    return wins.some((w) => LINES[w.line]?.includes(idx));
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3">
      {/* Inline Slot Animation Keyframes */}
      <style>{`
        @keyframes slotRoll {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        @keyframes reelSnapBounce {
          0% { transform: translateY(-16px); }
          65% { transform: translateY(4px); }
          100% { transform: translateY(0); }
        }
        .animate-slot-roll {
          animation: slotRoll 0.28s linear infinite;
        }
        .animate-slot-roll-turbo {
          animation: slotRoll 0.16s linear infinite;
        }
        .animate-reel-bounce {
          animation: reelSnapBounce 0.24s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
      `}</style>

      {/* Game Stage Container */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500/50 bg-gradient-to-b from-[#24032d] via-[#16001d] to-[#0a000d] p-3 shadow-2xl">
        {/* Top Bar with Sound and Paytable */}
        <div className="flex items-center justify-between pb-1">
          <button
            onClick={() => setSound((s) => !s)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/30 bg-black/40 text-amber-300 transition hover:bg-black/60"
          >
            {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
          </button>

          <button
            onClick={() => setShowPaytable(true)}
            className="flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
          >
            <Info className="h-3.5 w-3.5" />
            <span>Paytable</span>
          </button>
        </div>

        {/* Master Tigress Mascot */}
        <TigressMascot
          isRoaring={winAmount !== null && winAmount > 0}
          isFeature={isFeature}
          isSpinning={isAnySpinning}
        />

        {/* 10x Full Screen Multiplier Alert */}
        {isFullScreen && (
          <div className="mb-2 animate-bounce rounded-xl border-2 border-yellow-300 bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 py-1.5 text-center font-display text-sm font-black text-black shadow-[0_0_25px_gold]">
            ★ 10x FULL GRID TIGRESS MULTIPLIER! ★
          </div>
        )}

        {/* 3x3 Slot Machine Reels Frame */}
        <div className="relative rounded-2xl border-4 border-amber-500/80 bg-gradient-to-b from-[#3b0840] via-[#1c031f] to-[#0c000e] p-2 shadow-[inset_0_0_24px_rgba(0,0,0,0.95)]">
          {/* Decorative Corner Embellishments */}
          <div className="pointer-events-none absolute -top-2 -left-2 h-5 w-5 rounded-tl-lg border-t-2 border-l-2 border-yellow-300" />
          <div className="pointer-events-none absolute -top-2 -right-2 h-5 w-5 rounded-tr-lg border-t-2 border-r-2 border-yellow-300" />
          <div className="pointer-events-none absolute -bottom-2 -left-2 h-5 w-5 rounded-bl-lg border-b-2 border-l-2 border-yellow-300" />
          <div className="pointer-events-none absolute -bottom-2 -right-2 h-5 w-5 rounded-br-lg border-b-2 border-r-2 border-yellow-300" />

          {/* 3 Columns (Reels) */}
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((colIdx) => {
              const isColSpinning = spinning[colIdx];
              const isColBouncing = bouncing[colIdx];
              const slotIndices = [colIdx, colIdx + 3, colIdx + 6];

              return (
                <div
                  key={colIdx}
                  className={cn(
                    "relative flex flex-col gap-2 overflow-hidden rounded-xl bg-black/60 p-1 shadow-inner",
                    isColBouncing && "animate-reel-bounce"
                  )}
                >
                  {isColSpinning ? (
                    /* Authentic Rolling Slot Strip Animation */
                    <div className="relative h-[258px] w-full overflow-hidden rounded-lg">
                      {/* Top & Bottom dark shadow gradient overlay */}
                      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-10 bg-gradient-to-b from-black via-black/70 to-transparent" />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-10 bg-gradient-to-t from-black via-black/70 to-transparent" />

                      {/* Rapidly scrolling symbol track */}
                      <div
                        className={cn(
                          "flex flex-col gap-2 blur-[1.5px]",
                          turbo ? "animate-slot-roll-turbo" : "animate-slot-roll"
                        )}
                      >
                        {REEL_STRIP.concat(REEL_STRIP).map((symId, sIdx) => (
                          <div
                            key={sIdx}
                            className="flex aspect-square h-[78px] w-full shrink-0 items-center justify-center rounded-lg border border-amber-900/40 bg-gradient-to-b from-purple-950/40 to-black/60 p-1"
                          >
                            <TigerSymbol id={symId} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Stopped Reel: 3 slots */
                    slotIndices.map((slotIdx) => {
                      const isWin = isWinningSlot(slotIdx);
                      return (
                        <div
                          key={slotIdx}
                          className={cn(
                            "relative flex aspect-square items-center justify-center rounded-lg border transition-all duration-200",
                            isWin
                              ? "border-yellow-300 bg-yellow-500/25 shadow-[0_0_16px_rgba(253,224,71,0.9)] scale-102"
                              : "border-purple-900/40 bg-gradient-to-b from-purple-950/30 to-black/50"
                          )}
                        >
                          <TigerSymbol id={grid[slotIdx] ?? 0} />

                          {/* Win pulse badge */}
                          {isWin && (
                            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
                              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-yellow-500 border border-yellow-200" />
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>

          {/* Win Lines Badges (Shown ONLY on Win) */}
          {wins.length > 0 && !isAnySpinning && (
            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5 text-center">
              {wins.map((w, idx) => (
                <span
                  key={idx}
                  className="rounded-full border border-yellow-400 bg-yellow-500/20 px-2.5 py-0.5 text-[11px] font-black text-yellow-300 shadow-[0_0_8px_rgba(234,179,8,0.5)]"
                >
                  Line {w.line + 1}: +{fmt(w.pay)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Dynamic Win Display Bar: Shown ONLY on win; On loss shows nothing! */}
        {winAmount !== null && winAmount > 0 && !isAnySpinning && (
          <div className="mt-3 flex items-center justify-between rounded-xl border-2 border-yellow-400/90 bg-gradient-to-r from-amber-950/90 via-yellow-900/60 to-amber-950/90 px-4 py-2.5 shadow-[0_0_20px_rgba(234,179,8,0.5)] animate-pop">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-300 animate-spin" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black tracking-widest text-yellow-300 uppercase">
                  WINNER!
                </span>
                <span className="font-display text-xl font-black text-yellow-300 drop-shadow-[0_2px_8px_rgba(250,204,21,0.8)]">
                  +{fmt(winAmount)}
                </span>
              </div>
            </div>

            <span className="rounded-full border border-yellow-300 bg-yellow-400/30 px-3 py-1 font-display text-xs font-black text-yellow-200">
              {(winAmount / stake).toFixed(1)}x
            </span>
          </div>
        )}
      </div>

      {/* Control Panel: Bet size & Spin controls */}
      <div className="flex flex-col gap-2.5 rounded-2xl border border-purple-900/60 bg-card p-3 shadow-card">
        {/* Stake adjusters */}
        <div className="flex items-center justify-between gap-2">
          <button
            disabled={busy || isAnySpinning}
            onClick={() => adjustStake(-10)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary font-display text-lg font-bold transition hover:bg-muted active:scale-95 disabled:opacity-50"
          >
            -
          </button>

          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-purple-900/40 bg-background/80 py-1.5 shadow-inner">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">TOTAL BET (5 Lines)</span>
            <span className="font-display text-lg font-black text-foreground">
              {fmt(stake)}
            </span>
          </div>

          <button
            disabled={busy || isAnySpinning}
            onClick={() => adjustStake(10)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary font-display text-lg font-bold transition hover:bg-muted active:scale-95 disabled:opacity-50"
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
                "rounded-lg border py-1.5 font-display text-xs font-bold transition active:scale-95 disabled:opacity-50",
                stake === amt
                  ? "border-amber-400 bg-amber-500/20 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                  : "border-border bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {amt}
            </button>
          ))}
        </div>

        {/* Turbo Mode & Auto Spin Settings */}
        <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-2">
          <button
            onClick={() => setTurbo((t) => !t)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition",
              turbo
                ? "border-amber-400 bg-amber-500/20 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                : "border-border bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            <Zap className={cn("h-4 w-4", turbo && "fill-amber-300")} />
            <span>TURBO {turbo ? "ON" : "OFF"}</span>
          </button>

          <button
            disabled={busy || isAnySpinning}
            onClick={() => setAuto((a) => (a === 0 ? 10 : a === 10 ? 50 : 0))}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition disabled:opacity-50",
              auto > 0
                ? "border-primary bg-primary/20 text-primary"
                : "border-border bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            <span>AUTO: {auto > 0 ? `${auto} SPINS` : "OFF"}</span>
          </button>
        </div>

        {/* Main Spin Button */}
        <button
          disabled={busy || isAnySpinning || (profile?.balance ?? 0) < stake}
          onClick={handleSpin}
          className={cn(
            "relative mt-1 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl py-3.5 font-display text-lg font-black uppercase tracking-wider text-black shadow-lg transition-all active:scale-[0.98] disabled:opacity-50",
            isAnySpinning
              ? "bg-amber-600/60 text-black/60 cursor-not-allowed"
              : "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 hover:brightness-110 shadow-[0_4px_20px_rgba(245,158,11,0.5)]"
          )}
        >
          {isAnySpinning ? (
            <span className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 animate-spin" />
              <span>SPINNING...</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span>SPIN</span>
              <span className="rounded-full bg-black/20 px-2 py-0.5 text-xs font-bold">
                {fmt(stake)}
              </span>
            </span>
          )}
        </button>
      </div>

      {/* Paytable Dialog Modal */}
      {showPaytable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-pop">
          <div className="relative max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl border-2 border-amber-500/50 bg-[#1e0324] p-4 text-foreground shadow-2xl">
            <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
              <h3 className="font-display text-base font-black text-amber-300">
                MASTER TIGRESS PAYTABLE
              </h3>
              <button
                onClick={() => setShowPaytable(false)}
                className="rounded-lg bg-black/40 p-1 text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <span className="text-[11px] font-bold text-amber-200 uppercase">
                Symbol Multipliers (3-of-a-kind per line):
              </span>
              {SYMBOL_NAMES.map((name, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl border border-purple-900/40 bg-black/40 p-2"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-lg border border-amber-400/30 bg-black/50 p-0.5">
                      <TigerSymbol id={i} />
                    </div>
                    <span className="text-xs font-bold">{name}</span>
                  </div>
                  <span className="font-display text-sm font-black text-amber-300">
                    {PAYOUTS_MULT[i]}x
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-200">
              <p className="font-bold text-amber-300">★ Special Features:</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px]">
                <li><b>Wild Tigress:</b> Substitutes for any symbol on paylines.</li>
                <li><b>10x Full Screen:</b> If all 9 positions fill with matching symbols and/or Wilds, all payouts are multiplied by 10x!</li>
              </ul>
            </div>

            <button
              onClick={() => setShowPaytable(false)}
              className="mt-4 w-full rounded-xl bg-amber-500 py-2 font-display text-sm font-bold text-black hover:bg-amber-400"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Result Celebration Popup for Big Wins */}
      <ResultPopup outcome={outcome} onClose={() => setOutcome(null)} />
    </div>
  );
}
