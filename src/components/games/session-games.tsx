"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { playSound, fmt } from "@/lib/sound";
import { Stage, Panel, AmountInput, Chips, QuickButtons, ActionBtn, Pop, HistoryStrip } from "@/components/sz/kit";
import { supabase } from "@/integrations/supabase/client";

type Difficulty = "easy" | "medium" | "hard" | "hardcore";

interface SingleCar {
  id: number;
  road: number; // 1, 2, or 3
  color: string;
  x: number;
  speed: number;
  direction: "left-to-right" | "right-to-left";
  isFast: boolean;
}

export function ChickenGame({
  balance = 1000,
  onWin,
}: {
  balance?: number;
  onWin?: (amount: number) => void;
}) {
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [betAmount, setBetAmount] = useState<number>(100);

  const [inGame, setInGame] = useState<boolean>(false);
  const [currentRoad, setCurrentRoad] = useState<number>(0); // 0 = start sidewalk, 1, 2, 3 = highway roads
  const [status, setStatus] = useState<"idle" | "playing" | "won" | "crashed">("idle");
  const [gameId, setGameId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Active vehicle (at most 1 single car appears at a time)
  const [activeCar, setActiveCar] = useState<SingleCar | null>(null);
  const carIdRef = useRef<number>(1);

  // High loss rate per road
  const crashRates: Record<Difficulty, number> = {
    easy: 0.45,     // 45% crash chance
    medium: 0.60,   // 60% crash chance
    hard: 0.75,     // 75% crash chance
    hardcore: 0.88, // 88% crash chance
  };

  // Road multipliers
  const roadMults = useMemo(() => {
    switch (difficulty) {
      case "easy":
        return [1.35, 2.2, 4.0];
      case "medium":
        return [1.75, 3.8, 8.5];
      case "hard":
        return [2.4, 7.0, 22.0];
      case "hardcore":
        return [4.5, 24.0, 120.0];
    }
  }, [difficulty]);

  // NO CONTINUOUS TRAFFIC: exactly 1 car appears every 3 to 6 seconds, then leaves the road empty
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const spawnSingleCar = () => {
      // Quiet pause of 3 to 6 seconds
      const delay = 3000 + Math.random() * 3000;

      timeoutId = setTimeout(() => {
        const road = Math.floor(Math.random() * 3) + 1; // 1, 2, or 3
        const direction: "left-to-right" | "right-to-left" =
          road % 2 === 0 ? "right-to-left" : "left-to-right";

        // Speed is either slow cruise or instant fast zoom
        const isFast = Math.random() < 0.45;
        const speed = isFast ? 3.2 : 0.65;

        const carColors = ["#ef4444", "#eab308", "#3b82f6", "#10b981", "#8b5cf6"];
        const color = carColors[Math.floor(Math.random() * carColors.length)];

        setActiveCar({
          id: carIdRef.current++,
          road,
          color,
          x: direction === "left-to-right" ? -25 : 125,
          speed,
          direction,
          isFast,
        });
      }, delay);
    };

    spawnSingleCar();

    // Movement loop
    const moveTimer = setInterval(() => {
      setActiveCar((prev) => {
        if (!prev) return null;
        const nextX =
          prev.direction === "left-to-right"
            ? prev.x + prev.speed
            : prev.x - prev.speed;

        // When car exits screen, clear it and wait another 3-6s
        if (nextX > 130 || nextX < -30) {
          spawnSingleCar();
          return null;
        }
        return { ...prev, x: nextX };
      });
    }, 25);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(moveTimer);
    };
  }, []);

  // Start round
  const startGame = async () => {
    if (loading) return;
    setLoading(true);
    setStatus("idle");
    try {
      const { data, error } = await supabase.rpc("chicken_start", {
        p_amount: betAmount,
        p_difficulty: difficulty,
      });

      if (!error && data?.game_id) {
        setGameId(data.game_id);
      } else {
        setGameId(`chicken_${Date.now()}`);
      }

      setCurrentRoad(0);
      setStatus("playing");
      setInGame(true);
      playSound("click");
    } catch {
      setGameId(`chicken_${Date.now()}`);
      setCurrentRoad(0);
      setStatus("playing");
      setInGame(true);
    } finally {
      setLoading(false);
    }
  };

  // Cross road step
  const crossRoad = async () => {
    if (!inGame || loading) return;
    setLoading(true);
    const nextRoad = currentRoad + 1;

    try {
      let isCrashed = Math.random() < crashRates[difficulty];

      if (gameId && !gameId.startsWith("chicken_")) {
        const { data } = await supabase.rpc("chicken_step", {
          p_game_id: gameId,
        });
        if (data?.status === "crashed" || data?.status === "hit") {
          isCrashed = true;
        }
      }

      if (isCrashed) {
        // Crusher car instantly zooms across that road over the chicken
        const direction = nextRoad % 2 === 0 ? "right-to-left" : "left-to-right";
        setActiveCar({
          id: carIdRef.current++,
          road: nextRoad,
          color: "#b91c1c", // Red muscle car
          x: direction === "left-to-right" ? -25 : 125,
          speed: 4.8,
          direction,
          isFast: true,
        });

        setCurrentRoad(nextRoad);
        setStatus("crashed");
        setInGame(false);
        playSound("explode");
      } else {
        setCurrentRoad(nextRoad);
        playSound("click");

        // Safely cleared all 3 roads
        if (nextRoad >= 3) {
          const finalMult = roadMults[2];
          const winAmount = betAmount * finalMult;
          if (onWin) onWin(winAmount);
          setStatus("won");
          setInGame(false);
          playSound("cashout");
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Cash out
  const cashout = async () => {
    if (!inGame || loading || currentRoad === 0) return;
    setLoading(true);
    try {
      if (gameId && !gameId.startsWith("chicken_")) {
        await supabase.rpc("chicken_cashout", { p_game_id: gameId });
      }
      const mult = roadMults[currentRoad - 1] || 1.0;
      const winAmount = betAmount * mult;
      if (onWin) onWin(winAmount);
      setStatus("won");
      setInGame(false);
      playSound("cashout");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const currentMultiplier = currentRoad > 0 ? roadMults[currentRoad - 1] : 1.0;
  const nextMultiplier = roadMults[currentRoad] || roadMults[roadMults.length - 1];

  // PURE SOLID WHITE CHICKEN WITH CRISP BLACK OUTLINE AND GLOW
  const renderChicken = (isCrushed: boolean) => (
    <div
      className={`relative w-20 h-20 transition-all duration-300 select-none drop-shadow-[0_0_16px_rgba(255,255,255,0.7)] ${
        isCrushed ? "scale-y-[0.2] scale-x-125 translate-y-5 opacity-90" : "animate-bounce"
      }`}
    >
      <svg viewBox="0 0 120 120" className="w-full h-full overflow-visible">
        {/* Bright Yellow Feet */}
        <path d="M 44 94 L 32 112 M 44 94 L 44 112 M 44 94 L 56 112" stroke="#f59e0b" strokeWidth="5.5" strokeLinecap="round" />
        <path d="M 76 94 L 64 112 M 76 94 L 76 112 M 76 94 L 88 112" stroke="#f59e0b" strokeWidth="5.5" strokeLinecap="round" />

        {/* Tail Feathers - Pure White */}
        <path d="M 22 56 C 6 46 8 68 24 74 Z" fill="#ffffff" stroke="#0f172a" strokeWidth="3" />
        <path d="M 20 46 C 4 34 6 56 22 62 Z" fill="#ffffff" stroke="#0f172a" strokeWidth="3" />

        {/* Big Plump PURE SOLID WHITE Body */}
        <ellipse cx="60" cy="66" rx="36" ry="30" fill="#ffffff" stroke="#0f172a" strokeWidth="3.5" />

        {/* Wing - Pure White */}
        <path
          d="M 44 60 C 38 82 66 88 72 70 C 72 56 54 54 44 60 Z"
          fill="#ffffff"
          stroke="#0f172a"
          strokeWidth="3"
        />

        {/* Head - Pure White */}
        <circle cx="78" cy="40" r="22" fill="#ffffff" stroke="#0f172a" strokeWidth="3.5" />

        {/* Bright Red Comb / Crown */}
        <path
          d="M 66 22 C 66 12 74 12 76 22 C 78 10 88 10 90 22 C 92 12 100 14 98 25"
          fill="#ef4444"
          stroke="#991b1b"
          strokeWidth="2.5"
        />

        {/* Red Wattle under beak */}
        <ellipse cx="96" cy="52" rx="5.5" ry="8" fill="#ef4444" stroke="#991b1b" strokeWidth="2" />

        {/* Bright Orange/Yellow Beak */}
        <polygon points="94,36 116,42 94,48" fill="#f59e0b" stroke="#b45309" strokeWidth="2.5" />

        {/* Big Black Eyes with Shiny Highlight */}
        <circle cx="84" cy="36" r="6.5" fill="#0f172a" />
        <circle cx="86.5" cy="34" r="2.5" fill="#ffffff" />

        {/* Crushed visual indicators */}
        {isCrushed && (
          <g>
            <text x="35" y="24" fontSize="26">💥</text>
            <text x="80" y="16" fontSize="22">💨</text>
            <line x1="10" y1="76" x2="110" y2="76" stroke="#000000" strokeWidth="14" strokeLinecap="round" opacity="0.8" />
          </g>
        )}
      </svg>
    </div>
  );

  // Render Car on Highway
  const renderCar = (c: SingleCar) => {
    const isFlipped = c.direction === "right-to-left";

    return (
      <div
        className="absolute top-1/2 -translate-y-1/2 pointer-events-none transition-transform z-20"
        style={{
          left: `${c.x}%`,
          transform: `translateY(-50%) ${isFlipped ? "scaleX(-1)" : "scaleX(1)"}`,
        }}
      >
        <div
          className="relative w-28 h-12 rounded-lg shadow-[0_10px_25px_rgba(0,0,0,0.8)] flex items-center justify-center border-2 border-black"
          style={{ backgroundColor: c.color }}
        >
          {/* Windows / Cabin */}
          <div className="absolute top-1.5 left-6 right-7 h-6 rounded bg-slate-900 border border-slate-700 flex items-center justify-between px-1">
            <div className="w-2 h-full bg-slate-400/40 rounded-sm" />
            <div className="w-2 h-full bg-slate-400/40 rounded-sm" />
          </div>

          {/* Headlights */}
          <div className="absolute top-2 right-0.5 h-3 w-2 bg-yellow-200 rounded-full shadow-[0_0_16px_#fde047]" />
          <div className="absolute bottom-2 right-0.5 h-3 w-2 bg-yellow-200 rounded-full shadow-[0_0_16px_#fde047]" />

          {/* Taillights */}
          <div className="absolute top-2.5 left-0.5 h-2.5 w-1.5 bg-rose-500 rounded-full" />
          <div className="absolute bottom-2.5 left-0.5 h-2.5 w-1.5 bg-rose-500 rounded-full" />

          {/* Wheels */}
          <div className="absolute -bottom-2 left-4 w-6 h-4 bg-black rounded-full border border-slate-700" />
          <div className="absolute -bottom-2 right-4 w-6 h-4 bg-black rounded-full border border-slate-700" />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Stage title="Chicken Road 2.0" subtitle="Cross 3 giant roads. Watch out for sudden speeding cars!">
        {/* Difficulty Bar */}
        <div className="mb-3 flex items-center justify-between gap-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-2">
          <span className="text-xs font-bold text-slate-400 pl-1">DIFFICULTY:</span>
          <div className="flex gap-1.5">
            {(["easy", "medium", "hard", "hardcore"] as Difficulty[]).map((d) => (
              <button
                key={d}
                disabled={inGame}
                onClick={() => setDifficulty(d)}
                className={`rounded-lg px-3 py-1 text-xs font-bold uppercase transition-all ${
                  difficulty === d
                    ? d === "hardcore"
                      ? "bg-rose-600 text-white shadow-lg shadow-rose-600/30"
                      : d === "hard"
                      ? "bg-amber-600 text-white shadow-lg shadow-amber-600/30"
                      : "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                    : "bg-slate-900 text-slate-400 hover:bg-slate-800"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* 3 GIANT ROADS HIGHWAY VIEWPORT */}
        <div className="relative h-96 w-full overflow-hidden rounded-2xl border-2 border-slate-800 bg-slate-950 shadow-2xl flex flex-col justify-between">
          {/* Top Finish Safe Zone */}
          <div className="relative h-12 w-full bg-gradient-to-b from-emerald-950 to-emerald-900/80 border-b-2 border-emerald-600/60 flex items-center justify-between px-4 z-10">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span>🏁</span> SAFE FINISH ZONE
            </span>
            <div className="font-mono text-xs font-bold text-emerald-300">
              ROAD: {currentRoad} / 3
            </div>
          </div>

          {/* 3 WIDE ROADS (QUIET BY DEFAULT, 1 CAR EVERY 3-6S) */}
          <div className="relative flex-1 flex flex-col bg-[#0f141c]">
            {[3, 2, 1].map((roadIndex) => {
              const isCarOnThisRoad = activeCar && activeCar.road === roadIndex;
              const mult = roadMults[roadIndex - 1];

              return (
                <div
                  key={roadIndex}
                  className="relative flex-1 border-b-2 border-dashed border-amber-400/50 flex items-center justify-between px-4 bg-gradient-to-r from-slate-950/30 via-[#18212e] to-slate-950/30"
                >
                  {/* Highway Multiplier Tag */}
                  <div className="z-10 rounded-lg bg-black/80 px-3 py-1 font-mono text-xs font-black text-amber-400 border border-amber-500/40 shadow-lg">
                    ROAD {roadIndex} • {mult.toFixed(2)}x
                  </div>

                  {/* Render the single car if on this road */}
                  {isCarOnThisRoad && renderCar(activeCar)}

                  {/* Pure White Chicken on this Road */}
                  {inGame && currentRoad === roadIndex && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-10">
                      {renderChicken(false)}
                    </div>
                  )}

                  {/* Crushed Chicken under Car */}
                  {status === "crashed" && currentRoad === roadIndex && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-10">
                      {renderChicken(true)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Starting Sidewalk */}
          <div className="relative h-16 w-full bg-gradient-to-t from-slate-950 via-slate-900 to-slate-800 border-t-2 border-slate-700 flex items-center justify-between px-4 z-10">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">START:</span>
              {(!inGame || currentRoad === 0) && (
                <div className="z-20 scale-90">{renderChicken(status === "crashed" && currentRoad === 0)}</div>
              )}
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-950/90 px-4 py-1.5 text-right">
              <div className="text-[10px] uppercase font-bold text-slate-400">Current Payout</div>
              <div className="font-mono text-base font-black text-emerald-400">
                {fmt(betAmount * currentMultiplier)} ({currentMultiplier.toFixed(2)}x)
              </div>
            </div>
          </div>

          {/* Crushed Screen Overlay */}
          {status === "crashed" && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-40 animate-fade-in">
              <div className="text-5xl mb-2">💥🚗🐔</div>
              <div className="font-mono text-3xl font-black text-rose-500 tracking-wider">CHICKEN CRUSHED!</div>
              <p className="text-xs text-slate-300 mt-1">A car rushed over the chicken!</p>
              <button
                onClick={() => setStatus("idle")}
                className="mt-4 rounded-xl bg-slate-800 px-6 py-2.5 text-xs font-bold text-white hover:bg-slate-700 border border-slate-700 shadow-lg"
              >
                TRY AGAIN
              </button>
            </div>
          )}

          {/* Victory Screen Overlay */}
          {status === "won" && (
            <div className="absolute inset-0 bg-emerald-950/85 backdrop-blur-sm flex flex-col items-center justify-center z-40 animate-fade-in">
              <div className="text-5xl mb-2">🎉🏆🐔</div>
              <div className="font-mono text-3xl font-black text-emerald-400 tracking-wider">
                SAFE ACROSS! WON {fmt(betAmount * currentMultiplier)}
              </div>
              <p className="text-xs text-emerald-200 mt-1">Crossed all roads without getting hit.</p>
              <button
                onClick={() => setStatus("idle")}
                className="mt-4 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/30"
              >
                PLAY AGAIN
              </button>
            </div>
          )}
        </div>

        {/* Betting & Play Controls */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">Stake (PKR)</span>
              <span className="text-xs text-slate-500">Bal: {fmt(balance)}</span>
            </div>
            <AmountInput value={betAmount} onChange={setBetAmount} />
            <div className="mt-2">
              <Chips values={[50, 100, 200, 500, 1000]} selected={betAmount} onSelect={setBetAmount} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-400 font-semibold">Next Road Multiplier:</span>
              <span className="font-mono font-bold text-amber-400">{nextMultiplier.toFixed(2)}x</span>
            </div>

            {inGame ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={crossRoad}
                  disabled={loading}
                  className="rounded-lg bg-amber-500 py-3 font-bold text-slate-950 shadow-lg shadow-amber-500/30 hover:bg-amber-400 active:scale-95 transition-all text-sm uppercase"
                >
                  CROSS ROAD 🐾
                </button>
                <button
                  onClick={cashout}
                  disabled={loading || currentRoad === 0}
                  className="rounded-lg bg-emerald-500 py-3 font-bold text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 active:scale-95 transition-all text-sm uppercase"
                >
                  CASHOUT ({fmt(betAmount * currentMultiplier)})
                </button>
              </div>
            ) : (
              <button
                onClick={startGame}
                disabled={loading}
                className="w-full rounded-lg bg-rose-600 py-3 font-bold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 active:scale-95 transition-all text-sm uppercase tracking-wide"
              >
                START GAME
              </button>
            )}
          </div>
        </div>
      </Stage>
    </div>
  );
}

export default ChickenGame;
