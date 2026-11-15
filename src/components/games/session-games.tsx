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
// 3. CHICKEN ROAD 2.0 (ACCURATE WHITE CHICKEN + NATURAL RANDOM TRAFFIC INTERVALS)
// ============================================================================
type Difficulty = "easy" | "medium" | "hard" | "hardcore";

interface Vehicle {
  id: number;
  lane: number;
  type: "sports_red" | "taxi_yellow" | "van_blue" | "coupe_purple" | "truck_cyan";
  x: number; // percentage along road -20 to 120
  speed: number;
  direction: "left-to-right" | "right-to-left";
}

export function ChickenGame({ balance = 1000, onWin }: { balance?: number; onWin?: (amount: number) => void }) {
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [betAmount, setBetAmount] = useState<number>(100);

  const [inGame, setInGame] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [status, setStatus] = useState<"idle" | "playing" | "won" | "crashed">("idle");
  const [gameId, setGameId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [crashVehicle, setCrashVehicle] = useState<boolean>(false);

  // Difficulty configurations matching Chicken Road 2 guidelines
  const config = useMemo(() => {
    switch (difficulty) {
      case "easy":
        return {
          totalLanes: 30,
          mults: [1.02, 1.05, 1.08, 1.12, 1.16, 1.21, 1.27, 1.34, 1.42, 1.51, 1.62, 1.74, 1.88, 2.05, 2.25],
          trafficChance: 0.12, // Low car density with long pauses
          speedRange: [0.35, 0.65],
        };
      case "medium":
        return {
          totalLanes: 25,
          mults: [1.08, 1.18, 1.31, 1.46, 1.64, 1.86, 2.12, 2.45, 2.85, 3.35, 4.0, 4.85, 6.0, 7.5, 9.6],
          trafficChance: 0.22, // Natural moderate intervals
          speedRange: [0.55, 0.95],
        };
      case "hard":
        return {
          totalLanes: 22,
          mults: [1.18, 1.46, 1.83, 2.31, 2.95, 3.82, 5.0, 6.65, 9.0, 12.4, 17.5, 25.2, 37.0, 56.0, 88.0],
          trafficChance: 0.32, // Faster, tighter intervals
          speedRange: [0.8, 1.35],
        };
      case "hardcore":
        return {
          totalLanes: 18,
          mults: [1.42, 2.1, 3.2, 5.1, 8.4, 14.2, 25.0, 46.0, 88.0, 175.0, 360.0, 780.0, 1800.0, 4500.0, 12000.0],
          trafficChance: 0.45, // High speed, aggressive traffic
          speedRange: [1.2, 2.1],
        };
    }
  }, [difficulty]);

  // Traffic simulation with realistic gaps and intervals
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const vehicleIdRef = useRef<number>(1);

  useEffect(() => {
    const carTypes: Vehicle["type"][] = [
      "sports_red",
      "taxi_yellow",
      "van_blue",
      "coupe_purple",
      "truck_cyan",
    ];

    // Spawn ticker: randomly launches cars with natural gaps
    const spawnTimer = setInterval(() => {
      // Chance of spawning a car across visible lanes
      if (Math.random() < config.trafficChance) {
        const lane = Math.floor(Math.random() * 5) + 1; // 5 visible lanes
        const direction = lane % 2 === 0 ? "right-to-left" : "left-to-right";
        const speed =
          config.speedRange[0] + Math.random() * (config.speedRange[1] - config.speedRange[0]);
        const carType = carTypes[Math.floor(Math.random() * carTypes.length)];

        setVehicles((prev) => [
          ...prev.slice(-15), // keep memory clean
          {
            id: vehicleIdRef.current++,
            lane,
            type: carType,
            x: direction === "left-to-right" ? -18 : 118,
            speed,
            direction,
          },
        ]);
      }
    }, 450);

    // Movement ticker (60fps)
    const moveTimer = setInterval(() => {
      setVehicles((prev) =>
        prev
          .map((v) => ({
            ...v,
            x: v.direction === "left-to-right" ? v.x + v.speed : v.x - v.speed,
          }))
          .filter((v) => v.x > -25 && v.x < 125)
      );
    }, 25);

    return () => {
      clearInterval(spawnTimer);
      clearInterval(moveTimer);
    };
  }, [config]);

  // Start round
  const startGame = async () => {
    if (loading) return;
    setLoading(true);
    setCrashVehicle(false);
    try {
      const { data, error } = await supabase.rpc("chicken_start", {
        p_amount: betAmount,
        p_difficulty: difficulty,
      });

      if (!error && data?.game_id) {
        setGameId(data.game_id);
        setCurrentStep(0);
        setStatus("playing");
        setInGame(true);
        playSound("click");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Step across the road
  const stepForward = async () => {
    if (!inGame || loading || !gameId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("chicken_step", { p_game_id: gameId });

      if (!error && data) {
        if (data.status === "crashed" || data.status === "hit") {
          setCrashVehicle(true);
          setStatus("crashed");
          setInGame(false);
          playSound("explode");
        } else {
          setCurrentStep((prev) => prev + 1);
          playSound("click");
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
    if (!inGame || loading || !gameId || currentStep === 0) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("chicken_cashout", { p_game_id: gameId });
      if (!error) {
        const mult = config.mults[currentStep - 1] || 1.0;
        const winAmount = betAmount * mult;
        if (onWin) onWin(winAmount);
        setStatus("won");
        setInGame(false);
        playSound("cashout");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const currentMultiplier = currentStep > 0 ? config.mults[currentStep - 1] || 1.0 : 1.0;
  const nextMultiplier = config.mults[currentStep] || config.mults[config.mults.length - 1];

  // Render White Chicken Road 2 Chicken Vector SVG
  const renderChicken = (isHit: boolean) => (
    <div
      className={`relative w-14 h-14 transition-all duration-200 select-none ${
        isHit ? "rotate-90 scale-90 translate-y-2 opacity-90" : "hover:scale-105"
      }`}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
        {/* Yellow feet */}
        <path d="M 38 82 L 32 94 M 38 82 L 38 94 M 38 82 L 44 94" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
        <path d="M 62 82 L 56 94 M 62 82 L 62 94 M 62 82 L 68 94" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />

        {/* Plump White Body */}
        <ellipse cx="50" cy="58" rx="28" ry="25" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2.5" />

        {/* Cute White Tail feathers */}
        <path d="M 23 54 C 14 48 12 62 24 64 Z" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
        <path d="M 22 48 C 12 40 10 54 23 56 Z" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />

        {/* Wing with feather curve */}
        <path d="M 40 54 C 36 68 54 72 58 60 C 58 52 46 50 40 54 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />

        {/* Round White Head */}
        <circle cx="62" cy="38" r="17" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2.5" />

        {/* Bright Red 3-lobe Comb on head */}
        <path
          d="M 54 24 C 54 18 60 18 61 24 C 62 16 69 16 70 24 C 71 18 76 18 75 25"
          fill="#ef4444"
          stroke="#b91c1c"
          strokeWidth="1.5"
        />

        {/* Red Wattle below beak */}
        <ellipse cx="73" cy="46" rx="4" ry="6" fill="#ef4444" />

        {/* Sharp Yellow Beak */}
        <polygon points="74,36 88,40 74,44" fill="#f59e0b" stroke="#d97706" strokeWidth="1.5" />

        {/* Big Cartoon Eyes */}
        <circle cx="66" cy="34" r="5" fill="#1e293b" />
        <circle cx="67.5" cy="32.5" r="2" fill="#ffffff" />

        {isHit && (
          <text x="44" y="32" fontSize="18" fill="#ef4444" fontWeight="bold">
            💥
          </text>
        )}
      </svg>
    </div>
  );

  // Render Vehicles
  const renderCar = (v: Vehicle) => {
    const isFlipped = v.direction === "right-to-left";
    let bodyColor = "#ef4444";
    let topColor = "#dc2626";

    if (v.type === "taxi_yellow") {
      bodyColor = "#eab308";
      topColor = "#ca8a04";
    } else if (v.type === "van_blue") {
      bodyColor = "#3b82f6";
      topColor = "#2563eb";
    } else if (v.type === "coupe_purple") {
      bodyColor = "#a855f7";
      topColor = "#9333ea";
    } else if (v.type === "truck_cyan") {
      bodyColor = "#06b6d4";
      topColor = "#0891b2";
    }

    return (
      <div
        key={v.id}
        className="absolute top-1/2 -translate-y-1/2 pointer-events-none transition-transform"
        style={{
          left: `${v.x}%`,
          transform: `translateY(-50%) ${isFlipped ? "scaleX(-1)" : "scaleX(1)"}`,
        }}
      >
        <div className="relative w-16 h-7 rounded-md shadow-md" style={{ backgroundColor: bodyColor }}>
          {/* Windows / Cabin */}
          <div
            className="absolute top-1 left-3 right-4 h-3.5 rounded-sm"
            style={{ backgroundColor: topColor }}
          >
            <div className="h-full w-full bg-slate-900/60 rounded-sm border border-slate-700/50" />
          </div>
          {/* Headlights */}
          <div className="absolute top-1.5 right-0.5 h-1.5 w-1 bg-amber-200 rounded-full shadow-[0_0_8px_#fef08a]" />
          <div className="absolute bottom-1.5 right-0.5 h-1.5 w-1 bg-amber-200 rounded-full shadow-[0_0_8px_#fef08a]" />
          {/* Wheels */}
          <div className="absolute -bottom-1 left-2 w-3.5 h-2 bg-slate-950 rounded-full border border-slate-800" />
          <div className="absolute -bottom-1 right-2 w-3.5 h-2 bg-slate-950 rounded-full border border-slate-800" />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Stage title="Chicken Road 2.0" subtitle="Guide the white chicken across the busy highway">
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

        {/* Real Chicken Road Highway Viewport */}
        <div className="relative h-80 w-full overflow-hidden rounded-2xl border-2 border-slate-800 bg-slate-950 shadow-2xl flex flex-col justify-between">
          {/* Top Road Shoulder / Finish Line Grass */}
          <div className="relative h-11 w-full bg-gradient-to-b from-emerald-950 to-emerald-900/60 border-b border-emerald-700/50 flex items-center justify-between px-4 z-10">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span>🏁</span> SAFE FINISH ZONE
            </span>
            <div className="font-mono text-xs font-bold text-emerald-300">
              STEP: {currentStep} / {config.totalLanes}
            </div>
          </div>

          {/* 5 Visible Traffic Lanes */}
          <div className="relative flex-1 flex flex-col justify-evenly bg-[#131922]">
            {[5, 4, 3, 2, 1].map((laneIndex) => {
              const laneVehicles = vehicles.filter((v) => v.lane === laneIndex);
              const laneMult = config.mults[laneIndex - 1] || 1.1;

              return (
                <div
                  key={laneIndex}
                  className="relative flex-1 border-b border-dashed border-slate-700/40 flex items-center justify-between px-3"
                >
                  {/* Lane Multiplier Signboard */}
                  <div className="z-10 rounded bg-slate-900/80 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-400 border border-amber-500/20 shadow">
                    {laneMult.toFixed(2)}x
                  </div>

                  {/* Render vehicles running on this specific lane */}
                  {laneVehicles.map((v) => renderCar(v))}

                  {/* Chicken Position if stepping on this lane */}
                  {inGame && currentStep === laneIndex && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-20 animate-bounce">
                      {renderChicken(false)}
                    </div>
                  )}

                  {/* Hit vehicle splash on crash */}
                  {status === "crashed" && currentStep === laneIndex && crashVehicle && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-30">
                      {renderChicken(true)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Starting Sidewalk / Road Shoulder */}
          <div className="relative h-14 w-full bg-gradient-to-t from-slate-950 via-slate-900 to-slate-800/90 border-t-2 border-slate-700/70 flex items-center justify-between px-4 z-10">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">START LINE</span>
              {(!inGame || currentStep === 0) && (
                <div className="z-20 transition-all">{renderChicken(status === "crashed" && currentStep === 0)}</div>
              )}
            </div>

            {/* Current Multiplier Badge */}
            <div className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-1 text-right">
              <div className="text-[9px] uppercase font-bold text-slate-400">Current Win</div>
              <div className="font-mono text-sm font-black text-emerald-400">
                {fmt(betAmount * currentMultiplier)} ({currentMultiplier.toFixed(2)}x)
              </div>
            </div>
          </div>

          {/* Crash or Victory Screen Overlay */}
          {status === "crashed" && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-40 animate-fade-in">
              <div className="text-4xl mb-1">💥🚗</div>
              <div className="font-mono text-3xl font-black text-rose-500">HIT BY CAR!</div>
              <p className="text-xs text-slate-300 mt-1">The chicken could not cross in time.</p>
              <button
                onClick={() => setStatus("idle")}
                className="mt-4 rounded-xl bg-slate-800 px-6 py-2 text-xs font-bold text-white hover:bg-slate-700 border border-slate-700"
              >
                TRY AGAIN
              </button>
            </div>
          )}

          {status === "won" && (
            <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-40 animate-fade-in">
              <div className="text-4xl mb-1">🎉🏆</div>
              <div className="font-mono text-3xl font-black text-emerald-400">
                WON {fmt(betAmount * currentMultiplier)}!
              </div>
              <p className="text-xs text-emerald-200 mt-1">Cashed out safely across the road.</p>
              <button
                onClick={() => setStatus("idle")}
                className="mt-4 rounded-xl bg-emerald-600 px-6 py-2 text-xs font-bold text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/30"
              >
                PLAY NEXT ROUND
              </button>
            </div>
          )}
        </div>

        {/* Controls Console */}
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
              <span className="text-slate-400 font-semibold">Next Step Multiplier:</span>
              <span className="font-mono font-bold text-amber-400">{nextMultiplier.toFixed(2)}x</span>
            </div>

            {inGame ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={stepForward}
                  disabled={loading}
                  className="rounded-lg bg-amber-500 py-3 font-bold text-slate-950 shadow-lg shadow-amber-500/30 hover:bg-amber-400 active:scale-95 transition-all text-sm uppercase"
                >
                  GO / STEP 🐾
                </button>
                <button
                  onClick={cashout}
                  disabled={loading || currentStep === 0}
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
