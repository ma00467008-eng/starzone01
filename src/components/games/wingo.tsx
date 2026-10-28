import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useApp, errMsg } from "@/lib/app-context";
import { beep, fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { Card, PrimaryButton, StakeInput, useAfterPlay } from "@/components/sz/shell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { GameRow } from "./types";

const MODES: Record<string, number[]> = { wingo: [30, 60, 180, 300], trx: [60, 180], color: [60, 180, 300] };
const label = (d: number) => (d < 60 ? `${d}s` : `${d / 60}m`);
export const numColors = (n: number) => (n === 0 ? ["red", "violet"] : n === 5 ? ["green", "violet"] : n % 2 ? ["green"] : ["red"]);
const colorBg: Record<string, string> = { red: "bg-game-red", green: "bg-game-green", violet: "bg-game-violet" };

type Hist = { period: string; raw: number; number: number; hash: string };
type Sel = { kind: "number" | "size" | "color"; value: string } | null;

export function WingoGame({ game }: { game: GameRow }) {
  const { t, session } = useApp();
  const modes = MODES[game.slug] ?? [60];
  const [dur, setDur] = useState<number>(modes[0] ?? 60);
  const [now, setNow] = useState(() => Date.now());
  const [sel, setSel] = useState<Sel>(null);
  const [stake, setStake] = useState(game.min_stake);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const after = useAfterPlay(game.slug);
  const lastPeriod = useRef<number | null>(null);

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(i); }, []);
  const period = Math.floor(now / 1000 / dur);
  const remain = Math.max(0, Math.ceil((period + 1) * dur - now / 1000));

  const { data: hist } = useQuery({
    queryKey: ["wingo-hist", game.slug, dur, period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("wingo_history", { _game: game.slug, _duration: dur, _n: 10 });
      if (error) throw error;
      return (data as Hist[]) ?? [];
    },
  });
  const { data: myBets } = useQuery({
    queryKey: ["wingo-bets", game.slug, session?.user.id],
    enabled: !!session,
    queryFn: async () => (await supabase.from("wingo_bets").select("*").eq("game", game.slug).order("created_at", { ascending: false }).limit(10)).data ?? [],
  });

  useEffect(() => {
    if (remain <= 5 && remain > 0) beep("tick");
  }, [remain]);

  useEffect(() => {
    if (lastPeriod.current !== null && lastPeriod.current !== period && session) {
      supabase.rpc("wingo_settle").then(({ data }) => {
        const r = data as { settled: number; won: number; balance: number } | null;
        if (r?.settled) {
          after(r.balance);
          qc.invalidateQueries({ queryKey: ["wingo-bets", game.slug] });
          if (r.won > 0) { beep("win"); toast.success(`${t("game.win")} +${fmt(r.won)}`); } else { beep("lose"); toast(t("game.lose")); }
        }
      });
    }
    lastPeriod.current = period;
  }, [period, session]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (session) supabase.rpc("wingo_settle").then(({ data }) => { const r = data as { balance: number } | null; if (r) after(r.balance); }); }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const bet = async () => {
    if (!sel) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("wingo_bet", { _game: game.slug, _duration: dur, _kind: sel.kind, _value: sel.value, _stake: stake });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    beep("click");
    after((data as { balance: number }).balance);
    qc.invalidateQueries({ queryKey: ["wingo-bets", game.slug] });
    toast.success(`Bet placed on ${sel.value.toUpperCase()}`);
    setSel(null);
  };

  const periodCode = useMemo(() => {
    const d = new Date(period * dur * 1000);
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}${String(period % 100000).padStart(5, "0")}`;
  }, [period, dur]);

  const closed = remain <= 5;
  const isTrx = game.slug === "trx";

  return (
    <div className="space-y-4">
      <div className="grid grid-flow-col gap-2">
        {modes.map((m) => (
          <button key={m} onClick={() => setDur(m)} className={cn("rounded-xl py-2.5 text-sm font-bold transition", m === dur ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-card text-muted-foreground shadow-card")}>
            {game.name.split(" ")[0]} {label(m)}
          </button>
        ))}
      </div>

      <Card className="bg-gradient-night text-night-foreground">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs opacity-70">{t("game.round")}</div>
            <div className="font-mono text-sm font-bold">{periodCode}</div>
            <div className="mt-2 flex gap-1">
              {(hist ?? []).slice(0, 5).map((h) => <Ball key={h.raw} n={h.number} small />)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-70">{t("game.time_left")}</div>
            <div className={cn("font-display text-3xl font-extrabold tabular-nums", closed && "text-game-red animate-pulse")}>
              {String(Math.floor(remain / 60)).padStart(2, "0")}:{String(remain % 60).padStart(2, "0")}
            </div>
          </div>
        </div>
      </Card>

      <Card className="relative space-y-3">
        {closed && <div className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-night/70 font-display text-6xl font-extrabold text-night-foreground">{remain}</div>}
        <div className="grid grid-cols-3 gap-2">
          {(["green", "violet", "red"] as const).map((c) => (
            <button key={c} onClick={() => setSel({ kind: "color", value: c })} className={cn("rounded-xl py-3 text-sm font-bold text-primary-foreground shadow-card transition active:scale-95", colorBg[c])}>{t(`game.${c}`)}</button>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 10 }, (_, n) => (
            <button key={n} onClick={() => setSel({ kind: "number", value: String(n) })} className="transition active:scale-90"><Ball n={n} /></button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setSel({ kind: "size", value: "big" })} className="rounded-full bg-gold py-3 font-bold text-night">{t("game.big")}</button>
          <button onClick={() => setSel({ kind: "size", value: "small" })} className="rounded-full bg-primary py-3 font-bold text-primary-foreground">{t("game.small")}</button>
        </div>
      </Card>

      <Card>
        <h3 className="mb-2 font-display text-sm font-bold">{t("game.results")}</h3>
        <table className="w-full text-xs">
          <thead className="text-muted-foreground"><tr><th className="py-1 text-left">Period</th>{isTrx && <th className="text-left">Hash</th>}<th>No.</th><th>Size</th><th>Color</th></tr></thead>
          <tbody>
            {(hist ?? []).map((h) => (
              <tr key={h.raw} className="border-t border-border">
                <td className="py-2 font-mono">{h.period}</td>
                {isTrx && <td className="font-mono text-[10px] text-muted-foreground">{h.hash}</td>}
                <td className="text-center font-bold">{h.number}</td>
                <td className="text-center">{h.number >= 5 ? "Big" : "Small"}</td>
                <td><div className="flex justify-center gap-1">{numColors(h.number).map((c) => <span key={c} className={cn("h-2.5 w-2.5 rounded-full", colorBg[c])} />)}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {!!myBets?.length && (
        <Card>
          <h3 className="mb-2 font-display text-sm font-bold">My bets</h3>
          <ul className="divide-y divide-border text-xs">
            {myBets.map((b) => (
              <li key={b.id} className="flex justify-between py-2">
                <span>{label(b.duration)} · {b.kind}: <b className="uppercase">{b.value}</b></span>
                <span className="tabular-nums">{fmt(b.stake)} · {b.settled ? "settled" : "waiting"}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Bet on <span className="uppercase">{sel?.value}</span></DialogTitle></DialogHeader>
          <StakeInput value={stake} onChange={setStake} min={game.min_stake} max={game.max_stake} />
          <div className="grid grid-cols-4 gap-2">
            {[10, 50, 100, 500].map((v) => <button key={v} onClick={() => setStake(Math.min(game.max_stake, Math.max(game.min_stake, v)))} className="rounded-lg bg-secondary py-2 text-xs font-bold">{v}</button>)}
          </div>
          <PrimaryButton onClick={bet} loading={busy} disabled={closed}>{t("game.bet")} {fmt(stake)}</PrimaryButton>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Ball({ n, small }: { n: number; small?: boolean }) {
  const c = numColors(n);
  const bg = c.length > 1 ? `linear-gradient(135deg, var(--game-${c[0]}) 50%, var(--game-${c[1]}) 50%)` : `var(--game-${c[0]})`;
  return <span className={cn("grid place-items-center rounded-full font-display font-extrabold text-primary-foreground shadow-card", small ? "h-6 w-6 text-[11px]" : "mx-auto h-12 w-12 text-lg")} style={{ background: bg }}>{n}</span>;
}
