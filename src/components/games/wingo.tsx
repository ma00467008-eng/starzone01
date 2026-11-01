import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Minus, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp, errMsg } from "@/lib/app-context";
import { beep, fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { useAfterPlay } from "@/components/sz/shell";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ActionButton, ResultPopup, Stage, type Outcome } from "./kit";
import type { GameRow } from "./types";

const MODES: Record<string, number[]> = { wingo: [30, 60, 180, 300], trx: [60, 180, 300], color: [60, 180, 300] };
const label = (d: number) => (d < 60 ? `${d} sec` : `${d / 60} Min`);
export const numColors = (n: number) => (n === 0 ? ["red", "violet"] : n === 5 ? ["green", "violet"] : n % 2 ? ["green"] : ["red"]);
const colorBg: Record<string, string> = { red: "bg-game-red", green: "bg-game-green", violet: "bg-game-violet", big: "bg-gold", small: "bg-primary" };

type Hist = { period: string; raw: number; number: number; hash: string };
type Sel = { kind: "number" | "size" | "color"; value: string } | null;
const BASES = [1, 10, 100, 1000];
const MULTS = [1, 5, 10, 20, 50, 100];

export function WingoGame({ game }: { game: GameRow }) {
  const { t, session, profile } = useApp();
  const modes = MODES[game.slug] ?? [60];
  const [dur, setDur] = useState<number>(modes[0] ?? 60);
  const [now, setNow] = useState(() => Date.now());
  const [sel, setSel] = useState<Sel>(null);
  const [base, setBase] = useState(Math.max(1, game.min_stake >= 10 ? 10 : 1));
  const [qty, setQty] = useState(Math.max(1, Math.ceil(game.min_stake / 10)));
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"hist" | "chart" | "mine">("hist");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const qc = useQueryClient();
  const after = useAfterPlay(game.slug);
  const lastPeriod = useRef<number | null>(null);
  const isTrx = game.slug === "trx";

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(i); }, []);
  const period = Math.floor(now / 1000 / dur);
  const remain = Math.max(0, Math.ceil((period + 1) * dur - now / 1000));
  const stake = base * qty;

  const { data: hist } = useQuery({
    queryKey: ["wingo-hist", game.slug, dur, period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("wingo_history", { _game: game.slug, _duration: dur, _n: 20 });
      if (error) throw error;
      return (data as Hist[]) ?? [];
    },
  });
  const { data: myBets } = useQuery({
    queryKey: ["wingo-bets", game.slug, session?.user.id],
    enabled: !!session,
    queryFn: async () => (await supabase.from("wingo_bets").select("*").eq("game", game.slug).order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  useEffect(() => { if (remain <= 5 && remain > 0) beep("tick"); }, [remain]);

  useEffect(() => {
    if (lastPeriod.current !== null && lastPeriod.current !== period && session) {
      const prevDur = dur;
      setTimeout(() => {
        supabase.rpc("wingo_settle").then(async ({ data }) => {
          const r = data as { settled: number; won: number; balance: number } | null;
          if (!r?.settled) return;
          after(r.balance);
          qc.invalidateQueries({ queryKey: ["wingo-bets", game.slug] });
          const { data: h } = await supabase.rpc("wingo_history", { _game: game.slug, _duration: prevDur, _n: 1 });
          const last = (h as Hist[] | null)?.[0];
          setOutcome({
            win: r.won > 0, amount: r.won, round: last?.period,
            detail: last ? <ResultChips n={last.number} /> : undefined,
          });
        });
      }, 600);
    }
    lastPeriod.current = period;
  }, [period, session]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (session) supabase.rpc("wingo_settle").then(({ data }) => { const r = data as { balance: number } | null; if (r) after(r.balance); }); }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const bet = async () => {
    if (!sel) return;
    if (stake < game.min_stake || stake > game.max_stake) { toast.error(`Stake must be ${fmt(game.min_stake)} – ${fmt(game.max_stake)}`); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("wingo_bet", { _game: game.slug, _duration: dur, _kind: sel.kind, _value: sel.value, _stake: stake });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    beep("bet");
    after((data as { balance: number }).balance);
    qc.invalidateQueries({ queryKey: ["wingo-bets", game.slug] });
    toast.success(t("game.bet_placed"));
    setSel(null);
  };

  const periodCode = useMemo(() => {
    const d = new Date(period * dur * 1000);
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}${String(dur).padStart(3, "0")}${String(period % 100000).padStart(5, "0")}`;
  }, [period, dur]);

  const closed = remain <= 5;
  const mm = String(Math.floor(remain / 60)).padStart(2, "0"), ss = String(remain % 60).padStart(2, "0");
  const selTone = sel ? (sel.kind === "number" ? colorBg[numColors(Number(sel.value))[0]!] : colorBg[sel.value]) : "";
  const open = (s: Sel) => { if (closed) return; beep("click"); setSel(s); };

  return (
    <div className="space-y-3">
      <div className="grid grid-flow-col gap-1.5 rounded-2xl bg-card p-1.5 shadow-card">
        {modes.map((m) => (
          <button key={m} onClick={() => setDur(m)} className={cn("flex flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-semibold transition", m === dur ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground")}>
            <Clock className="h-5 w-5" />{isTrx ? "TRX" : "WinGo"}<br />{label(m)}
          </button>
        ))}
      </div>

      <Stage className="bg-gradient-night p-4">
        <div className="flex items-stretch justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-casino-muted">{isTrx ? "TRX WinGo" : game.name} {label(dur)}</div>
            <div className="mt-2 flex gap-1">{(hist ?? []).slice(0, 5).map((h) => <Ball key={h.raw} n={h.number} size="sm" />)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-casino-muted">{t("game.time_left")}</div>
            <div className="mt-1 flex justify-end gap-1 font-display text-2xl font-extrabold tabular-nums">
              {[mm[0], mm[1], ":", ss[0], ss[1]].map((c, i) => c === ":" ? <span key={i} className="px-0.5">:</span> : <span key={i} className={cn("grid h-9 w-7 place-items-center rounded-md bg-card text-primary-deep", closed && "text-destructive")}>{c}</span>)}
            </div>
            <div className="mt-1.5 font-mono text-[11px] text-casino-muted">{periodCode}</div>
          </div>
        </div>
      </Stage>

      <div className="relative space-y-3 rounded-2xl bg-card p-3 shadow-card">
        {closed && <div className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-night/75 backdrop-blur-[1px]"><div className="flex gap-2">{String(remain).padStart(2, "0").split("").map((c, i) => <span key={i} className="grid h-24 w-16 place-items-center rounded-xl bg-card font-display text-6xl font-black text-primary-deep">{c}</span>)}</div></div>}
        <div className="grid grid-cols-3 gap-2">
          {(["green", "violet", "red"] as const).map((c) => (
            <button key={c} onClick={() => open({ kind: "color", value: c })} className={cn("rounded-tl-xl rounded-br-xl py-3 text-sm font-bold text-primary-foreground shadow-card transition active:scale-95", colorBg[c])}>{t(`game.${c}`)}</button>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-2.5 rounded-xl bg-secondary/60 p-2.5">
          {Array.from({ length: 10 }, (_, n) => (
            <button key={n} onClick={() => open({ kind: "number", value: String(n) })} className="transition active:scale-90"><Ball n={n} size="lg" /></button>
          ))}
        </div>
        <div className="flex overflow-hidden rounded-full shadow-card">
          <button onClick={() => open({ kind: "size", value: "big" })} className="flex-1 bg-gold py-3 font-bold text-night">{t("game.big")} <span className="text-xs opacity-75">×2</span></button>
          <button onClick={() => open({ kind: "size", value: "small" })} className="flex-1 bg-primary py-3 font-bold text-primary-foreground">{t("game.small")} <span className="text-xs opacity-75">×2</span></button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {([["hist", t("game.results")], ["chart", t("game.trend")], ["mine", t("game.my_history")]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cn("rounded-xl py-2.5 text-sm font-bold", tab === k ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-card text-muted-foreground shadow-card")}>{l}</button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl bg-card shadow-card">
        {tab === "hist" && (
          <table className="w-full text-sm">
            <thead className="bg-gradient-primary text-xs text-primary-foreground"><tr><th className="px-3 py-2.5 text-left">Period</th>{isTrx && <th className="text-left">Block</th>}<th>Number</th><th>Big Small</th><th>Color</th></tr></thead>
            <tbody>
              {(hist ?? []).map((h) => (
                <tr key={h.raw} className="border-t border-border">
                  <td className="px-3 py-2.5 font-mono text-xs">{h.period}</td>
                  {isTrx && <td className="font-mono text-[10px] text-muted-foreground">{h.hash?.slice(-6)}</td>}
                  <td className={cn("text-center font-display text-xl font-black", numColors(h.number)[0] === "red" ? "text-game-red" : "text-game-green")}>{h.number}</td>
                  <td className="text-center">{h.number >= 5 ? t("game.big") : t("game.small")}</td>
                  <td><div className="flex justify-center gap-1">{numColors(h.number).map((c) => <span key={c} className={cn("h-3 w-3 rounded-full", colorBg[c])} />)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === "chart" && (
          <div className="p-3">
            <div className="mb-2 grid grid-cols-[1fr_auto] text-xs font-bold text-muted-foreground"><span>Period</span><span>Number</span></div>
            {(hist ?? []).map((h) => (
              <div key={h.raw} className="grid grid-cols-[6.5rem_1fr] items-center border-t border-border py-1.5">
                <span className="font-mono text-[11px]">{h.period.slice(-6)}</span>
                <div className="grid grid-cols-10 gap-0.5">{Array.from({ length: 10 }, (_, n) => n === h.number ? <Ball key={n} n={n} size="xs" /> : <span key={n} className="grid h-5 w-5 place-items-center rounded-full border border-border text-[10px] text-muted-foreground">{n}</span>)}</div>
              </div>
            ))}
          </div>
        )}
        {tab === "mine" && (!myBets?.length ? <p className="py-8 text-center text-sm text-muted-foreground">No bets yet</p> : (
          <ul className="divide-y divide-border text-sm">
            {myBets.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xs font-bold uppercase text-primary-foreground", b.kind === "number" ? colorBg[numColors(Number(b.value))[0]!] : colorBg[b.value])}>{b.value}</span>
                <div className="min-w-0 flex-1"><div className="font-mono text-xs">{b.period}</div><div className="text-[11px] text-muted-foreground">{label(b.duration)} · {new Date(b.created_at ?? "").toLocaleTimeString()}</div></div>
                <div className="text-right"><div className="font-bold tabular-nums">{fmt(b.stake)}</div><div className={cn("text-[11px] font-semibold", b.settled ? "text-muted-foreground" : "text-primary")}>{b.settled ? "Settled" : "Waiting"}</div></div>
              </li>
            ))}
          </ul>
        ))}
      </div>

      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-3xl border-0 p-0">
          <div className={cn("rounded-t-3xl px-4 pb-8 pt-5 text-center text-primary-foreground", selTone)} style={{ clipPath: "polygon(0 0,100% 0,100% 80%,50% 100%,0 80%)" }}>
            <div className="font-display text-lg font-bold">{isTrx ? "TRX WinGo" : "WinGo"} {label(dur)}</div>
            <div className="mt-1 inline-block rounded-lg bg-card px-4 py-1 text-sm font-bold capitalize text-foreground">Select {sel?.value}</div>
          </div>
          <div className="space-y-4 p-4">
            <Row label="Balance">{BASES.map((b) => <Pill key={b} active={base === b} tone={selTone} onClick={() => { beep("chip"); setBase(b); }}>{b}</Pill>)}</Row>
            <Row label="Quantity">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className={cn("grid h-9 w-9 place-items-center rounded-lg text-primary-foreground", selTone)}><Minus className="h-4 w-4" /></button>
              <input value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1))} inputMode="numeric" className="h-9 w-20 rounded-lg border border-input text-center font-bold" />
              <button onClick={() => setQty((q) => q + 1)} className={cn("grid h-9 w-9 place-items-center rounded-lg text-primary-foreground", selTone)}><Plus className="h-4 w-4" /></button>
            </Row>
            <div className="grid grid-cols-6 gap-1.5">{MULTS.map((m) => <Pill key={m} active={qty === m} tone={selTone} onClick={() => setQty(m)}>X{m}</Pill>)}</div>
            <p className="text-xs text-muted-foreground">Balance: <b className="text-foreground">{fmt(profile?.balance)}</b> · Limits {fmt(game.min_stake)} – {fmt(game.max_stake)}</p>
          </div>
          <div className="grid grid-cols-[1fr_2fr]">
            <button onClick={() => setSel(null)} className="bg-secondary py-4 font-semibold text-muted-foreground">Cancel</button>
            <button onClick={bet} disabled={busy || closed} className={cn("py-4 font-bold text-primary-foreground disabled:opacity-60", selTone)}>{busy ? "…" : `Total amount ${fmt(stake)}`}</button>
          </div>
        </SheetContent>
      </Sheet>

      <ResultPopup outcome={outcome} onClose={() => setOutcome(null)} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{label}</span><div className="flex items-center gap-1.5">{children}</div></div>;
}
function Pill({ children, active, tone, onClick }: { children: React.ReactNode; active: boolean; tone: string; onClick: () => void }) {
  return <button onClick={onClick} className={cn("min-w-11 rounded-lg px-2.5 py-1.5 text-sm font-bold", active ? cn(tone, "text-primary-foreground") : "bg-secondary text-muted-foreground")}>{children}</button>;
}

function ResultChips({ n }: { n: number }) {
  return (
    <>
      <span className="text-[11px] font-semibold opacity-80">Lottery results</span>
      {numColors(n).map((c) => <span key={c} className={cn("rounded-md px-2 py-0.5 capitalize text-primary-foreground", colorBg[c])}>{c}</span>)}
      <Ball n={n} size="sm" />
      <span className={cn("rounded-md px-2 py-0.5 text-primary-foreground", n >= 5 ? "bg-gold text-night" : "bg-primary")}>{n >= 5 ? "Big" : "Small"}</span>
    </>
  );
}

export function Ball({ n, size = "lg" }: { n: number; size?: "xs" | "sm" | "lg" }) {
  const c = numColors(n);
  const bg = c.length > 1 ? `linear-gradient(135deg, var(--game-${c[0]}) 50%, var(--game-${c[1]}) 50%)` : `var(--game-${c[0]})`;
  return (
    <span className={cn("relative grid place-items-center rounded-full font-display font-extrabold text-primary-foreground shadow-card", size === "xs" ? "h-5 w-5 text-[10px]" : size === "sm" ? "h-7 w-7 text-xs" : "mx-auto aspect-square w-full max-w-14 text-xl")} style={{ background: bg }}>
      {size === "lg" && <span className="absolute inset-1.5 rounded-full border-2 border-primary-foreground/70" />}
      <span className="relative">{n}</span>
    </span>
  );
}
