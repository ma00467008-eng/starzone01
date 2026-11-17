import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Trophy, Gauge, Flag, Zap, Sparkles, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useApp } from "@/lib/app-context";
import { beep, fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { Card, PrimaryButton, StakeInput, useAfterPlay } from "@/components/sz/shell";
import { ResultPopup, type Outcome } from "./kit";
import type { GameRow } from "./types";

/* =========================================================================
   Realistic Superbike Data with Authentic Livery Colors & Driver Names
   ========================================================================= */

const BIKES = [
  { num: 1, name: "Red Bull Racing", rider: "A. Marquez", fairingColor: "#ef4444", secondaryColor: "#1e1e24", accentColor: "#facc15" },
  { num: 2, name: "Monster Yamaha", rider: "F. Quartararo", fairingColor: "#2563eb", secondaryColor: "#0f172a", accentColor: "#38bdf8" },
  { num: 3, name: "Kawasaki Ninja", rider: "J. Rea", fairingColor: "#16a34a", secondaryColor: "#052e16", accentColor: "#4ade80" },
  { num: 4, name: "Ducati Corse", rider: "F. Bagnaia", fairingColor: "#eab308", secondaryColor: "#451a03", accentColor: "#ffffff" },
  { num: 5, name: "Repsol Honda", rider: "M. Rossi", fairingColor: "#9333ea", secondaryColor: "#3b0764", accentColor: "#fb923c" },
  { num: 6, name: "KTM Factory", rider: "B. Binder", fairingColor: "#ea580c", secondaryColor: "#18181b", accentColor: "#ffffff" },
  { num: 7, name: "Pramac Speed", rider: "J. Martin", fairingColor: "#ec4899", secondaryColor: "#500724", accentColor: "#a855f7" },
  { num: 8, name: "Petronas SRT", rider: "M. Bezzecchi", fairingColor: "#06b6d4", secondaryColor: "#083344", accentColor: "#22d3ee" },
];

/* =========================================================================
   Realistic High-Detail Superbike Vector SVG
   ========================================================================= */

function RealisticSuperbike({
  bike,
  isLeader = false,
  speed = 100,
}: {
  bike: typeof BIKES[0];
  isLeader?: boolean;
  speed?: number | undefined;
}) {
  return (
    <div className={cn("relative flex items-center select-none transition-transform duration-75", isLeader && "filter drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]")}>
      <svg
        viewBox="0 0 160 80"
        className="h-11 w-24 sm:h-13 sm:w-28 drop-shadow-[0_6px_10px_rgba(0,0,0,0.8)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`fairing-${bike.num}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={bike.fairingColor} />
            <stop offset="60%" stopColor={bike.secondaryColor} />
            <stop offset="100%" stopColor={bike.fairingColor} />
          </linearGradient>
          <linearGradient id={`rimGleam-${bike.num}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="50%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
        </defs>

        {/* Rear Wheel (slick tire + chrome rim + brake disc) */}
        <g className="animate-spin" style={{ transformOrigin: "26px 54px", animationDuration: "0.25s" }}>
          <circle cx="26" cy="54" r="20" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
          <circle cx="26" cy="54" r="14" fill={`url(#rimGleam-${bike.num})`} />
          <circle cx="26" cy="54" r="10" fill="#0f172a" stroke={bike.accentColor} strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="26" y1="36" x2="26" y2="72" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="8" y1="54" x2="44" y2="54" stroke="#cbd5e1" strokeWidth="1.5" />
          <circle cx="26" cy="54" r="4" fill="#64748b" />
        </g>

        {/* Front Wheel (slick tire + inverted forks) */}
        <g className="animate-spin" style={{ transformOrigin: "134px 54px", animationDuration: "0.25s" }}>
          <circle cx="134" cy="54" r="20" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
          <circle cx="134" cy="54" r="14" fill={`url(#rimGleam-${bike.num})`} />
          <circle cx="134" cy="54" r="10" fill="#0f172a" stroke={bike.accentColor} strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="134" y1="36" x2="134" y2="72" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="116" y1="54" x2="152" y2="54" stroke="#cbd5e1" strokeWidth="1.5" />
          <circle cx="134" cy="54" r="4" fill="#64748b" />
        </g>

        {/* Front Inverted Telescopic Golden Forks */}
        <line x1="114" y1="26" x2="134" y2="54" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
        <line x1="117" y1="30" x2="134" y2="54" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />

        {/* Titanium Exhaust Pipe & Heat Color Tip */}
        <path d="M52 50 Q66 54 84 46 L96 46" stroke="#475569" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <path d="M28 50 L56 52" stroke="#64748b" strokeWidth="4" strokeLinecap="round" fill="none" />
        <ellipse cx="24" cy="49" rx="4" ry="2.5" fill="#f97316" className="animate-pulse" />

        {/* Aerodynamic Superbike Chassis & Fairing */}
        <path
          d="M32 40 L60 40 L72 30 L108 26 L124 34 L118 48 L98 52 L56 52 Z"
          fill={`url(#fairing-${bike.num})`}
          stroke="#0f172a"
          strokeWidth="1.2"
        />

        {/* Windshield Bubble Canopy */}
        <path d="M102 24 Q114 18 122 28 Z" fill="#38bdf8" fillOpacity="0.75" />

        {/* Aerodynamic Racing Livery Stripe & Bike Number */}
        <path d="M72 32 L106 28 L98 44 L64 42 Z" fill={bike.accentColor} fillOpacity="0.85" />
        <text x="82" y="38" fill="#ffffff" fontSize="9" fontWeight="900" fontStyle="italic" textAnchor="middle">
          {bike.num}
        </text>

        {/* Racing Rider Crouched in Aerodynamic Tuck */}
        {/* Leather racing suit body */}
        <path d="M48 34 C54 22, 70 20, 86 24 C90 28, 86 36, 76 38 Z" fill="#18181b" stroke="#27272a" strokeWidth="1" />
        {/* Aero hump on back */}
        <path d="M56 22 C64 19, 72 20, 76 25 Z" fill={bike.fairingColor} />
        {/* Arm reaching to clip-on handlebars */}
        <path d="M78 28 L98 28 L110 32" stroke="#27272a" strokeWidth="4" strokeLinecap="round" fill="none" />
        <circle cx="110" cy="32" r="2.5" fill={bike.accentColor} />
        {/* Racing Helmet with Tinted Visor */}
        <circle cx="94" cy="19" r="8" fill={bike.fairingColor} stroke="#0f172a" strokeWidth="1.2" />
        <path d="M92 17 Q100 17 101 22 Q94 22 92 19 Z" fill="#0f172a" stroke={bike.accentColor} strokeWidth="0.8" />

        {/* Front LED Projector Headlight */}
        <polygon points="124,34 128,36 124,38" fill="#e0f2fe" />
      </svg>

      {/* Floating Racer Badge */}
      <div className="absolute -top-3 left-6 flex items-center gap-1 rounded bg-black/80 px-1.5 py-0.5 border border-white/10 shadow text-[9px] font-mono text-white shrink-0 pointer-events-none">
        <span className="font-black" style={{ color: bike.fairingColor }}>#{bike.num}</span>
        <span className="text-zinc-300 truncate max-w-[55px] sm:max-w-[70px]">{bike.rider}</span>
      </div>
    </div>
  );
}

/* =========================================================================
   Main Component: Realistic Virtual Sports Moto Racing
   ========================================================================= */

export function MotoRacingGame({ game }: { game: GameRow }) {
  const { session } = useApp();
  const afterPlay = useAfterPlay(game.slug);

  const [stake, setStake] = useState<number>(game.min_stake || 10);
  const [betCategory, setBetCategory] = useState<"winner" | "podium" | "size" | "parity" | "quinella">("winner");
  const [selectedVal, setSelectedVal] = useState<string>("1");
  const [quinellaSecond, setQuinellaSecond] = useState<string>("2");

  const [racing, setRacing] = useState(false);
  const [lightsCount, setLightsCount] = useState<number | null>(null); // 1 to 5 starting gantry
  const [bikeProgress, setBikeProgress] = useState<number[]>(new Array(8).fill(0));
  const [liveSpeeds, setLiveSpeeds] = useState<number[]>(new Array(8).fill(0));
  const [standings, setStandings] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8]);
  const [winner, setWinner] = useState<number | null>(null);
  const [podium, setPodium] = useState<number[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [raceSector, setRaceSector] = useState<string>("GRID");
  const [commentary, setCommentary] = useState<string>("ENGINES IDLING ON STARTING GRID");
  const [nextRaceCountdown, setNextRaceCountdown] = useState<number | null>(null);

  const animRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
  }, []);

  const getOdds = () => {
    switch (betCategory) {
      case "winner": return 7.68;
      case "podium": return 2.45;
      case "size":
      case "parity": return 1.96;
      case "quinella": return 24.50;
    }
  };

  const handleStartRace = async () => {
    if (!session?.user) {
      toast.error("Please login to place bets on Moto Racing");
      return;
    }
    if (racing || lightsCount !== null) return;
    if (stake < game.min_stake || stake > game.max_stake) {
      toast.error(`Stake must be between ${game.min_stake} and ${game.max_stake}`);
      return;
    }

    setOutcome(null);
    setWinner(null);
    setPodium([]);
    setBikeProgress(new Array(8).fill(0));
    setLiveSpeeds(new Array(8).fill(0));

    // Call Supabase RPC
    let resultData: any = null;
    try {
      const { data, error } = await (supabase.rpc as any)("moto_racing_bet", {
        _stake: stake,
        _category: betCategory,
        _selection: betCategory === "quinella" ? `${selectedVal}-${quinellaSecond}` : selectedVal,
      });

      if (error) {
        console.warn("moto_racing_bet RPC error, using client fallback simulator:", error.message);
        const winBike = Math.floor(Math.random() * 8) + 1;
        const otherBikes = BIKES.map(b => b.num).filter(n => n !== winBike).sort(() => Math.random() - 0.5);
        const finishOrder = [winBike, ...otherBikes];
        
        let won = false;
        if (betCategory === "winner") won = winBike === Number(selectedVal);
        else if (betCategory === "podium") won = finishOrder.slice(0, 3).includes(Number(selectedVal));
        else if (betCategory === "size") won = selectedVal === "big" ? winBike >= 5 : winBike <= 4;
        else if (betCategory === "parity") won = selectedVal === "odd" ? winBike % 2 !== 0 : winBike % 2 === 0;
        else if (betCategory === "quinella") {
          const p1 = Number(selectedVal);
          const p2 = Number(quinellaSecond);
          won = (finishOrder[0] === p1 && finishOrder[1] === p2) || (finishOrder[0] === p2 && finishOrder[1] === p1);
        }

        const odds = getOdds();
        resultData = {
          win: won,
          winner: winBike,
          finish_order: finishOrder,
          payout: won ? Math.floor(stake * odds) : 0,
        };
      } else {
        resultData = data;
      }
    } catch (err: any) {
      toast.error(errMsg(err));
      return;
    }

    // F1 Style 5 Starting Gantry Lights
    for (let i = 1; i <= 5; i++) {
      setLightsCount(i);
      beep("tick");
      await new Promise((r) => setTimeout(r, 450));
    }
    // Lights OUT and away we go!
    setLightsCount(0);
    beep("bet");
    await new Promise((r) => setTimeout(r, 350));
    setLightsCount(null);
    setRacing(true);

    const finalWinner = Number(resultData.winner) || 1;
    const finishOrder: number[] = resultData.finish_order || [
      finalWinner,
      ...BIKES.map((b) => b.num).filter((n) => n !== finalWinner),
    ];

    const speeds = BIKES.map((b) => {
      if (b.num === finalWinner) return 1.0;
      const rank = finishOrder.indexOf(b.num);
      return 0.95 - (Math.max(0, rank) * 0.016) - Math.random() * 0.015;
    });

    const startTime = performance.now();
    const duration = 11200; // 11.2 seconds complete Grand Prix race

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      
      // Update Race Sector & Live TV Commentary
      if (t < 0.25) {
        setRaceSector("SECTOR 1 · TURN 1 & 2 CHICANE");
        setCommentary(`LIGHTS OUT! Bike #${finishOrder[0]} leads the pack into Turn 1!`);
      } else if (t < 0.55) {
        setRaceSector("SECTOR 2 · HIGH SPEED BACK STRAIGHTAWAY");
        setCommentary(`SLIPSTREAM BATTLE! Speeds exceeding 330 km/h with overtakes!`);
      } else if (t < 0.82) {
        setRaceSector("SECTOR 3 · HAIRPIN APEX BRAKING ZONE");
        setCommentary(`DRAMA AT THE APEX! Knee sliders scraping the ripple curbs!`);
      } else {
        setRaceSector("FINAL SECTOR · SPRINT TO THE CHECKERED FLAG");
        setCommentary(`FULL THROTTLE DRAG RACE! Bike #${finalWinner} charging to victory!`);
      }

      const current = speeds.map((speed, idx) => {
        // dynamic overtaking jitter during the race
        const jitter = Math.sin(t * 22 + idx * 1.8) * 0.05 * (1 - t * 0.95);
        return Math.min(100, Math.max(0, (t * speed + jitter) * 100));
      });

      const currentSpeeds = current.map((p, idx) => {
        const base = t < 0.25 ? 240 : t < 0.55 ? 335 : t < 0.82 ? 210 : 310;
        const variation = Math.sin(t * 12 + idx) * 25;
        return Math.floor(base + variation);
      });

      const sorted = BIKES
        .map((b) => ({ num: b.num, progress: current[b.num - 1] ?? 0 }))
        .sort((a, b) => b.progress - a.progress)
        .map((x) => x.num);

      setBikeProgress(current);
      setLiveSpeeds(currentSpeeds);
      setStandings(sorted);

      if (t < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        setRacing(false);
        setRaceSector("CHECKERED FLAG 🏁");
        setCommentary(`CHECKERED FLAG! Bike #${finalWinner} takes Grand Prix victory!`);
        setWinner(finalWinner);
        setPodium(finishOrder.slice(0, 3));
        const won = Boolean(resultData.win);
        const payout = Number(resultData.payout) || 0;

        if (won) {
          beep("bigwin");
          toast.success(`VICTORY! Bike #${finalWinner} Won! Payout: ₹${fmt(payout)}`);
        } else {
          beep("lose");
          toast.error(`Race Finished! Bike #${finalWinner} Won!`);
        }

        setOutcome({
          win: won,
          amount: payout,
          stake,
          multiplier: won ? getOdds() : 0,
          title: won ? "RACE WON!" : "RACE FINISHED",
          detail: `Winner: #${finalWinner} (${BIKES[finalWinner - 1]?.name}) · Your Pick: ${betCategory.toUpperCase()} [${selectedVal}]`,
        });

        afterPlay(resultData?.balance);

        // 10-Second Countdown to Next Race
        setNextRaceCountdown(10);
        const countdownTimer = setInterval(() => {
          setNextRaceCountdown((prev: number | null) => {
            if (prev === null || prev <= 1) {
              clearInterval(countdownTimer);
              setWinner(null);
              setCommentary("BETTING OPEN FOR NEXT GRAND PRIX");
              setRaceSector("GRID");
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      }
    };

    animRef.current = requestAnimationFrame(step);
  };

  return (
    <div className="space-y-4 font-sans select-none">
      {/* =========================================================================
          Realistic 3D Racetrack Arena & Broadcast Overlay
          ========================================================================= */}
      <Card className="relative overflow-hidden border-border/40 bg-gradient-to-b from-slate-950 via-zinc-950 to-neutral-950 p-0 shadow-2xl rounded-2xl">
        {/* Top TV Broadcast Leaderboard Ribbon */}
        <div className="flex items-center justify-between border-b border-white/10 bg-black/80 px-3.5 py-2 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-black uppercase text-white animate-pulse">
              <Zap className="h-3 w-3 fill-white" /> LIVE
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Grand Prix Circuit
            </span>
          </div>

          {/* Standings positions */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {standings.map((num, rankIdx) => {
              const b = BIKES[num - 1];
              if (!b) return null;
              return (
                <div
                  key={num}
                  style={{ backgroundColor: b.fairingColor }}
                  className={cn(
                    "flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-md text-[10px] sm:text-xs font-black text-white shadow transition-all",
                    rankIdx === 0 && "ring-2 ring-amber-400 scale-105"
                  )}
                  title={`P${rankIdx + 1}: #${b.num} ${b.rider}`}
                >
                  {num}
                </div>
              );
            })}
          </div>
        </div>

        {/* Live TV Broadcast Commentary Ticker */}
        <div className="bg-gradient-to-r from-red-950/80 via-black to-zinc-950 px-3.5 py-1.5 border-b border-white/10 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-[10px] font-black uppercase tracking-widest text-red-400 shrink-0">
              RADIO:
            </span>
            <span className="font-mono text-zinc-200 truncate">
              {commentary}
            </span>
          </div>
          {nextRaceCountdown !== null && (
            <div className="flex items-center gap-1.5 shrink-0 bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/40 font-mono text-[11px] font-black">
              <span>NEXT RACE IN:</span>
              <span>{nextRaceCountdown}s</span>
            </div>
          )}
        </div>

        {/* The 8-Lane Asphalt Racetrack */}
        <div className="relative p-2 sm:p-4 bg-gradient-to-b from-zinc-950 via-neutral-900 to-zinc-950">
          <div className="relative h-80 sm:h-96 w-full overflow-hidden rounded-xl border border-white/10 bg-[#141517] shadow-inner">
            {/* Asphalt Texture & Track Markings */}
            <div className="absolute inset-0 opacity-25 pointer-events-none" style={{
              backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 38px, rgba(255,255,255,0.06) 40px), repeating-linear-gradient(90deg, transparent, transparent 70px, rgba(255,255,255,0.03) 72px)"
            }} />

            {/* Red & White Ripple Kerbs (Top and Bottom track barriers) */}
            <div className="absolute inset-x-0 top-0 h-2 bg-[repeating-linear-gradient(90deg,#ef4444,#ef4444_14px,#ffffff_14px,#ffffff_28px)] opacity-90 shadow-sm" />
            <div className="absolute inset-x-0 bottom-0 h-2 bg-[repeating-linear-gradient(90deg,#ef4444,#ef4444_14px,#ffffff_14px,#ffffff_28px)] opacity-90 shadow-sm" />

            {/* Checkered Finish Line (Dual Row) */}
            <div className="absolute right-6 top-0 bottom-0 w-6 bg-[repeating-linear-gradient(0deg,#000,#000_10px,#fff_10px,#fff_20px)] border-l-2 border-r-2 border-white/40 shadow-xl opacity-90 z-10 flex flex-col justify-between items-center py-1">
              <span className="text-[8px] font-black tracking-widest text-black bg-white/90 px-0.5 rounded rotate-90">FINISH</span>
              <Flag className="h-3 w-3 text-white fill-white" />
              <span className="text-[8px] font-black tracking-widest text-black bg-white/90 px-0.5 rounded rotate-90">FINISH</span>
            </div>

            {/* 8 Track Lanes */}
            {BIKES.map((b, idx) => {
              const laneTop = 5 + idx * 11.5;
              const progress = bikeProgress[b.num - 1] ?? 0;
              const isLead = standings[0] === b.num;
              return (
                <div
                  key={b.num}
                  className="absolute inset-x-0 h-10 border-b border-white/5 flex items-center px-2"
                  style={{ top: `${laneTop}%` }}
                >
                  {/* Lane Number Badge */}
                  <div className="w-5 text-[10px] font-mono font-bold text-zinc-500 shrink-0">
                    L{b.num}
                  </div>

                  {/* Superbike traversing the track */}
                  <div
                    className="relative transition-all duration-75 ease-linear will-change-transform"
                    style={{
                      transform: `translateX(${Math.min(84, (progress / 100) * 82)}%)`,
                    }}
                  >
                    <RealisticSuperbike bike={b} isLeader={isLead && racing} speed={liveSpeeds[b.num - 1]} />
                  </div>
                </div>
              );
            })}

            {/* F1 5-Light Starting Gantry Overlay */}
            {lightsCount !== null && (
              <div className="absolute inset-0 z-30 grid place-items-center bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="flex flex-col items-center gap-3">
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-300">
                    {lightsCount === 0 ? "LIGHTS OUT · GO!" : "STARTING PROCEDURE"}
                  </span>
                  {/* 5 Gantry Beacons */}
                  <div className="flex items-center gap-3 rounded-2xl bg-zinc-950 p-3.5 border-2 border-zinc-700 shadow-2xl">
                    {[1, 2, 3, 4, 5].map((lightNum) => {
                      const isLit = lightsCount >= lightNum;
                      return (
                        <div
                          key={lightNum}
                          className={cn(
                            "h-7 w-7 rounded-full border-2 transition-all duration-150",
                            isLit
                              ? "bg-red-600 border-red-400 shadow-[0_0_18px_rgba(239,68,68,1)] animate-pulse"
                              : "bg-zinc-800 border-zinc-700 opacity-40"
                          )}
                        />
                      );
                    })}
                  </div>
                  {lightsCount === 0 && (
                    <div className="font-black text-3xl text-emerald-400 animate-bounce">
                      FULL THROTTLE! 🏁
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Winner Trophy Overlay Banner */}
            {winner !== null && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/65 backdrop-blur-sm animate-fade-in">
                <div className="rounded-2xl border-2 border-amber-400 bg-gradient-to-b from-zinc-900 to-black p-5 text-center shadow-2xl">
                  <Trophy className="mx-auto h-12 w-12 text-amber-400 animate-bounce" />
                  <div className="text-xs font-black uppercase tracking-widest text-amber-300 mt-1">
                    GRAND PRIX WINNER
                  </div>
                  <div className="font-display text-2xl sm:text-3xl font-black text-white mt-1">
                    BIKE #{winner} · {BIKES[winner - 1]?.name}
                  </div>
                  <div className="text-sm font-semibold text-zinc-300 mt-0.5">
                    Rider: {BIKES[winner - 1]?.rider}
                  </div>
                  {/* Podium top 3 */}
                  <div className="mt-3 flex items-center justify-center gap-2 pt-2 border-t border-white/10 text-xs">
                    <span className="text-amber-400 font-bold">🥇 1st: #{podium[0]}</span>
                    <span className="text-slate-300 font-bold">🥈 2nd: #{podium[1]}</span>
                    <span className="text-amber-600 font-bold">🥉 3rd: #{podium[2]}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* =========================================================================
          Virtual Sports Betting Slip & Market Selector
          ========================================================================= */}
      <Card className="space-y-4 p-4 border-border/40 bg-card shadow-lg">
        {/* Betting Markets Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1 rounded-xl bg-secondary/40 border border-border/40">
          {[
            { id: "winner", label: "Winner (1st)", odds: "7.68×" },
            { id: "podium", label: "Podium (Top 3)", odds: "2.45×" },
            { id: "size", label: "Big / Small", odds: "1.96×" },
            { id: "parity", label: "Odd / Even", odds: "1.96×" },
            { id: "quinella", label: "Quinella (1st & 2nd)", odds: "24.50×" },
          ].map((market) => (
            <button
              key={market.id}
              onClick={() => {
                setBetCategory(market.id as any);
                if (market.id === "winner" || market.id === "podium") setSelectedVal("1");
                else if (market.id === "size") setSelectedVal("big");
                else if (market.id === "parity") setSelectedVal("odd");
                else if (market.id === "quinella") { setSelectedVal("1"); setQuinellaSecond("2"); }
              }}
              className={cn(
                "flex flex-col items-center justify-center rounded-lg py-2 px-1 text-center transition-all",
                betCategory === market.id
                  ? "bg-primary text-primary-foreground font-bold shadow"
                  : "hover:bg-secondary text-muted-foreground font-medium"
              )}
            >
              <span className="text-[11px] leading-tight">{market.label}</span>
              <span className="text-[10px] font-mono opacity-80">{market.odds}</span>
            </button>
          ))}
        </div>

        {/* Market Options Grid */}
        {betCategory === "winner" || betCategory === "podium" ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {BIKES.map((b) => (
              <button
                key={b.num}
                onClick={() => setSelectedVal(String(b.num))}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all",
                  selectedVal === String(b.num)
                    ? "border-primary bg-primary/10 ring-2 ring-primary shadow-md"
                    : "border-border/60 bg-secondary/30 hover:bg-secondary/60"
                )}
              >
                <div
                  style={{ backgroundColor: b.fairingColor }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-black text-white shadow"
                >
                  #{b.num}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold">{b.name}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{b.rider}</div>
                </div>
                <div className="text-right font-mono text-xs font-bold text-primary">
                  {betCategory === "winner" ? "7.68×" : "2.45×"}
                </div>
              </button>
            ))}
          </div>
        ) : betCategory === "size" ? (
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: "small", title: "SMALL (Bikes 1 - 4)", desc: "Numbers 1, 2, 3, 4" },
              { id: "big", title: "BIG (Bikes 5 - 8)", desc: "Numbers 5, 6, 7, 8" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedVal(item.id)}
                className={cn(
                  "rounded-xl border p-4 text-center transition-all",
                  selectedVal === item.id
                    ? "border-primary bg-primary/10 ring-2 ring-primary shadow-md font-bold text-primary"
                    : "border-border/60 bg-secondary/30 hover:bg-secondary/60 text-foreground"
                )}
              >
                <div className="text-base font-black">{item.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
                <div className="font-mono text-xs font-bold text-primary mt-1">1.96× Payout</div>
              </button>
            ))}
          </div>
        ) : betCategory === "parity" ? (
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: "odd", title: "ODD (1, 3, 5, 7)", desc: "Odd Numbered Superbike" },
              { id: "even", title: "EVEN (2, 4, 6, 8)", desc: "Even Numbered Superbike" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedVal(item.id)}
                className={cn(
                  "rounded-xl border p-4 text-center transition-all",
                  selectedVal === item.id
                    ? "border-primary bg-primary/10 ring-2 ring-primary shadow-md font-bold text-primary"
                    : "border-border/60 bg-secondary/30 hover:bg-secondary/60 text-foreground"
                )}
              >
                <div className="text-base font-black">{item.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
                <div className="font-mono text-xs font-bold text-primary mt-1">1.96× Payout</div>
              </button>
            ))}
          </div>
        ) : (
          /* Quinella / Dual Forecast */
          <div className="space-y-2 rounded-xl bg-secondary/20 p-3 border border-border/40">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Pick 2 Bikes to Finish 1st & 2nd (Any Order) · 24.50× Odds
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-muted-foreground font-semibold">1st Pick</label>
                <select
                  value={selectedVal}
                  onChange={(e) => setSelectedVal(e.target.value)}
                  className="w-full mt-1 rounded-lg border border-border bg-background p-2 text-xs font-bold"
                >
                  {BIKES.map((b) => (
                    <option key={b.num} value={String(b.num)} disabled={String(b.num) === quinellaSecond}>
                      Bike #{b.num} - {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground font-semibold">2nd Pick</label>
                <select
                  value={quinellaSecond}
                  onChange={(e) => setQuinellaSecond(e.target.value)}
                  className="w-full mt-1 rounded-lg border border-border bg-background p-2 text-xs font-bold"
                >
                  {BIKES.map((b) => (
                    <option key={b.num} value={String(b.num)} disabled={String(b.num) === selectedVal}>
                      Bike #{b.num} - {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Stake Controller */}
        <div className="space-y-2">
          <StakeInput
            value={stake}
            onChange={setStake}
            min={game.min_stake}
            max={game.max_stake}
            disabled={racing || lightsCount !== null}
          />

          {/* Quick Chip Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {[10, 50, 100, 500, 1000, 5000].map((amt) => (
              <button
                key={amt}
                onClick={() => setStake(amt)}
                disabled={racing || lightsCount !== null}
                className="rounded-lg bg-secondary/60 px-2.5 py-1 text-xs font-mono font-bold text-muted-foreground hover:bg-secondary hover:text-foreground transition disabled:opacity-50 shrink-0"
              >
                +{amt}
              </button>
            ))}
            <button
              onClick={() => setStake((s) => Math.floor(s * 2))}
              disabled={racing || lightsCount !== null}
              className="rounded-lg bg-secondary/80 px-2.5 py-1 text-xs font-mono font-bold text-foreground hover:bg-secondary transition disabled:opacity-50 shrink-0"
            >
              2X
            </button>
            <button
              onClick={() => setStake((s) => Math.max(game.min_stake, Math.floor(s / 2)))}
              disabled={racing || lightsCount !== null}
              className="rounded-lg bg-secondary/80 px-2.5 py-1 text-xs font-mono font-bold text-foreground hover:bg-secondary transition disabled:opacity-50 shrink-0"
            >
              1/2
            </button>
          </div>
        </div>

        {/* Potential Return Summary */}
        <div className="flex items-center justify-between rounded-xl bg-secondary/40 px-3.5 py-2.5 text-xs border border-border/40">
          <span className="text-muted-foreground font-medium">Potential Win Return:</span>
          <span className="font-mono text-base font-black text-amber-500">
            ₹{fmt(Math.floor(stake * getOdds()))}
          </span>
        </div>

        {/* Start Race CTA Button */}
        <PrimaryButton
          onClick={handleStartRace}
          disabled={racing || lightsCount !== null}
          className="w-full h-13 text-base font-black bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-black shadow-xl uppercase tracking-wider"
        >
          {racing ? "MOTO GP IN PROGRESS..." : lightsCount !== null ? "STARTING LIGHTS..." : "CONFIRM BET & START RACE"}
        </PrimaryButton>
      </Card>

      {outcome && <ResultPopup outcome={outcome} onClose={() => setOutcome(null)} />}
    </div>
  );
}
