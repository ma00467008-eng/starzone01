import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useApp, errMsg } from "@/lib/app-context";
import { beep, fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { Card, PrimaryButton, StakeInput, useAfterPlay } from "@/components/sz/shell";
import type { GameRow } from "./types";

type Res = any; // eslint-disable-line @typescript-eslint/no-explicit-any
function usePlay(game: GameRow) {
  const { t } = useApp();
  const after = useAfterPlay(game.slug);
  const [busy, setBusy] = useState(false);
  const play = async (stake: number, params: Record<string, unknown>, delay = 0): Promise<Res | null> => {
    setBusy(true);
    const { data, error } = await supabase.rpc("play_instant", { _game: game.slug, _stake: stake, _params: params as never });
    if (error) { setBusy(false); toast.error(errMsg(error)); return null; }
    const r = data as Res;
    setTimeout(() => {
      setBusy(false); after(r.balance);
      if (r.payout > 0) { beep("win"); toast.success(`${t("game.win")} +${fmt(r.payout)}`); } else { beep("lose"); toast(t("game.lose")); }
    }, delay);
    return r;
  };
  return { play, busy };
}

/* ---------------- Dice ---------------- */
export function DiceGame({ game }: { game: GameRow }) {
  const { t } = useApp();
  const { play, busy } = usePlay(game);
  const [stake, setStake] = useState(game.min_stake);
  const [target, setTarget] = useState(50);
  const [res, setRes] = useState<Res | null>(null);
  const mult = Math.round((99 / target) * 10000) / 10000;
  return (
    <div className="space-y-4">
      <Card className="bg-gradient-night text-night-foreground">
        <div className="text-center font-display text-5xl font-extrabold tabular-nums">{res ? Number(res.roll).toFixed(2) : "--.--"}</div>
        <div className="relative mt-6 h-3 rounded-full bg-game-red/70">
          <div className="absolute inset-y-0 left-0 rounded-full bg-game-green" style={{ width: `${target}%` }} />
          {res && <div className="absolute -top-2 h-7 w-1.5 rounded bg-gold transition-all duration-500" style={{ left: `${res.roll}%` }} />}
        </div>
        <div className="mt-2 flex justify-between text-xs opacity-70"><span>0</span><span>Win if roll &lt; {target}</span><span>100</span></div>
      </Card>
      <Card className="space-y-3">
        <label className="block text-xs text-muted-foreground">{t("game.target")}: <b className="text-foreground">{target}</b> · Payout <b className="text-foreground">{mult}×</b> · Chance {target}%
          <input type="range" min={2} max={95} value={target} onChange={(e) => setTarget(Number(e.target.value))} className="mt-1 w-full accent-[var(--primary)]" />
        </label>
        <StakeInput value={stake} onChange={setStake} min={game.min_stake} max={game.max_stake} />
        <PrimaryButton loading={busy} onClick={async () => { const r = await play(stake, { target }); if (r) setRes(r); }}>{t("game.roll")}</PrimaryButton>
      </Card>
    </div>
  );
}

/* ---------------- Limbo ---------------- */
export function LimboGame({ game }: { game: GameRow }) {
  const { t } = useApp();
  const { play, busy } = usePlay(game);
  const [stake, setStake] = useState(game.min_stake);
  const [target, setTarget] = useState("2");
  const [res, setRes] = useState<Res | null>(null);
  const [shown, setShown] = useState(1);
  const go = async () => {
    const tg = Number(target);
    const r = await play(stake, { target: tg }, 700);
    if (!r) return;
    setRes(null);
    const end = Number(r.result); const t0 = Date.now();
    const tick = () => { const p = Math.min(1, (Date.now() - t0) / 700); setShown(1 + (end - 1) * p); if (p < 1) requestAnimationFrame(tick); else setRes(r); };
    tick();
  };
  return (
    <div className="space-y-4">
      <Card className="bg-gradient-night py-10 text-center">
        <div className={cn("font-display text-6xl font-extrabold tabular-nums", res ? (res.win ? "text-game-green" : "text-game-red") : "text-night-foreground")}>{shown.toFixed(2)}×</div>
        <div className="mt-2 text-sm text-night-foreground/70">Target {Number(target || 0).toFixed(2)}× · Chance {(99 / Math.max(1.01, Number(target) || 1.01)).toFixed(2)}%</div>
      </Card>
      <Card className="space-y-3">
        <label className="block text-xs text-muted-foreground">{t("game.target")} (1.01 – 1000)
          <input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none" />
        </label>
        <StakeInput value={stake} onChange={setStake} min={game.min_stake} max={game.max_stake} />
        <PrimaryButton loading={busy} onClick={go}>{t("game.bet")}</PrimaryButton>
      </Card>
    </div>
  );
}

/* ---------------- Plinko ---------------- */
const MULTS = [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33];
export function PlinkoGame({ game }: { game: GameRow }) {
  const { t } = useApp();
  const { play, busy } = usePlay(game);
  const [stake, setStake] = useState(game.min_stake);
  const [ball, setBall] = useState<{ x: number; y: number } | null>(null);
  const [hit, setHit] = useState<number | null>(null);
  const rows = 12;
  const drop = async () => {
    setHit(null);
    const r = await play(stake, {}, rows * 120 + 100);
    if (!r) return;
    const path: number[] = r.path; let pos = 0;
    setBall({ x: 50, y: 0 });
    path.forEach((d, i) => {
      setTimeout(() => { pos += d; setBall({ x: 50 + (pos - (i + 1) / 2) * (80 / rows), y: ((i + 1) / (rows + 1)) * 100 }); }, (i + 1) * 120);
    });
    setTimeout(() => { setHit(r.slot); setBall(null); }, rows * 120 + 100);
  };
  return (
    <div className="space-y-4">
      <div className="relative rounded-2xl bg-gradient-night p-3 shadow-card">
        <div className="relative aspect-square">
          {Array.from({ length: rows }, (_, r) => Array.from({ length: r + 3 }, (_, c) => (
            <span key={`${r}-${c}`} className="absolute h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-night-foreground/60" style={{ top: `${((r + 0.5) / (rows + 1)) * 100}%`, left: `${50 + (c - (r + 2) / 2) * (80 / rows)}%` }} />
          )))}
          {ball && <span className="absolute h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-gold shadow-glow transition-all duration-100" style={{ left: `${ball.x}%`, top: `${ball.y}%` }} />}
        </div>
        <div className="mt-1 grid grid-cols-13 gap-0.5" style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}>
          {MULTS.map((m, i) => <span key={i} className={cn("rounded py-1 text-center text-[9px] font-bold transition", m >= 4 ? "bg-game-red text-primary-foreground" : m >= 1 ? "bg-gold text-night" : "bg-primary/40 text-night-foreground", hit === i && "scale-125 ring-2 ring-night-foreground")}>{m}×</span>)}
        </div>
      </div>
      <Card className="space-y-3">
        <StakeInput value={stake} onChange={setStake} min={game.min_stake} max={game.max_stake} disabled={busy} />
        <PrimaryButton loading={busy} onClick={drop}>{t("game.drop")}</PrimaryButton>
      </Card>
    </div>
  );
}

/* ---------------- Dragon Tiger ---------------- */
const RANK = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUIT = ["♠", "♥", "♦", "♣"];
export function DragonTigerGame({ game }: { game: GameRow }) {
  const { t } = useApp();
  const { play, busy } = usePlay(game);
  const [stake, setStake] = useState(game.min_stake);
  const [pick, setPick] = useState<"dragon" | "tiger" | "tie">("dragon");
  const [res, setRes] = useState<Res | null>(null);
  const [flip, setFlip] = useState(false);
  const go = async () => {
    setFlip(false);
    const r = await play(stake, { pick }, 800);
    if (r) { setRes(r); setTimeout(() => setFlip(true), 100); }
  };
  const PlayingCard = ({ v, s, side }: { v?: number; s?: number; side: string }) => (
    <div className="text-center">
      <div className={cn("mb-2 font-display text-sm font-bold uppercase", res?.winner === side && flip ? "text-gold" : "text-night-foreground")}>{side}</div>
      <div className={cn("mx-auto grid h-32 w-22 w-24 place-items-center rounded-xl border-2 shadow-card transition-all duration-500", flip && v ? "border-gold bg-card" : "border-primary bg-gradient-primary")}>
        {flip && v ? <span className={cn("font-display text-3xl font-extrabold", s === 1 || s === 2 ? "text-game-red" : "text-foreground")}>{RANK[v]}{SUIT[s ?? 0]}</span> : <span className="text-3xl text-primary-foreground">★</span>}
      </div>
    </div>
  );
  return (
    <div className="space-y-4">
      <Card className="bg-gradient-night">
        <div className="flex items-center justify-around py-4">
          <PlayingCard v={res?.dragon} s={res?.dragon_suit} side="dragon" />
          <span className="font-display text-2xl font-extrabold text-gold">VS</span>
          <PlayingCard v={res?.tiger} s={res?.tiger_suit} side="tiger" />
        </div>
      </Card>
      <Card className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {([["dragon", "2×"], ["tie", "9×"], ["tiger", "2×"]] as const).map(([p, m]) => (
            <button key={p} onClick={() => setPick(p)} className={cn("rounded-xl py-3 text-sm font-bold capitalize", pick === p ? (p === "dragon" ? "bg-game-red text-primary-foreground" : p === "tiger" ? "bg-primary text-primary-foreground" : "bg-game-green text-primary-foreground") : "bg-secondary")}>{p}<div className="text-[10px] opacity-80">{m}</div></button>
          ))}
        </div>
        <StakeInput value={stake} onChange={setStake} min={game.min_stake} max={game.max_stake} />
        <PrimaryButton loading={busy} onClick={go}>{t("game.bet")}</PrimaryButton>
      </Card>
    </div>
  );
}
