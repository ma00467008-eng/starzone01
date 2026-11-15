"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { playSound, fmt } from "@/lib/sound";
import { Stage, Panel, AmountInput, Chips, QuickButtons, ActionBtn, Pop, HistoryStrip } from "@/components/sz/kit";
import { supabase } from "@/integrations/supabase/client";

// ============================================================================
// 1. SKY CRASH (AVIATOR STYLE WITH 10S COUNTDOWN)
// ============================================================================
type CrashPhase = "betting" | "flying" | "crashed";

export function CrashGame({ balance = 1000, onWin }: { balance?: number; onWin?: (amount: number) => void }) {
  const [phase, setPhase] = useState<CrashPhase>("betting");
  const [countdown, setCountdown] = useState<number>(10);
  const [mult, setMult] = useState<number>(1.0);
  const [history, setHistory] = useState<number[]>([1.42, 2.85, 1.12, 14.2, 1.88, 3.45, 1.05, 5.12]);

  const [betAmount, setBetAmount] = useState<number>(100);
  const [autoCashout, setAutoCashout] = useState<string>("2.00");
  const [hasBet, setHasBet] = useState<boolean>(false);
  const [cashedOut, setCashedOut] = useState<boolean>(false);
  const [cashoutMult, setCashoutMult] = useState<number>(0);

  const [queuedBet, setQueuedBet] = useState<boolean>(false);
  const [gameId, setGameId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const targetCrashRef = useRef<number>(2.0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const hasBetRef = useRef<boolean>(false);
  const cashedOutRef = useRef<boolean>(false);
  const autoCashRef = useRef<number>(2.0);
  const betAmountRef = useRef<number>(100);
  const gameIdRef = useRef<string | null>(null);

  hasBetRef.current = hasBet;
  cashedOutRef.current = cashedOut;
  betAmountRef.current = betAmount;
  gameIdRef.current = gameId;

  const parsedAuto = parseFloat(autoCashout);
  autoCashRef.current = isNaN(parsedAuto) || parsedAuto < 1.01 ? 0 : parsedAuto;

  const generateCrashPoint = (): number => {
    const r = Math.random();
    if (r < 0.04) return 1.0;
    if (r < 0.5) return +(1.0 + Math.random() * 1.5).toFixed(2);
    if (r < 0.8) return +(2.0 + Math.random() * 3.0).toFixed(2);
    if (r < 0.95) return +(5.0 + Math.random() * 10.0).toFixed(2);
    return +(15.0 + Math.random() * 50.0).toFixed(2);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (phase === "betting") {
      setCountdown(10);
      setMult(1.0);
      setCashedOut(false);
      setCashoutMult(0);

      if (queuedBet) {
        setHasBet(true);
        setQueuedBet(false);
      }

      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            startFlight();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [phase]);

  const startFlight = async () => {
    setPhase("flying");
    targetCrashRef.current = generateCrashPoint();
    startTimeRef.current = performance.now();
    playSound("takeoff");

    if (hasBetRef.current) {
      try {
        const { data, error } = await supabase.rpc("crash_start", {
          p_amount: betAmountRef.current,
          p_auto_cashout: autoCashRef.current > 1 ? autoCashRef.current : null,
        });
        if (!error && data?.game_id) {
          setGameId(data.game_id);
          if (data.crash_point) targetCrashRef.current = Number(data.crash_point);
        }
      } catch (e) {
        console.error("Crash RPC error", e);
      }
    }

    const animate = (now: number) => {
      const elapsed = (now - startTimeRef.current) / 1000;
      const currentMult = +(1.0 + 0.08 * Math.pow(elapsed, 1.8)).toFixed(2);

      if (
        hasBetRef.current &&
        !cashedOutRef.current &&
        autoCashRef.current > 1.0 &&
        currentMult >= autoCashRef.current
      ) {
        doCashout(autoCashRef.current);
      }

      if (currentMult >= targetCrashRef.current) {
        handleCrash(targetCrashRef.current);
      } else {
        setMult(currentMult);
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
  };

  const doCashout = async (atMultiplier: number) => {
    if (cashedOutRef.current || !hasBetRef.current) return;
    setCashedOut(true);
    setCashoutMult(atMultiplier);
    playSound("cashout");

    const winAmount = +(betAmountRef.current * atMultiplier).toFixed(2);
    if (onWin) onWin(winAmount);

    if (gameIdRef.current) {
      try {
        await supabase.rpc("crash_check", {
          p_game_id: gameIdRef.current,
          p_multiplier: atMultiplier,
        });
      } catch (e) {
        console.error("Cashout RPC error", e);
      }
    }
  };

  const handleCrash = (finalMult: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setPhase("crashed");
    setMult(finalMult);
    playSound("explode");
    setHistory((prev) => [finalMult, ...prev.slice(0, 11)]);

    setTimeout(() => {
      setHasBet(false);
      setGameId(null);
      setPhase("betting");
    }, 2500);
  };

  const placeBetNow = () => {
    if (phase === "betting") {
      setHasBet(true);
      playSound("click");
    } else {
      setQueuedBet(true);
      playSound("click");
    }
  };

  const cancelBetNow = () => {
    if (phase === "betting") setHasBet(false);
    else setQueuedBet(false);
    playSound("click");
  };

  const progressX = Math.min(88, ((mult - 1) / (targetCrashRef.current + 1)) * 90);
  const progressY = Math.min(82, ((mult - 1) / (targetCrashRef.current + 1)) * 85);

  return (
    <div className="space-y-4">
      <Stage title="Aviator" subtitle="Rounds start automatically every 10 seconds">
        <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="font-semibold text-slate-400">History:</span>
          {history.map((m, idx) => (
            <span
              key={idx}
              className={`rounded px-2 py-0.5 font-mono font-bold text-xs ${
                m >= 2.0 ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
              }`}
            >
              {m.toFixed(2)}x
            </span>
          ))}
        </div>

        <div className="relative h-64 w-full overflow-hidden rounded-xl border border-slate-800 bg-gradient-to-b from-slate-950 via-[#0a0f1d] to-[#040711]">
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />

          {phase === "betting" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="text-xs uppercase tracking-wider text-slate-400">Next round in</div>
              <div className="font-mono text-5xl font-black text-rose-500">{countdown}s</div>
              <div className="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-rose-500 transition-all duration-1000 linear"
                  style={{ width: `${(countdown / 10) * 100}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {hasBet ? "Your bet is confirmed!" : "Place your bet before plane takes off"}
              </p>
            </div>
          )}

          <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center">
            <div
              className={`font-mono text-5xl font-black tracking-tight ${
                phase === "crashed" ? "text-rose-500" : "text-white"
              }`}
            >
              {mult.toFixed(2)}x
            </div>
            {phase === "crashed" && (
              <div className="text-xs font-bold uppercase tracking-widest text-rose-400">Flew Away!</div>
            )}
          </div>

          <svg className="absolute inset-0 h-full w-full pointer-events-none">
            <path
              d={`M 10 240 Q ${20 + progressX * 4} 240 ${10 + progressX * 6.5} ${240 - progressY * 2.2}`}
              fill="none"
              stroke="#e11d48"
              strokeWidth="3"
            />
            <path
              d={`M 10 240 Q ${20 + progressX * 4} 240 ${10 + progressX * 6.5} ${240 - progressY * 2.2} L ${
                10 + progressX * 6.5
              } 250 L 10 250 Z`}
              fill="rgba(225, 29, 72, 0.15)"
            />
          </svg>

          {phase === "flying" && (
            <div
              className="absolute transition-all duration-75"
              style={{
                left: `${10 + progressX * 0.8}%`,
                bottom: `${10 + progressY * 0.7}%`,
              }}
            >
              <div className="relative -rotate-12">
                <div className="flex items-center">
                  <div className="h-6 w-14 rounded-r-full bg-rose-600 shadow-lg shadow-rose-600/50 flex items-center justify-end pr-2 text-[10px] font-black text-white">
                    ✈
                  </div>
                  <div className="h-2 w-8 bg-gradient-to-r from-rose-500/80 to-transparent blur-[1px]" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">Bet Amount (PKR)</span>
              <span className="text-xs text-slate-500">Bal: {fmt(balance)}</span>
            </div>
            <AmountInput value={betAmount} onChange={setBetAmount} />
            <div className="mt-2">
              <Chips
                values={[50, 100, 200, 500, 1000]}
                selected={betAmount}
                onSelect={(v) => setBetAmount(v)}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-400">Auto Cashout (x)</span>
              <input
                type="text"
                value={autoCashout}
                onChange={(e) => setAutoCashout(e.target.value)}
                className="w-24 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-right text-xs font-mono font-bold text-white"
                placeholder="2.00"
              />
            </div>

            {phase === "flying" && hasBet && !cashedOut ? (
              <button
                onClick={() => doCashout(mult)}
                className="w-full rounded-lg bg-emerald-500 py-3 font-bold text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 active:scale-95 transition-all"
              >
                CASH OUT {fmt(betAmount * mult)}
              </button>
            ) : hasBet ? (
              <button
                onClick={cancelBetNow}
                disabled={phase === "flying"}
                className="w-full rounded-lg bg-rose-600/80 py-3 font-bold text-white hover:bg-rose-600 transition-all"
              >
                {phase === "flying" ? "In Flight..." : "Cancel Bet"}
              </button>
            ) : queuedBet ? (
              <button
                onClick={cancelBetNow}
                className="w-full rounded-lg bg-amber-600/80 py-3 font-bold text-white hover:bg-amber-600 transition-all"
              >
                Cancel Queued Bet
              </button>
            ) : (
              <button
                onClick={placeBetNow}
                className="w-full rounded-lg bg-rose-600 py-3 font-bold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 active:scale-95 transition-all"
              >
                {phase === "betting" ? "BET FOR NEXT ROUND" : "BET FOR NEXT ROUND"}
              </button>
            )}
          </div>
        </div>
      </Stage>
    </div>
  );
}

// ============================================================================
// 2. MINES GAME (UNCHANGED)
// ============================================================================
export function MinesGame({ balance = 1000, onWin }: { balance?: number; onWin?: (amount: number) => void }) {
  const [betAmount, setBetAmount] = useState<number>(100);
  const [minesCount, setMinesCount] = useState<number>(3);
  const [inGame, setInGame] = useState<boolean>(false);
  const [grid, setGrid] = useState<(string | null)[]>(Array(25).fill(null));
  const [currentMult, setCurrentMult] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(false);
  const [gameId, setGameId] = useState<string | null>(null);

  const startGame = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("mines_start", {
        p_amount: betAmount,
        p_mines: minesCount,
      });
      if (!error && data?.game_id) {
        setGameId(data.game_id);
        setGrid(Array(25).fill(null));
        setCurrentMult(1.0);
        setInGame(true);
        playSound("click");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const revealTile = async (idx: number) => {
    if (!inGame || grid[idx] !== null || loading || !gameId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("mines_step", {
        p_game_id: gameId,
        p_tile: idx,
      });

      if (!error && data) {
        const newGrid = [...grid];
        if (data.status === "hit_mine") {
          newGrid[idx] = "mine";
          setGrid(newGrid);
          setInGame(false);
          playSound("explode");
        } else {
          newGrid[idx] = "gem";
          setGrid(newGrid);
          setCurrentMult(Number(data.multiplier) || +(currentMult * 1.25).toFixed(2));
          playSound("click");
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const cashout = async () => {
    if (!inGame || !gameId || loading) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("mines_cashout", { p_game_id: gameId });
      if (!error) {
        playSound("cashout");
        const win = betAmount * currentMult;
        if (onWin) onWin(win);
        setInGame(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stage title="Mines" subtitle="Pick safe gems, avoid the hidden mines">
      <div className="grid grid-cols-5 gap-2 max-w-sm mx-auto p-4 bg-slate-950 rounded-2xl border border-slate-800">
        {grid.map((cell, idx) => (
          <button
            key={idx}
            disabled={!inGame || cell !== null}
            onClick={() => revealTile(idx)}
            className={`h-14 rounded-xl font-bold flex items-center justify-center text-xl transition-all ${
              cell === "gem"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                : cell === "mine"
                ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                : "bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700/50"
            }`}
          >
            {cell === "gem" ? "💎" : cell === "mine" ? "💣" : ""}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <Panel title="Stake (PKR)">
          <AmountInput value={betAmount} onChange={setBetAmount} />
          <div className="mt-2">
            <Chips values={[50, 100, 200, 500]} selected={betAmount} onSelect={setBetAmount} />
          </div>
        </Panel>

        <Panel title="Mines Count">
          <div className="flex gap-2">
            {[1, 3, 5, 10].map((m) => (
              <button
                key={m}
                disabled={inGame}
                onClick={() => setMinesCount(m)}
                className={`flex-1 py-2 rounded-lg font-bold text-xs ${
                  minesCount === m ? "bg-rose-600 text-white" : "bg-slate-800 text-slate-300"
                }`}
              >
                {m} Mines
              </button>
            ))}
          </div>

          <div className="mt-4">
            {inGame ? (
              <button
                onClick={cashout}
                className="w-full py-3 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-400"
              >
                Cashout {fmt(betAmount * currentMult)}
              </button>
            ) : (
              <button
                onClick={startGame}
                className="w-full py-3 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-500"
              >
                Start Mines
              </button>
            )}
          </div>
        </Panel>
      </div>
    </Stage>
  );
}

// ============================================================================
// 3. CHICKEN ROAD 2.0 (SOLID WHITE CHICKEN + QUIET ROADS + 3-6S CAR + HIGH LOSS)
// ============================================================================
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

export function ChickenGame({ balance = 1000, onWin }: { balance?: number; onWin?: (amount: number) => void }) {
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [betAmount, setBetAmount] = useState<number>(100);

  const [inGame, setInGame] = useState<boolean>(false);
  const [currentRoad, setCurrentRoad] = useState<number>(0); // 0 = start sidewalk, 1, 2, 3 = highway
  const [status, setStatus] = useState<"idle" | "playing" | "won" | "crashed">("idle");
  const [gameId, setGameId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Active car (at most 1 single car at any time on the highway)
  const [activeCar, setActiveCar] = useState<SingleCar | null>(null);
  const carIdRef = useRef<number>(1);

  // High loss probabilities per step
  const crashRates = {
    easy: 0.45,     // 45% chance to be crushed
    medium: 0.60,   // 60% chance to be crushed
    hard: 0.75,     // 75% chance to be crushed
    hardcore: 0.88, // 88% chance to be crushed
  };

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

  // NO CONTINUOUS TRAFFIC: exactly 1 car appears every 3 to 6 seconds, drives across, and disappears
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const spawnSingleCar = () => {
      // Quiet pause of 3 to 6 seconds
      const delay = 3000 + Math.random() * 3000;

      timeoutId = setTimeout(() => {
        const road = Math.floor(Math.random() * 3) + 1; // Random road 1, 2, or 3
        const direction: "left-to-right" | "right-to-left" = road % 2 === 0 ? "right-to-left" : "left-to-right";

        // Speed is either a slow cruise or an instant supersonic zoom
        const isFast = Math.random() < 0.45;
        const speed = isFast ? 3.0 : 0.65; // slow or instant fast

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

    // 60FPS mover for the active car
    const moveTimer = setInterval(() => {
      setActiveCar((prev) => {
        if (!prev) return null;
        const nextX = prev.direction === "left-to-right" ? prev.x + prev.speed : prev.x - prev.speed;

        // When car drives off screen, remove it and schedule the next quiet pause
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
        setGameId(`local_${Date.now()}`);
      }

      setCurrentRoad(0);
      setStatus("playing");
      setInGame(true);
      playSound("click");
    } catch (e) {
      setGameId(`local_${Date.now()}`);
      setCurrentRoad(0);
      setStatus("playing");
      setInGame(true);
    } finally {
      setLoading(false);
    }
  };

  // Cross to the next highway road
  const crossRoad = async () => {
    if (!inGame || loading) return;
    setLoading(true);
    const nextRoad = currentRoad + 1;

    try {
      let isCrashed = Math.random() < crashRates[difficulty];

      // Also check backend RPC if connected
      if (gameId && !gameId.startsWith("local_")) {
        const { data } = await supabase.rpc("chicken_step", { p_game_id: gameId });
        if (data?.status === "crashed" || data?.status === "hit") {
          isCrashed = true;
        }
      }

      if (isCrashed) {
        // High-speed crusher car zooms right over the chicken on this road
        const direction = nextRoad % 2 === 0 ? "right-to-left" : "left-to-right";
        setActiveCar({
          id: carIdRef.current++,
          road: nextRoad,
          color: "#b91c1c", // Dark red muscle car
          x: direction === "left-to-right" ? -25 : 125,
          speed: 4.5, // Instant impact zoom
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

        // Safely cleared all 3 roads!
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
      if (gameId && !gameId.startsWith("local_")) {
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

  // PURE SOLID WHITE CARTOON CHICKEN (With Crisp Black Outline + White Feather Glow)
  const renderChicken = (isCrushed: boolean) => (
    <div
      className={`relative w-20 h-20 transition-all duration-300 select-none drop-shadow-[0_0_15px_rgba(255,255,255,0.6)] ${
        isCrushed ? "scale-y-[0.2] scale-x-125 translate-y-5 opacity-90" : "animate-bounce"
      }`}
    >
      <svg viewBox="0 0 120 120" className="w-full h-full overflow-visible">
        {/* Bright Yellow Feet */}
        <path d="M 44 94 L 32 112 M 44 94 L 44 112 M 44 94 L 56 112" stroke="#f59e0b" strokeWidth="5.5" strokeLinecap="round" />
        <path d="M 76 94 L 64 112 M 76 94 L 76 112 M 76 94 L 88 112" stroke="#f59e0b" strokeWidth="5.5" strokeLinecap="round" />

        {/* Tail Feathers - Pure White with black border */}
        <path d="M 22 56 C 6 46 8 68 24 74 Z" fill="#ffffff" stroke="#0f172a" strokeWidth="3" />
        <path d="M 20 46 C 4 34 6 56 22 62 Z" fill="#ffffff" stroke="#0f172a" strokeWidth="3" />

        {/* Big Plump PURE SOLID SNOW-WHITE Body */}
        <ellipse cx="60" cy="66" rx="36" ry="30" fill="#ffffff" stroke="#0f172a" strokeWidth="3.5" />

        {/* Wing - Pure White with crisp outline */}
        <path
          d="M 44 60 C 38 82 66 88 72 70 C 72 56 54 54 44 60 Z"
          fill="#ffffff"
          stroke="#0f172a"
          strokeWidth="3"
        />

        {/* Head - Pure Solid White */}
        <circle cx="78" cy="40" r="22" fill="#ffffff" stroke="#0f172a" strokeWidth="3.5" />

        {/* Bright Red Comb / Crown */}
        <path
          d="M 66 22 C 66 12 74 12 76 22 C 78 10 88 10 90 22 C 92 12 100 14 98 25"
          fill="#ef4444"
          stroke="#991b1b"
          strokeWidth="2.5"
        />

        {/* Red Wattle below beak */}
        <ellipse cx="96" cy="52" rx="5.5" ry="8" fill="#ef4444" stroke="#991b1b" strokeWidth="2" />

        {/* Bright Orange/Yellow Beak */}
        <polygon points="94,36 116,42 94,48" fill="#f59e0b" stroke="#b45309" strokeWidth="2.5" />

        {/* Big Shiny Eyes */}
        <circle cx="84" cy="36" r="6.5" fill="#0f172a" />
        <circle cx="86.5" cy="34" r="2.5" fill="#ffffff" />

        {/* Crushed tyre marks & stars */}
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

  // Render Car on the Highway
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

          {/* Bright Headlights & Light Beam */}
          <div className="absolute top-2 right-0.5 h-3 w-2 bg-yellow-200 rounded-full shadow-[0_0_16px_#fde047]" />
          <div className="absolute bottom-2 right-0.5 h-3 w-2 bg-yellow-200 rounded-full shadow-[0_0_16px_#fde047]" />

          {/* Taillights */}
          <div className="absolute top-2.5 left-0.5 h-2.5 w-1.5 bg-rose-500 rounded-full" />
          <div className="absolute bottom-2.5 left-0.5 h-2.5 w-1.5 bg-rose-500 rounded-full" />

          {/* Heavy Wheels */}
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

          {/* 3 WIDE ROADS (EMPTY BY DEFAULT, 1 CAR APPEARS EVERY 3-6S) */}
          <div className="relative flex-1 flex flex-col bg-[#0f141c]">
            {[3, 2, 1].map((roadIndex) => {
              const isCarOnThisRoad = activeCar && activeCar.road === roadIndex;
              const mult = roadMults[roadIndex - 1];

              return (
                <div
                  key={roadIndex}
                  className="relative flex-1 border-b-2 border-dashed border-amber-400/50 flex items-center justify-between px-4 bg-gradient-to-r from-slate-950/30 via-[#18212e] to-slate-950/30"
                >
                  {/* Highway Multiplier Plate */}
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

                  {/* Crushed Flat Chicken */}
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
