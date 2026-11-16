import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useApp, errMsg } from "@/lib/app-context";
import { beep, fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { useAfterPlay } from "@/components/sz/shell";
import { ActionButton, BetAmount, HistoryStrip, Panel, ResultPopup, Stage, type Outcome } from "./kit";
import type { GameRow } from "./types";

type Res = any; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Shared server call for one-shot games; shows the win/loss popup after the animation. */
function usePlay(game: GameRow) {
  const after = useAfterPlay(game.slug);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const play = async (stake: number, params: Record<string, unknown>, delay: number, detail?: (r: Res) => React.ReactNode, sound?: (r: Res) => void): Promise<Res | null> => {
    setBusy(true);
    beep("bet");
    const { data, error } = await supabase.rpc("play_instant", { _game: game.slug, _stake: stake, _params: params as never });
    if (error) { setBusy(false); toast.error(errMsg(error)); return null; }
    const r = data as Res;
    setTimeout(() => {
      setBusy(false); after(r.balance);
      sound?.(r);
      setTimeout(() => setOutcome({ win: r.payout > 0, amount: r.payout, stake, multiplier: r.payout > 0 ? r.payout / stake : null, round: r.round, detail: detail?.(r) }), sound ? 900 : 150);
    }, delay);
    return r;
  };
  const popup = <ResultPopup outcome={outcome} onClose={() => setOutcome(null)} />;
  return { play, busy, popup };
}

/* ---------------- Dice ---------------- */
export function DiceGame({ game }: { game: GameRow }) {
  const { t } = useApp();
  const { play, busy, popup } = usePlay(game);
  const [stake, setStake] = useState(game.min_stake);
  const [target, setTarget] = useState(50);
  const [res, setRes] = useState<Res | null>(null);
  const [past, setPast] = useState<number[]>([]);
  const mult = Math.round((99 / target) * 100) / 100;
  return (
    <div className="space-y-3">
      <HistoryStrip items={past} render={(v) => v.toFixed(2)} />
      <Stage className="bg-gradient-night p-5">
        <div className={cn("text-center font-display text-6xl font-black tabular-nums transition", !res ? "text-night-foreground/60" : res.payout > 0 ? "text-game-green" : "text-game-red")}>{res ? Number(res.roll).toFixed(2) : "50.00"}</div>
        <div className="relative mx-2 mt-8 h-4 rounded-full bg-game-red shadow-inner">
          <div className="absolute inset-y-0 left-0 rounded-full bg-game-green" style={{ width: `${target}%` }} />
          <div className="absolute -top-1.5 h-7 w-7 -translate-x-1/2 rounded-lg border-2 border-card bg-primary shadow-glow" style={{ left: `${target}%` }} />
          {res && <div className="absolute -top-9 -translate-x-1/2 rounded-md bg-card px-1.5 py-0.5 text-xs font-bold text-foreground transition-all duration-700" style={{ left: `${res.roll}%` }}>{Number(res.roll).toFixed(1)}</div>}
        </div>
        <input type="range" min={2} max={95} value={target} disabled={busy} onChange={(e) => setTarget(Number(e.target.value))} className="mt-4 w-full accent-[var(--primary)]" aria-label={t("game.target")} />
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[["Roll under", target], ["Multiplier", `${mult}×`], ["Win chance", `${target}%`]].map(([l, v]) => <div key={String(l)} className="rounded-xl bg-casino-panel py-2"><div className="text-[10px] text-casino-muted">{l}</div><div className="font-display font-bold">{v}</div></div>)}
        </div>
      </Stage>
      <Panel className="space-y-3">
        <BetAmount value={stake} onChange={setStake} min={game.min_stake} max={game.max_stake} disabled={busy} />
        <ActionButton loading={busy} sub={`Win ${fmt(Math.floor(stake * mult))}`} onClick={async () => {
          const r = await play(stake, { target }, 700, (x) => <span>Roll {Number(x.roll).toFixed(2)} · target &lt; {target}</span>);
          if (r) { beep("flip"); setRes(r); setPast((p) => [Number(r.roll), ...p].slice(0, 15)); }
        }}>{t("game.roll")}</ActionButton>
      </Panel>
      {popup}
    </div>
  );
}

/* ---------------- Limbo ---------------- */
export function LimboGame({ game }: { game: GameRow }) {
  const { t } = useApp();
  const { play, busy, popup } = usePlay(game);
  const [stake, setStake] = useState(game.min_stake);
  const [target, setTarget] = useState("2.00");
  const [res, setRes] = useState<Res | null>(null);
  const [shown, setShown] = useState(1);
  const [past, setPast] = useState<number[]>([]);
  const tg = Math.max(1.01, Number(target) || 1.01);
  const go = async () => {
    setRes(null);
    const r = await play(stake, { target: tg }, 900, (x) => <span>Result {Number(x.result).toFixed(2)}× · target {tg.toFixed(2)}×</span>);
    if (!r) return;
    const end = Number(r.result); const t0 = Date.now();
    const tick = () => { const p = Math.min(1, (Date.now() - t0) / 850); setShown(1 + (end - 1) * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); else { setRes(r); setPast((x) => [end, ...x].slice(0, 15)); } };
    tick();
  };
  return (
    <div className="space-y-3">
      <HistoryStrip items={past} />
      <Stage className="bg-gradient-night py-14 text-center">
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 50% 60%, var(--primary), transparent 60%)" }} />
        <div className={cn("relative font-display text-7xl font-black tabular-nums", res ? (res.payout > 0 ? "text-game-green" : "text-game-red") : "text-night-foreground")}>{shown.toFixed(2)}×</div>
        <div className="relative mt-3 text-sm text-casino-muted">Target {tg.toFixed(2)}× · Win chance {(99 / tg).toFixed(2)}%</div>
      </Stage>
      <Panel className="space-y-3">
        <label className="block text-[11px] text-casino-muted">{t("game.target")} (1.01× – 1000×)
          <div className="mt-1 flex gap-1.5">
            <input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" disabled={busy} className="h-10 min-w-0 flex-1 rounded-lg border border-casino-line bg-casino px-3 font-display font-bold text-night-foreground outline-none" />
            {[1.5, 2, 5, 10].map((v) => <button key={v} onClick={() => setTarget(v.toFixed(2))} className="rounded-lg bg-casino-line px-2.5 text-xs font-bold">{v}×</button>)}
          </div>
        </label>
        <BetAmount value={stake} onChange={setStake} min={game.min_stake} max={game.max_stake} disabled={busy} />
        <ActionButton loading={busy} onClick={go} sub={`Win ${fmt(Math.floor(stake * tg))}`}>{t("game.bet")}</ActionButton>
      </Panel>
      {popup}
    </div>
  );
}

/* ---------------- Plinko ---------------- */
const MULTS = [22, 8, 3, 1.4, 0.7, 0.4, 0.2, 0.4, 0.7, 1.4, 3, 8, 22];
export function PlinkoGame({ game }: { game: GameRow }) {
  const { t } = useApp();
  const { play, busy, popup } = usePlay(game);
  const [stake, setStake] = useState(game.min_stake);
  const [ball, setBall] = useState<{ x: number; y: number } | null>(null);
  const [hit, setHit] = useState<number | null>(null);
  const rows = 12;
  const drop = async () => {
    setHit(null);
    const r = await play(stake, {}, rows * 130 + 150, (x) => <span>Slot {MULTS[x.slot]}×</span>);
    if (!r) return;
    const path: number[] = r.path; let pos = 0;
    setBall({ x: 50, y: 0 });
    path.forEach((d, i) => setTimeout(() => { pos += d; beep("tick"); setBall({ x: 50 + (pos - (i + 1) / 2) * (80 / rows), y: ((i + 1) / (rows + 1)) * 100 }); }, (i + 1) * 130));
    setTimeout(() => { setHit(r.slot); setBall(null); }, rows * 130 + 150);
  };
  return (
    <div className="space-y-3">
      <Stage className="bg-gradient-night p-3">
        <div className="relative aspect-[10/9]">
          {Array.from({ length: rows }, (_, r) => Array.from({ length: r + 3 }, (_, c) => (
            <span key={`${r}-${c}`} className="absolute h-2 w-2 -translate-x-1/2 rounded-full bg-night-foreground/80 shadow-[0_0_6px_var(--primary)]" style={{ top: `${((r + 0.5) / (rows + 1)) * 100}%`, left: `${50 + (c - (r + 2) / 2) * (80 / rows)}%` }} />
          )))}
          {ball && <span className="absolute h-4 w-4 -translate-x-1/2 rounded-full bg-gradient-to-b from-gold to-orange shadow-glow transition-all duration-[130ms] ease-in" style={{ left: `${ball.x}%`, top: `${ball.y}%` }} />}
        </div>
        <div className="mt-1 grid gap-0.5" style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}>
          {MULTS.map((m, i) => <span key={i} className={cn("rounded-md py-1.5 text-center text-[9px] font-black transition", m >= 4 ? "bg-game-red text-primary-foreground" : m >= 1 ? "bg-orange text-primary-foreground" : "bg-gold text-night", hit === i && "-translate-y-1 scale-110 ring-2 ring-card")}>{m}</span>)}
        </div>
      </Stage>
      <Panel className="space-y-3">
        <BetAmount value={stake} onChange={setStake} min={game.min_stake} max={game.max_stake} disabled={busy} />
        <ActionButton loading={busy} onClick={drop}>{t("game.drop")}</ActionButton>
      </Panel>
      {popup}
    </div>
  );
}

/* ---------------- Dragon Tiger ---------------- */
const RANK = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUIT = ["♠", "♥", "♦", "♣"];
export function DragonTigerGame({ game }: { game: GameRow }) {
  const { t } = useApp();
  const { play, busy, popup } = usePlay(game);
  const [stake, setStake] = useState(game.min_stake);
  const [pick, setPick] = useState<"dragon" | "tiger" | "tie">("dragon");
  const [res, setRes] = useState<Res | null>(null);
  const [flip, setFlip] = useState(0);
  const [road, setRoad] = useState<string[]>([]);
  const go = async () => {
    setFlip(0); setRes(null);
    const r = await play(stake, { pick }, 1400, (x) => <span className="capitalize">{x.winner} wins</span>, (x) => beep(x.win ? "win" : "lose"));
    if (!r) return;
    setRes(r);
    setTimeout(() => { beep("flip"); setFlip(1); }, 300);
    setTimeout(() => { beep("flip"); setFlip(2); }, 900);
    setTimeout(() => setRoad((x) => [r.winner, ...x].slice(0, 30)), 1400);
  };
  const Side = ({ side, v, s, shown }: { side: "dragon" | "tiger"; v?: number; s?: number; shown: boolean }) => {
    const won = res && flip === 2 && res.winner === side;
    const red = s === 1 || s === 2;
    return (
      <div className="flex flex-1 flex-col items-center gap-2">
        <div className={cn("rounded-full px-4 py-1 font-display text-xs font-black uppercase tracking-[0.3em]", side === "dragon" ? "bg-game-red/15 text-game-red" : "bg-primary/15 text-primary")}>{side}</div>
        <div className="[perspective:800px]">
          <div className={cn("relative h-36 w-[6.2rem] rounded-lg transition-transform duration-500 [transform-style:preserve-3d]", shown && v && "[transform:rotateY(180deg)]", won && "ring-2 ring-gold ring-offset-2 ring-offset-night")}>
            <div className={cn("absolute inset-0 rounded-lg border border-gold/50 p-1.5 shadow-card [backface-visibility:hidden]", side === "dragon" ? "bg-game-red" : "bg-primary-deep")}>
              <div className="h-full w-full rounded-md border border-gold/40" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent 0 6px, rgba(255,255,255,.08) 6px 7px), repeating-linear-gradient(-45deg, transparent 0 6px, rgba(255,255,255,.08) 6px 7px)" }} />
            </div>
            <div className={cn("absolute inset-0 rounded-lg border border-border bg-card p-1.5 shadow-card [backface-visibility:hidden] [transform:rotateY(180deg)]", red ? "text-game-red" : "text-foreground")}>
              {v ? (<>
                <div className="absolute left-1.5 top-1 text-center font-display text-sm font-bold leading-none">{RANK[v]}<div className="text-xs">{SUIT[s ?? 0]}</div></div>
                <div className="grid h-full place-items-center text-5xl">{SUIT[s ?? 0]}</div>
                <div className="absolute bottom-1 right-1.5 rotate-180 text-center font-display text-sm font-bold leading-none">{RANK[v]}<div className="text-xs">{SUIT[s ?? 0]}</div></div>
              </>) : null}
            </div>
          </div>
        </div>
      </div>
    );
  };
  const opts = [["dragon", "1.95×", "bg-game-red"], ["tie", "9×", "bg-game-green"], ["tiger", "1.95×", "bg-primary"]] as const;
  return (
    <div className="space-y-3">
      <Stage className="bg-gradient-night p-4">
        <div className="flex items-center justify-around">
          <Side side="dragon" v={res?.dragon} s={res?.dragon_suit} shown={flip >= 1} />
          <span className="font-display text-3xl font-black text-gold">VS</span>
          <Side side="tiger" v={res?.tiger} s={res?.tiger_suit} shown={flip >= 2} />
        </div>
        {!!road.length && (
          <div className="mt-4 rounded-xl bg-card p-2">
            <div className="grid grid-flow-col grid-rows-3 justify-start gap-1">
              {road.map((w, i) => <span key={i} className={cn("grid h-5 w-5 place-items-center rounded-full text-[9px] font-black text-primary-foreground", w === "dragon" ? "bg-game-red" : w === "tiger" ? "bg-primary" : "bg-game-green")}>{w[0]!.toUpperCase()}</span>)}
            </div>
          </div>
        )}
      </Stage>
      <Panel className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {opts.map(([p, m, bg]) => (
            <button key={p} disabled={busy} onClick={() => { beep("chip"); setPick(p); }} className={cn("rounded-xl border-2 py-4 font-display text-sm font-black uppercase text-primary-foreground transition", bg, pick === p ? "scale-[1.03] border-gold shadow-glow" : "border-transparent opacity-70")}>{p}<div className="text-[11px] font-semibold opacity-90">{m}</div></button>
          ))}
        </div>
        <BetAmount value={stake} onChange={setStake} min={game.min_stake} max={game.max_stake} disabled={busy} />
        <ActionButton loading={busy} onClick={go}>{t("game.bet")} · <span className="capitalize">{pick}</span></ActionButton>
      </Panel>
      {popup}
    </div>
  );
}
