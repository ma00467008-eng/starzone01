import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bomb, Gem, Plane } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp, errMsg } from "@/lib/app-context";
import { beep, fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { Card, PrimaryButton, StakeInput, useAfterPlay } from "@/components/sz/shell";
import type { GameRow } from "./types";

/* ---------------- Sky Crash ---------------- */
export function CrashGame({ game }: { game: GameRow }) {
  const { t } = useApp();
  const after = useAfterPlay(game.slug);
  const [stake, setStake] = useState(game.min_stake);
  const [auto, setAuto] = useState("");
  const [sid, setSid] = useState<string | null>(null);
  const [mult, setMult] = useState(1);
  const [state, setState] = useState<"idle" | "flying" | "crashed" | "cashed">("idle");
  const [busy, setBusy] = useState(false);
  const [past, setPast] = useState<number[]>([]);
  const start = useRef(0);
  const sidRef = useRef<string | null>(null);

  useEffect(() => {
    if (state !== "flying") return;
    const anim = setInterval(() => setMult(Math.floor(Math.exp(0.1 * (Date.now() - start.current) / 1000) * 100) / 100), 50);
    const poll = setInterval(() => check(false), 400);
    return () => { clearInterval(anim); clearInterval(poll); };
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const settle = (r: any) => {
    sidRef.current = null; setSid(null);
    after(r.balance as number);
    if (r.crashed && !(Number(r.payout) > 0)) {
      setState("crashed"); setMult(Number(r.crash ?? r.multiplier ?? mult)); beep("lose");
      setPast((p) => [Number(r.crash ?? r.multiplier), ...p].slice(0, 12));
    } else {
      setState("cashed"); setMult(Number(r.multiplier ?? r.cashout ?? mult)); beep("win");
      toast.success(`${t("game.win")} +${fmt(Number(r.payout))}`);
      if (r.crash) setPast((p) => [Number(r.crash), ...p].slice(0, 12));
    }
  };

  const check = async (cashout: boolean) => {
    const id = sidRef.current; if (!id) return;
    const { data, error } = await supabase.rpc("crash_check", { _session: id, _cashout: cashout });
    if (error) { if (cashout) toast.error(errMsg(error)); return; }
    const r = data as any;
    if (r.crashed !== false || r.payout !== undefined) settle(r);
  };

  const launch = async () => {
    setBusy(true);
    const a = auto ? Number(auto) : null;
    const { data, error } = await supabase.rpc("crash_start", { _stake: stake, _auto: a as number });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    const r = data as { session: string; balance: number };
    after(r.balance); beep("click");
    sidRef.current = r.session; setSid(r.session);
    start.current = Date.now(); setMult(1); setState("flying");
  };

  const pct = Math.min(1, Math.log(mult) / Math.log(10));
  return (
    <div className="space-y-4">
      {!!past.length && <div className="no-scrollbar flex gap-1.5 overflow-x-auto">{past.map((p, i) => <span key={i} className={cn("rounded-full px-2.5 py-1 text-xs font-bold", p >= 2 ? "bg-success/15 text-success" : "bg-secondary text-primary-deep")}>{p.toFixed(2)}×</span>)}</div>}
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-gradient-night shadow-card">
        <svg viewBox="0 0 100 60" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
          {state !== "idle" && <path d={`M0 60 Q ${pct * 60} ${60 - pct * 5} ${10 + pct * 80} ${55 - pct * 45}`} stroke="var(--primary)" strokeWidth="1" fill="none" />}
        </svg>
        {state !== "idle" && <Plane className={cn("absolute h-8 w-8 text-gold transition-all duration-100", state === "crashed" && "opacity-0")} style={{ left: `${8 + pct * 80}%`, bottom: `${5 + pct * 70}%`, transform: "rotate(-20deg)" }} />}
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className={cn("font-display text-5xl font-extrabold tabular-nums", state === "crashed" ? "text-game-red" : state === "cashed" ? "text-game-green" : "text-night-foreground")}>{mult.toFixed(2)}×</div>
            {state === "crashed" && <div className="mt-1 font-bold text-game-red">{t("game.flew_away")}</div>}
            {state === "idle" && <div className="mt-1 text-sm text-night-foreground/70">Place a bet to take off</div>}
          </div>
        </div>
      </div>
      <Card className="space-y-3">
        <StakeInput value={stake} onChange={setStake} min={game.min_stake} max={game.max_stake} disabled={state === "flying"} />
        <label className="block text-xs text-muted-foreground">{t("game.auto_cashout")}
          <input value={auto} onChange={(e) => setAuto(e.target.value)} disabled={state === "flying"} placeholder="e.g. 2.00" inputMode="decimal" className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none" />
        </label>
        {state === "flying" ? (
          <PrimaryButton variant="gold" onClick={() => check(true)}>{t("game.cashout")} {fmt(Math.floor(stake * mult))}</PrimaryButton>
        ) : (
          <PrimaryButton onClick={launch} loading={busy} disabled={!!sid}>{t("game.bet")} {fmt(stake)}</PrimaryButton>
        )}
      </Card>
    </div>
  );
}

/* ---------------- Mines ---------------- */
export function MinesGame({ game }: { game: GameRow }) {
  const { t } = useApp();
  const after = useAfterPlay(game.slug);
  const [stake, setStake] = useState(game.min_stake);
  const [count, setCount] = useState(3);
  const [sid, setSid] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [mines, setMines] = useState<number[]>([]);
  const [mult, setMult] = useState(1);
  const [next, setNext] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const active = !!sid;

  const start = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("mines_start", { _stake: stake, _mines: count });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    const r = data as { session: string; balance: number };
    after(r.balance); beep("click");
    setSid(r.session); setRevealed([]); setMines([]); setMult(1); setNext(null);
  };
  const reveal = async (i: number) => {
    if (!sid || revealed.includes(i) || busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("mines_reveal", { _session: sid, _tile: i });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    const r = data as { mine?: boolean; mines?: number[]; multiplier?: number; next?: number; revealed?: number[]; balance?: number; payout?: number };
    if (r.mine) { setMines(r.mines ?? []); setRevealed((v) => [...v, i]); setSid(null); after(r.balance); beep("lose"); toast.error("Boom! You hit a mine"); return; }
    if (r.payout !== undefined) { setMines(r.mines ?? []); setRevealed((v) => [...v, i]); setSid(null); after(r.balance); beep("win"); toast.success(`${t("game.win")} +${fmt(r.payout)}`); return; }
    beep("tick"); setRevealed(r.revealed ?? []); setMult(r.multiplier ?? 1); setNext(r.next ?? null);
  };
  const cashout = async () => {
    if (!sid) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("mines_cashout", { _session: sid });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    const r = data as { payout: number; mines: number[]; balance: number };
    setMines(r.mines); setSid(null); after(r.balance); beep("win"); toast.success(`${t("game.win")} +${fmt(r.payout)}`);
  };

  return (
    <div className="space-y-4">
      <Card className="flex justify-between text-sm">
        <span>Multiplier <b className="font-display text-primary-deep">{mult.toFixed(2)}×</b></span>
        {next && <span className="text-muted-foreground">Next {next.toFixed(2)}×</span>}
      </Card>
      <div className="grid grid-cols-5 gap-2 rounded-2xl bg-gradient-night p-3 shadow-card">
        {Array.from({ length: 25 }, (_, i) => {
          const isMine = mines.includes(i); const open = revealed.includes(i) || (mines.length > 0);
          return (
            <button key={i} onClick={() => reveal(i)} disabled={!active} className={cn("grid aspect-square place-items-center rounded-xl transition-all duration-300", !open ? "bg-primary/30 hover:bg-primary/50 active:scale-90" : isMine ? "bg-game-red" : revealed.includes(i) ? "bg-game-green" : "bg-night-foreground/10")}>
              {open && (isMine ? <Bomb className="h-6 w-6 text-primary-foreground" /> : <Gem className={cn("h-6 w-6", revealed.includes(i) ? "text-primary-foreground" : "text-night-foreground/40")} />)}
            </button>
          );
        })}
      </div>
      <Card className="space-y-3">
        <StakeInput value={stake} onChange={setStake} min={game.min_stake} max={game.max_stake} disabled={active} />
        <label className="block text-xs text-muted-foreground">{t("game.mines")}: <b className="text-foreground">{count}</b>
          <input type="range" min={1} max={24} value={count} disabled={active} onChange={(e) => setCount(Number(e.target.value))} className="mt-1 w-full accent-[var(--primary)]" />
        </label>
        {active ? <PrimaryButton variant="gold" onClick={cashout} loading={busy} disabled={!revealed.length}>{t("game.cashout")} {fmt(Math.floor(stake * mult))}</PrimaryButton>
          : <PrimaryButton onClick={start} loading={busy}>{t("game.start")}</PrimaryButton>}
      </Card>
    </div>
  );
}

/* ---------------- Chicken Road ---------------- */
const P: Record<string, number> = { easy: 0.04, medium: 0.12, hard: 0.2, hardcore: 0.3 };
export function ChickenGame({ game }: { game: GameRow }) {
  const { t } = useApp();
  const after = useAfterPlay(game.slug);
  const [stake, setStake] = useState(game.min_stake);
  const [diff, setDiff] = useState("easy");
  const [sid, setSid] = useState<string | null>(null);
  const [lane, setLane] = useState(0);
  const [hazard, setHazard] = useState<number | null>(null);
  const [mult, setMult] = useState(1);
  const [busy, setBusy] = useState(false);
  const laneMult = (l: number) => Math.round((0.97 / Math.pow(1 - (P[diff] ?? 0.04), l)) * 100) / 100;

  const start = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("chicken_start", { _stake: stake, _difficulty: diff });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    const r = data as { session: string; balance: number };
    after(r.balance); beep("click"); setSid(r.session); setLane(0); setHazard(null); setMult(1);
  };
  const step = async () => {
    if (!sid) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("chicken_step", { _session: sid });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    const r = data as { hit?: boolean; lane?: number; multiplier?: number; balance?: number; payout?: number; hazard?: number };
    if (r.hit) { setLane(r.lane!); setHazard(r.lane!); setSid(null); after(r.balance); beep("lose"); toast.error("Oh no! The chicken got caught"); return; }
    if (r.payout !== undefined) { setLane(20); setSid(null); after(r.balance); beep("win"); toast.success(`${t("game.win")} +${fmt(r.payout)}`); return; }
    beep("tick"); setLane(r.lane!); setMult(r.multiplier!);
  };
  const cashout = async () => {
    if (!sid) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("chicken_cashout", { _session: sid });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    const r = data as { payout: number; balance: number; hazard: number };
    setHazard(r.hazard); setSid(null); after(r.balance); beep("win"); toast.success(`${t("game.win")} +${fmt(r.payout)}`);
  };

  return (
    <div className="space-y-4">
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto rounded-2xl bg-gradient-night p-3 shadow-card">
        <div className="grid h-24 w-14 shrink-0 place-items-center rounded-xl bg-night-foreground/10 text-3xl">{lane === 0 ? "🐔" : "🏁"}</div>
        {Array.from({ length: 20 }, (_, i) => {
          const l = i + 1;
          return (
            <div key={l} className={cn("flex h-24 w-16 shrink-0 flex-col items-center justify-between rounded-xl border border-dashed border-night-foreground/20 py-2 text-xs font-bold", l <= lane && hazard !== l && "bg-game-green/30", hazard === l && "bg-game-red/60")}>
              <span className="text-night-foreground/70">{laneMult(l).toFixed(2)}×</span>
              <span className="text-2xl">{lane === l ? (hazard === l ? "🔥" : "🐔") : hazard === l ? "🔥" : l < lane ? "✓" : "🚗"}</span>
            </div>
          );
        })}
      </div>
      <Card className="space-y-3">
        <div className="grid grid-cols-4 gap-2">
          {Object.keys(P).map((d) => <button key={d} disabled={!!sid} onClick={() => setDiff(d)} className={cn("rounded-lg py-2 text-xs font-bold capitalize", d === diff ? "bg-gradient-primary text-primary-foreground" : "bg-secondary")}>{d}</button>)}
        </div>
        <StakeInput value={stake} onChange={setStake} min={game.min_stake} max={game.max_stake} disabled={!!sid} />
        {sid ? (
          <div className="grid grid-cols-2 gap-2">
            <PrimaryButton onClick={step} loading={busy}>{t("game.go")}</PrimaryButton>
            <PrimaryButton variant="gold" onClick={cashout} disabled={!lane || busy}>{t("game.cashout")} {fmt(Math.floor(stake * mult))}</PrimaryButton>
          </div>
        ) : <PrimaryButton onClick={start} loading={busy}>{t("game.start")}</PrimaryButton>}
      </Card>
    </div>
  );
}
