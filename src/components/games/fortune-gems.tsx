import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useApp } from "@/lib/app-context";
import { beep, fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { useAfterPlay } from "@/components/sz/shell";
import { ActionButton, BetAmount, Panel, ResultPopup, type Outcome } from "./kit";
import type { GameRow } from "./types";

/* Symbols: 0 Wild, 1 Red gem, 2 Green gem, 3 Blue gem, 4 A, 5 K, 6 Q, 7 J */
const PAYS = [25, 15, 10, 5, 2.5, 1.5, 1, 0.5];
const MULTS = [1, 2, 3, 5, 10, 15];
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 4, 8], [6, 4, 2]];
const rnd = (n: number) => Math.floor(Math.random() * n);

function Gem({ c1, c2, shape }: { c1: string; c2: string; shape: "oct" | "hex" | "round" }) {
  const id = `g${c1.replace("#", "")}`;
  return (
    <svg viewBox="0 0 60 60" className="h-[78%] w-[78%] drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]">
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c1} /><stop offset="1" stopColor={c2} /></linearGradient></defs>
      {shape === "oct" && <><polygon points="18,4 42,4 56,18 56,42 42,56 18,56 4,42 4,18" fill={`url(#${id})`} stroke="#fff8" strokeWidth="1.5" /><polygon points="22,14 38,14 46,22 46,38 38,46 22,46 14,38 14,22" fill="#ffffff22" /><polygon points="22,14 38,14 30,24" fill="#ffffff55" /></>}
      {shape === "hex" && <><polygon points="30,3 55,17 55,43 30,57 5,43 5,17" fill={`url(#${id})`} stroke="#fff8" strokeWidth="1.5" /><polygon points="30,13 45,22 45,38 30,47 15,38 15,22" fill="#ffffff22" /><polygon points="30,13 45,22 30,28 15,22" fill="#ffffff55" /></>}
      {shape === "round" && <><polygon points="30,4 50,14 56,32 44,52 16,52 4,32 10,14" fill={`url(#${id})`} stroke="#fff8" strokeWidth="1.5" /><polygon points="10,14 50,14 30,30" fill="#ffffff44" /><polygon points="4,32 30,30 16,52" fill="#00000022" /></>}
    </svg>
  );
}

function Sym({ s }: { s: number }) {
  if (s === 0) return (
    <div className="grid h-[82%] w-[82%] place-items-center rounded-xl border-2 border-gold bg-[radial-gradient(circle,hsl(45_100%_60%),hsl(30_90%_35%))] shadow-[0_0_18px_hsl(45_100%_55%/0.7)]">
      <span className="font-display text-[11px] font-black tracking-wider text-night drop-shadow">WILD</span>
    </div>
  );
  if (s === 1) return <Gem c1="#ff5a7a" c2="#a3001e" shape="oct" />;
  if (s === 2) return <Gem c1="#5cf2a0" c2="#06783e" shape="hex" />;
  if (s === 3) return <Gem c1="#6cc7ff" c2="#0b4fa8" shape="round" />;
  const L = ["A", "K", "Q", "J"][s - 4]!;
  const tone = ["from-gold to-orange", "from-[hsl(280_80%_70%)] to-[hsl(280_70%_40%)]", "from-[hsl(190_90%_65%)] to-[hsl(210_80%_40%)]", "from-[hsl(140_70%_60%)] to-[hsl(150_70%_30%)]"][s - 4];
  return <span className={cn("bg-gradient-to-b bg-clip-text font-display text-4xl font-black text-transparent drop-shadow-[0_3px_2px_rgba(0,0,0,0.6)]", tone)}>{L}</span>;
}

type Res = { grid: number[]; multiplier: number; wins: { line: number; symbol: number; pay: number }[]; payout: number; round_code: string; balance: number };

export function FortuneGemsGame({ game }: { game: GameRow }) {
  const { profile } = useApp();
  const after = useAfterPlay(game.slug);
  const [stake, setStake] = useState(game.min_stake);
  const [grid, setGrid] = useState<number[]>([1, 2, 3, 4, 0, 5, 6, 7, 1]);
  const [mult, setMult] = useState(1);
  const [spinning, setSpinning] = useState<boolean[]>([false, false, false, false]);
  const [wins, setWins] = useState<Res["wins"]>([]);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [auto, setAuto] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [showPay, setShowPay] = useState(false);
  const autoRef = useRef(0);
  autoRef.current = auto;
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (tick.current) clearInterval(tick.current); }, []);

  const spin = async () => {
    if (busy) return;
    if ((profile?.balance ?? 0) < stake) { toast.error("Insufficient balance"); setAuto(0); return; }
    setBusy(true); setWins([]); setLastWin(null);
    beep("bet");
    setSpinning([true, true, true, true]);
    tick.current = setInterval(() => {
      setGrid((g) => g.map(() => rnd(8)));
      setMult(MULTS[rnd(6)]!);
      beep("tick");
    }, 70);
    const { data, error } = await supabase.rpc("fortune_gems_spin", { _stake: stake });
    if (error) {
      if (tick.current) clearInterval(tick.current);
      setSpinning([false, false, false, false]); setBusy(false); setAuto(0);
      toast.error(errMsg(error)); return;
    }
    const r = data as unknown as Res;
    const step = turbo ? 180 : 450;
    const stopReel = (reel: number) => {
      setSpinning((s) => s.map((v, i) => (i === reel ? false : v)));
      beep("chip");
    };
    for (let reel = 0; reel < 4; reel++) {
      setTimeout(() => {
        if (reel < 3) stopReel(reel);
        else {
          if (tick.current) clearInterval(tick.current);
          setGrid(r.grid); setMult(r.multiplier); stopReel(3);
          setWins(r.wins); after(r.balance);
          const won = r.payout > 0;
          if (won) { setLastWin(r.payout); beep(r.payout / stake >= 10 ? "bigwin" : "win"); }
          const big = won && r.payout / stake >= 5;
          setTimeout(() => {
            setBusy(false);
            if (big || (!autoRef.current && won)) setOutcome({ win: true, amount: r.payout, stake, multiplier: r.payout / stake, round: r.round_code, title: r.payout / stake >= 10 ? "MEGA WIN" : "BIG WIN" });
            else if (!won && !autoRef.current) setOutcome({ win: false, amount: 0, stake, round: r.round_code });
            if (autoRef.current > 0) {
              setAuto((a) => a - 1);
              if (autoRef.current - 1 > 0) setTimeout(() => document.getElementById("fg-spin")?.click(), big ? 3200 : turbo ? 300 : 700);
            }
          }, won ? 700 : 250);
        }
      }, step * (reel + 1));
    }
    // keep the reels visually spinning per-column until each stops
    setGrid((g) => g);
  };

  const onLine = (i: number) => wins.some((w) => LINES[w.line]!.includes(i));

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-3xl border-2 border-gold/60 bg-[radial-gradient(ellipse_at_top,hsl(265_60%_28%),hsl(250_60%_10%))] p-3 shadow-[0_10px_40px_hsl(260_80%_10%/0.6)]">
        <div className="mb-2 text-center">
          <div className="bg-gradient-to-b from-[hsl(48_100%_75%)] to-[hsl(35_95%_45%)] bg-clip-text font-display text-2xl font-black tracking-wide text-transparent drop-shadow">FORTUNE GEMS</div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold/70">5 lines · up to ×15</div>
        </div>
        <div className="flex gap-2">
          <div className="relative grid flex-[3] grid-cols-3 gap-1.5 rounded-2xl border border-gold/40 bg-night/60 p-1.5">
            {grid.map((s, i) => {
              const reel = i % 3;
              const hit = !busy && onLine(i);
              return (
                <div key={i} className={cn("relative grid aspect-square place-items-center overflow-hidden rounded-xl bg-gradient-to-b from-[hsl(255_40%_22%)] to-[hsl(255_45%_12%)] transition", hit && "animate-pulse ring-2 ring-gold shadow-[0_0_20px_hsl(45_100%_55%/0.8)]", !busy && wins.length > 0 && !hit && "opacity-40")}>
                  <div className={cn("grid h-full w-full place-items-center", spinning[reel] && "blur-[2px] translate-y-1")}><Sym s={s} /></div>
                </div>
              );
            })}
            {!busy && wins.length > 0 && (
              <svg viewBox="0 0 300 300" className="pointer-events-none absolute inset-1.5 h-[calc(100%-12px)] w-[calc(100%-12px)]">
                {wins.map((w) => { const l = LINES[w.line]!; const pt = (k: number) => `${(k % 3) * 100 + 50},${Math.floor(k / 3) * 100 + 50}`; return <polyline key={w.line} points={l.map(pt).join(" ")} fill="none" stroke="hsl(45 100% 60%)" strokeWidth="6" strokeLinecap="round" opacity="0.9" />; })}
              </svg>
            )}
          </div>
          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-gold/60 bg-[linear-gradient(180deg,hsl(35_90%_30%),hsl(25_90%_15%))] p-1.5">
            <div className="text-[9px] font-bold uppercase tracking-widest text-gold/80">Multi</div>
            <div className={cn("my-1 grid w-full flex-1 place-items-center rounded-xl bg-night/60", spinning[3] && "blur-[2px]")}>
              <span className={cn("font-display font-black text-gold drop-shadow-[0_0_10px_hsl(45_100%_55%)]", mult >= 10 ? "text-3xl" : "text-4xl")}>×{mult}</span>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-night/60 px-3 py-2 text-night-foreground">
          <div><div className="text-[10px] uppercase text-gold/70">Balance</div><div className="font-display font-bold tabular-nums">{fmt(profile?.balance ?? 0)}</div></div>
          <div className="text-center"><div className="text-[10px] uppercase text-gold/70">Win</div><div className={cn("font-display text-xl font-black tabular-nums", lastWin ? "text-gold" : "text-night-foreground/50")}>{fmt(lastWin ?? 0)}</div></div>
          <div className="text-right"><div className="text-[10px] uppercase text-gold/70">Bet</div><div className="font-display font-bold tabular-nums">{fmt(stake)}</div></div>
        </div>
      </div>

      <Panel className="space-y-3">
        <BetAmount value={stake} onChange={setStake} min={game.min_stake} max={game.max_stake} disabled={busy || auto > 0} />
        <div className="grid grid-cols-3 gap-2 text-xs font-bold">
          <button type="button" onClick={() => setTurbo(!turbo)} className={cn("rounded-lg py-2", turbo ? "bg-gold text-night" : "bg-casino-line")}>⚡ Turbo</button>
          <select value={auto} disabled={busy && auto === 0} onChange={(e) => { const n = Number(e.target.value); setAuto(n); if (n > 0 && !busy) setTimeout(() => document.getElementById("fg-spin")?.click(), 50); }} className="rounded-lg bg-casino-line py-2 text-center text-night-foreground">
            <option value={0}>Auto: off</option>{[10, 25, 50, 100].map((n) => <option key={n} value={n}>Auto ×{n}</option>)}
          </select>
          <button type="button" onClick={() => setShowPay(!showPay)} className="rounded-lg bg-casino-line py-2">Paytable</button>
        </div>
        {auto > 0 ? (
          <ActionButton tone="stop" onClick={() => setAuto(0)} sub={`${auto} spins left`}>Stop auto</ActionButton>
        ) : (
          <button id="fg-spin" type="button" onClick={spin} disabled={busy} className="hidden" aria-hidden />
        )}
        {auto === 0 && <ActionButton loading={busy} onClick={spin} sub={`Bet ${fmt(stake)}`}>Spin</ActionButton>}
        {auto > 0 && <button id="fg-spin" type="button" onClick={spin} className="hidden" aria-hidden />}
        {showPay && (
          <div className="grid grid-cols-4 gap-2 rounded-xl bg-casino p-2 text-center text-[11px]">
            {PAYS.map((p, s) => <div key={s} className="rounded-lg bg-casino-panel p-1"><div className="mx-auto grid h-10 w-10 place-items-center"><Sym s={s} /></div><div className="font-bold text-gold">×{p}</div></div>)}
            <div className="col-span-4 text-casino-muted">Pays per line (stake ÷ 5) for 3 in a row. Wild substitutes all. Total win × multiplier reel.</div>
          </div>
        )}
      </Panel>
      <ResultPopup outcome={outcome} onClose={() => setOutcome(null)} />
    </div>
  );
}
