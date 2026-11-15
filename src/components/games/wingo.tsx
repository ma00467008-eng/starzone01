// WinGo Component - Global Synchronized Periods & Trend
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Minus, Plus, TrendingUp, BarChart3, Globe, Flame, RefreshCw } from "lucide-react";
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
const DEPTHS = [20, 30, 50, 100] as const;

/**
 * Standard WinGo Global Period Formatter
 * Format: YYYYMMDD + ModeCode (01 for 1m, 03 for 3m, 05 for 5m) + 5-digit round of day (10001+)
 */
export function formatGlobalPeriod(rawPeriod: number, duration: number): string {
  const d = new Date(rawPeriod * duration * 1000);
  const startOfDay = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const secondsSinceMidnight = Math.floor((d.getTime() - startOfDay) / 1000);
  const roundOfDay = Math.max(1, Math.floor(secondsSinceMidnight / duration) + 1);

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");

  const modeCode =
    duration === 30 ? "30" : duration === 60 ? "01" : duration === 180 ? "03" : duration === 300 ? "05" : String(duration).padStart(2, "0");
  const roundStr = String(10000 + roundOfDay);

  return `${yyyy}${mm}${dd}${modeCode}${roundStr}`;
}

export function WingoGame({ game }: { game: GameRow }) {
  const { t, session, profile } = useApp();
  const modes = MODES[game.slug] ?? [60];
  const [dur, setDur] = useState<number>(modes[0] ?? 60);
  const [now, setNow] = useState(() => Date.now());
  const [serverOffset, setServerOffset] = useState<number>(0);
  const [sel, setSel] = useState<Sel>(null);
  const [base, setBase] = useState(Math.max(1, game.min_stake >= 10 ? 10 : 1));
  const [qty, setQty] = useState(Math.max(1, Math.ceil(game.min_stake / 10)));
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"hist" | "chart" | "mine">("hist");
  const [histLimit, setHistLimit] = useState<number>(30);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const qc = useQueryClient();
  const after = useAfterPlay(game.slug);
  const lastPeriod = useRef<number | null>(null);
  const isTrx = game.slug === "trx";

  // Global time tick with server calibration
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now() + serverOffset), 250);
    return () => clearInterval(i);
  }, [serverOffset]);

  const period = Math.floor(now / 1000 / dur);
  const remain = Math.max(0, Math.ceil((period + 1) * dur - now / 1000));
  const stake = base * qty;

  const {
    data: rawHist,
    refetch: refetchHist,
    isFetching: isHistLoading,
  } = useQuery({
    queryKey: ["wingo-hist", game.slug, dur, period, histLimit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("wingo_history", { _game: game.slug, _duration: dur, _n: histLimit });
      if (error) throw error;
      const list = (data as Hist[]) ?? [];

      // Calibrate server clock offset from global period
      if (list.length > 0 && list[0]) {
        const expectedServerPeriod = list[0].raw + 1;
        const currentClientPeriod = Math.floor((Date.now() + serverOffset) / 1000 / dur);
        if (Math.abs(currentClientPeriod - expectedServerPeriod) >= 1) {
          const targetTime = expectedServerPeriod * dur * 1000 + dur * 500;
          setServerOffset(targetTime - Date.now());
        }
      }
      return list;
    },
    refetchInterval: remain <= 3 ? 1000 : 8000,
  });

  // Attach standardized global period code to history rows
  const hist = useMemo(() => {
    return (rawHist ?? []).map((h) => ({
      ...h,
      displayPeriod: formatGlobalPeriod(h.raw, dur),
    }));
  }, [rawHist, dur]);

  const { data: myBets } = useQuery({
    queryKey: ["wingo-bets", game.slug, session?.user.id],
    enabled: !!session,
    queryFn: async () =>
      (
        await supabase
          .from("wingo_bets")
          .select("*")
          .eq("game", game.slug)
          .order("created_at", { ascending: false })
          .limit(20)
      ).data ?? [],
  });

  useEffect(() => {
    if (remain <= 5 && remain > 0) beep("tick");
  }, [remain]);

  useEffect(() => {
    if (lastPeriod.current !== null && lastPeriod.current !== period) {
      refetchHist();
      if (session) {
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
              win: r.won > 0,
              amount: r.won,
              round: last ? formatGlobalPeriod(last.raw, prevDur) : undefined,
              detail: last ? <ResultChips n={last.number} /> : undefined,
            });
          });
        }, 700);
      }
    }
    lastPeriod.current = period;
  }, [period, session]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (session) {
      supabase.rpc("wingo_settle").then(({ data }) => {
        const r = data as { balance: number } | null;
        if (r) after(r.balance);
      });
    }
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const bet = async () => {
    if (!sel) return;
    if (stake < game.min_stake || stake > game.max_stake) {
      toast.error(`Stake must be ${fmt(game.min_stake)} – ${fmt(game.max_stake)}`);
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("wingo_bet", {
      _game: game.slug,
      _duration: dur,
      _kind: sel.kind,
      _value: sel.value,
      _stake: stake,
    });
    setBusy(false);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    beep("bet");
    after((data as { balance: number }).balance);
    qc.invalidateQueries({ queryKey: ["wingo-bets", game.slug] });
    toast.success(t("game.bet_placed"));
    setSel(null);
  };

  const periodCode = useMemo(() => formatGlobalPeriod(period, dur), [period, dur]);
  const closed = remain <= 5;
  const mm = String(Math.floor(remain / 60)).padStart(2, "0");
  const ss = String(remain % 60).padStart(2, "0");
  const selTone: string = (sel ? (sel.kind === "number" ? colorBg[numColors(Number(sel.value))[0]!] : colorBg[sel.value]) : "") ?? "";

  const open = (s: Sel) => {
    if (closed) return;
    beep("click");
    setSel(s);
  };

  // Trend Statistics
  const trendStats = useMemo(() => {
    const list = hist ?? [];
    const counts = Array(10).fill(0);
    let big = 0;
    let small = 0;
    let red = 0;
    let green = 0;
    let violet = 0;

    list.forEach((item) => {
      if (item.number >= 0 && item.number <= 9) counts[item.number]++;
      if (item.number >= 5) big++;
      else small++;
      const cols = numColors(item.number);
      if (cols.includes("red")) red++;
      if (cols.includes("green")) green++;
      if (cols.includes("violet")) violet++;
    });

    const total = list.length || 1;
    let maxCount = -1;
    let hotNumber = 0;
    counts.forEach((c, idx) => {
      if (c > maxCount) {
        maxCount = c;
        hotNumber = idx;
      }
    });

    return { counts, big, small, red, green, violet, total, hotNumber, maxCount };
  }, [hist]);

  // Calculate Omission (Missing count) for each period
  const omissionMatrix = useMemo(() => {
    const list = hist ?? [];
    if (!list.length) return [];
    const reversed = [...list].reverse();
    const currMissing = Array(10).fill(0);
    const rowOmissions: Record<string, number[]> = {};

    reversed.forEach((row) => {
      for (let n = 0; n < 10; n++) {
        if (row.number === n) {
          currMissing[n] = 0;
        } else {
          currMissing[n] = (currMissing[n] ?? 0) + 1;
        }
      }
      rowOmissions[row.displayPeriod] = [...currMissing];
    });

    return list.map((r) => ({
      ...r,
      missing: rowOmissions[r.displayPeriod] ?? Array(10).fill(1),
    }));
  }, [hist]);

  return (
    <div className="space-y-3">
      {/* Mode Selector */}
      <div className="grid grid-flow-col gap-1.5 rounded-2xl bg-card p-1.5 shadow-card">
        {modes.map((m) => (
          <button
            key={m}
            onClick={() => setDur(m)}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-semibold transition",
              m === dur ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground"
            )}
          >
            <Clock className="h-5 w-5" />
            {isTrx ? "TRX" : "WinGo"}
            <br />
            {label(m)}
          </button>
        ))}
      </div>

      {/* Countdown Stage */}
      <Stage className="bg-gradient-night p-4">
        <div className="flex items-stretch justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-casino-muted">
              <span>{isTrx ? "TRX WinGo" : game.name} {label(dur)}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                <Globe className="h-2.5 w-2.5 animate-pulse" /> Live
              </span>
            </div>
            <div className="mt-2 flex gap-1">
              {(hist ?? []).slice(0, 5).map((h) => (
                <Ball key={h.raw} n={h.number} size="sm" />
              ))}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-casino-muted">{t("game.time_left")}</div>
            <div className="mt-1 flex justify-end gap-1 font-display text-2xl font-extrabold tabular-nums">
              {[mm[0], mm[1], ":", ss[0], ss[1]].map((c, i) =>
                c === ":" ? (
                  <span key={i} className="px-0.5">:</span>
                ) : (
                  <span key={i} className={cn("grid h-9 w-7 place-items-center rounded-md bg-card text-primary-deep", closed && "text-destructive")}>
                    {c}
                  </span>
                )
              )}
            </div>
            <div className="mt-1.5 font-mono text-[11px] text-casino-muted">{periodCode}</div>
          </div>
        </div>
      </Stage>

      {/* Bet Controls */}
      <div className="relative space-y-3 rounded-2xl bg-card p-3 shadow-card">
        {closed && (
          <div className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-night/75 backdrop-blur-[1px]">
            <div className="flex gap-2">
              {String(remain)
                .padStart(2, "0")
                .split("")
                .map((c, i) => (
                  <span key={i} className="grid h-24 w-16 place-items-center rounded-xl bg-card font-display text-6xl font-black text-primary-deep">
                    {c}
                  </span>
                ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {(["green", "violet", "red"] as const).map((c) => (
            <button
              key={c}
              onClick={() => open({ kind: "color", value: c })}
              className={cn("rounded-tl-xl rounded-br-xl py-3 text-sm font-bold text-primary-foreground shadow-card transition active:scale-95", colorBg[c])}
            >
              {t(`game.${c}`)}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-2.5 rounded-xl bg-secondary/60 p-2.5">
          {Array.from({ length: 10 }, (_, n) => (
            <button key={n} onClick={() => open({ kind: "number", value: String(n) })} className="transition active:scale-90">
              <Ball n={n} size="lg" />
            </button>
          ))}
        </div>
        <div className="flex overflow-hidden rounded-full shadow-card">
          <button onClick={() => open({ kind: "size", value: "big" })} className="flex-1 bg-gold py-3 font-bold text-night">
            {t("game.big")} <span className="text-xs opacity-75">×2</span>
          </button>
          <button onClick={() => open({ kind: "size", value: "small" })} className="flex-1 bg-primary py-3 font-bold text-primary-foreground">
            {t("game.small")} <span className="text-xs opacity-75">×2</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={() => setTab("hist")}
          className={cn(
            "rounded-xl py-2.5 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1",
            tab === "hist" ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-card text-muted-foreground shadow-card"
          )}
        >
          <BarChart3 className="h-4 w-4" /> {t("game.results")}
        </button>
        <button
          onClick={() => setTab("chart")}
          className={cn(
            "rounded-xl py-2.5 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1",
            tab === "chart" ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-card text-muted-foreground shadow-card"
          )}
        >
          <TrendingUp className="h-4 w-4" /> Trend
        </button>
        <button
          onClick={() => setTab("mine")}
          className={cn(
            "rounded-xl py-2.5 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1",
            tab === "mine" ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-card text-muted-foreground shadow-card"
          )}
        >
          {t("game.my_history")}
        </button>
      </div>

      {/* Tab Contents */}
      <div className="overflow-hidden rounded-2xl bg-card shadow-card">
        {/* GAME RESULTS TAB */}
        {tab === "hist" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gradient-primary text-xs text-primary-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-left">Period</th>
                  {isTrx && <th className="text-left">Block</th>}
                  <th className="text-center">Number</th>
                  <th className="text-center">Big/Small</th>
                  <th className="text-center">Color</th>
                </tr>
              </thead>
              <tbody>
                {(hist ?? []).map((h) => (
                  <tr key={h.raw} className="border-t border-border/60 hover:bg-secondary/20">
                    <td className="px-3 py-2.5 font-mono text-xs">{h.displayPeriod}</td>
                    {isTrx && <td className="font-mono text-[10px] text-muted-foreground">{h.hash?.slice(-6)}</td>}
                    <td className="text-center">
                      <div className="flex justify-center">
                        <Ball n={h.number} size="sm" />
                      </div>
                    </td>
                    <td className="text-center">
                      <span className={cn("inline-block rounded-md px-2 py-0.5 text-xs font-bold", h.number >= 5 ? "bg-gold/20 text-gold" : "bg-primary/20 text-primary")}>
                        {h.number >= 5 ? t("game.big") : t("game.small")}
                      </span>
                    </td>
                    <td className="text-center">
                      <div className="flex justify-center gap-1">
                        {numColors(h.number).map((c) => (
                          <span key={c} className={cn("h-3 w-3 rounded-full shadow-sm", colorBg[c])} />
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TREND TAB */}
        {tab === "chart" && (
          <div className="p-3 space-y-3">
            {/* Header Controls & Depth Filter */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">Trend Chart</span>
                <span className="text-[11px] text-muted-foreground font-mono">({dur}s)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-muted-foreground mr-1">Rounds:</span>
                {DEPTHS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setHistLimit(d)}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] font-bold transition",
                      histLimit === d ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {d}
                  </button>
                ))}
                <button onClick={() => refetchHist()} disabled={isHistLoading} className="ml-1 text-muted-foreground hover:text-foreground p-1" title="Refresh">
                  <RefreshCw className={cn("h-3.5 w-3.5", isHistLoading && "animate-spin text-primary")} />
                </button>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="rounded-xl bg-secondary/50 p-2.5 border border-border/50">
                <div className="flex justify-between text-[11px] font-semibold text-muted-foreground mb-1">
                  <span>Big / Small</span>
                  <span>{trendStats.total} rounds</span>
                </div>
                <div className="flex items-center justify-between font-bold text-xs mb-1.5">
                  <span className="text-gold">Big: {trendStats.big} ({Math.round((trendStats.big / trendStats.total) * 100)}%)</span>
                  <span className="text-primary">Small: {trendStats.small} ({Math.round((trendStats.small / trendStats.total) * 100)}%)</span>
                </div>
                <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden flex">
                  <div className="bg-gold h-full" style={{ width: `${(trendStats.big / trendStats.total) * 100}%` }} />
                  <div className="bg-primary h-full" style={{ width: `${(trendStats.small / trendStats.total) * 100}%` }} />
                </div>
              </div>

              <div className="rounded-xl bg-secondary/50 p-2.5 border border-border/50">
                <div className="text-[11px] font-semibold text-muted-foreground mb-1">Color Stats</div>
                <div className="flex items-center justify-between text-xs font-bold pt-0.5">
                  <span className="text-game-green flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-game-green" />{trendStats.green}</span>
                  <span className="text-game-red flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-game-red" />{trendStats.red}</span>
                  <span className="text-game-violet flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-game-violet" />{trendStats.violet}</span>
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1 rounded-xl bg-secondary/50 p-2.5 border border-border/50 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-muted-foreground">Top Winning Ball</div>
                  <div className="text-xs font-bold text-foreground mt-0.5">Number {trendStats.hotNumber} ({trendStats.maxCount} hits)</div>
                </div>
                <Ball n={trendStats.hotNumber} size="sm" />
              </div>
            </div>

            {/* Frequency Bar for 0-9 */}
            <div className="rounded-xl bg-secondary/40 p-2 border border-border/40">
              <div className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-gold" /> Number Frequency (Hits in last {trendStats.total} rounds)
              </div>
              <div className="grid grid-cols-10 gap-1 text-center font-mono">
                {trendStats.counts.map((cnt, n) => (
                  <div
                    key={n}
                    className={cn(
                      "rounded-lg py-1 px-0.5 text-xs transition",
                      cnt === trendStats.maxCount && cnt > 0 ? "bg-gold/20 border border-gold/40 text-gold font-bold" : "bg-card/70"
                    )}
                  >
                    <div className="text-[10px] text-muted-foreground">{n}</div>
                    <div className="font-bold">{cnt}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual Trend Chart with SVG Polyline */}
            <div className="overflow-x-auto rounded-xl border border-border/60 bg-night/30">
              <div className="min-w-[420px]">
                <div className="grid grid-cols-[5.5rem_2.5rem_2.2rem_2.2rem_1fr] items-center bg-secondary/80 px-2 py-2 text-[11px] font-bold text-muted-foreground border-b border-border/60">
                  <span>Period</span>
                  <span className="text-center">Num</span>
                  <span className="text-center">B/S</span>
                  <span className="text-center">Col</span>
                  <div className="grid grid-cols-10 text-center font-mono font-bold text-[11px] text-foreground">
                    {Array.from({ length: 10 }, (_, n) => (
                      <span key={n}>{n}</span>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  {omissionMatrix.length > 1 && (
                    <div className="absolute top-0 bottom-0 right-2 left-[12.9rem] pointer-events-none z-10">
                      <svg className="w-full h-full" viewBox={`0 0 1000 ${omissionMatrix.length * 36}`} preserveAspectRatio="none">
                        <polyline
                          points={omissionMatrix
                            .map((r, idx) => {
                              const x = r.number * 100 + 50;
                              const y = idx * 36 + 18;
                              return `${x},${y}`;
                            })
                            .join(" ")}
                          fill="none"
                          stroke="#F59E0B"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="drop-shadow-[0_0_4px_rgba(245,158,11,0.6)]"
                        />
                      </svg>
                    </div>
                  )}

                  {omissionMatrix.map((h, rowIdx) => (
                    <div
                      key={h.raw}
                      className={cn(
                        "grid grid-cols-[5.5rem_2.5rem_2.2rem_2.2rem_1fr] items-center px-2 h-9 border-b border-border/40 text-xs transition hover:bg-secondary/30",
                        rowIdx % 2 === 0 ? "bg-card/40" : "bg-card/20"
                      )}
                    >
                      <span className="font-mono text-[11px] text-muted-foreground">{h.displayPeriod.slice(-5)}</span>
                      <div className="flex justify-center">
                        <span className={cn("grid h-5 w-5 place-items-center rounded-full font-bold text-[10px] text-primary-foreground", colorBg[numColors(h.number)[0]!])}>
                          {h.number}
                        </span>
                      </div>
                      <div className="text-center font-bold text-[11px]">
                        <span className={h.number >= 5 ? "text-gold" : "text-primary"}>
                          {h.number >= 5 ? "B" : "S"}
                        </span>
                      </div>
                      <div className="flex justify-center">
                        <span className={cn("h-2.5 w-2.5 rounded-full", colorBg[numColors(h.number)[0]!])} />
                      </div>
                      <div className="grid grid-cols-10 h-full items-center text-center">
                        {Array.from({ length: 10 }, (_, n) => (
                          <div key={n} className="grid place-items-center h-full">
                            {n === h.number ? (
                              <Ball n={n} size="xs" />
                            ) : (
                              <span className="grid h-4 w-4 place-items-center rounded-full text-[10px] font-mono text-muted-foreground/60">
                                {h.missing[n] ?? 1}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MY BETS TAB */}
        {tab === "mine" &&
          (!myBets?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No bets yet</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {myBets.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xs font-bold uppercase text-primary-foreground",
                      b.kind === "number" ? colorBg[numColors(Number(b.value))[0]!] : colorBg[b.value]
                    )}
                  >
                    {b.value}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs">{b.period}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {label(b.duration)} · {new Date(b.created_at ?? "").toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold tabular-nums">{fmt(b.stake)}</div>
                    <div className={cn("text-[11px] font-semibold", b.settled ? "text-muted-foreground" : "text-primary")}>
                      {b.settled ? "Settled" : "Waiting"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ))}
      </div>

      {/* Bet Bottom Sheet */}
      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-3xl border-0 p-0">
          <div
            className={cn("rounded-t-3xl px-4 pb-8 pt-5 text-center text-primary-foreground", selTone)}
            style={{ clipPath: "polygon(0 0,100% 0,100% 80%,50% 100%,0 80%)" }}
          >
            <div className="font-display text-lg font-bold">
              {isTrx ? "TRX WinGo" : "WinGo"} {label(dur)}
            </div>
            <div className="mt-1 inline-block rounded-lg bg-card px-4 py-1 text-sm font-bold capitalize text-foreground">Select {sel?.value}</div>
          </div>
          <div className="space-y-4 p-4">
            <Row label="Balance">
              {BASES.map((b) => (
                <Pill
                  key={b}
                  active={base === b}
                  tone={selTone}
                  onClick={() => {
                    beep("chip");
                    setBase(b);
                  }}
                >
                  {b}
                </Pill>
              ))}
            </Row>
            <Row label="Quantity">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className={cn("grid h-9 w-9 place-items-center rounded-lg text-primary-foreground", selTone)}>
                <Minus className="h-4 w-4" />
              </button>
              <input
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1))}
                inputMode="numeric"
                className="h-9 w-20 rounded-lg border border-input text-center font-bold"
              />
              <button onClick={() => setQty((q) => q + 1)} className={cn("grid h-9 w-9 place-items-center rounded-lg text-primary-foreground", selTone)}>
                <Plus className="h-4 w-4" />
              </button>
            </Row>
            <div className="grid grid-cols-6 gap-1.5">
              {MULTS.map((m) => (
                <Pill key={m} active={qty === m} tone={selTone} onClick={() => setQty(m)}>
                  X{m}
                </Pill>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Balance: <b className="text-foreground">{fmt(profile?.balance)}</b> · Limits {fmt(game.min_stake)} – {fmt(game.max_stake)}
            </p>
          </div>
          <div className="grid grid-cols-[1fr_2fr]">
            <button onClick={() => setSel(null)} className="bg-secondary py-4 font-semibold text-muted-foreground">
              Cancel
            </button>
            <button onClick={bet} disabled={busy || closed} className={cn("py-4 font-bold text-primary-foreground disabled:opacity-60", selTone)}>
              {busy ? "…" : `Total amount ${fmt(stake)}`}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <ResultPopup outcome={outcome} onClose={() => setOutcome(null)} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-semibold">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

function Pill({ children, active, tone, onClick }: { children: React.ReactNode; active: boolean; tone: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("min-w-11 rounded-lg px-2.5 py-1.5 text-sm font-bold", active ? cn(tone, "text-primary-foreground") : "bg-secondary text-muted-foreground")}>
      {children}
    </button>
  );
}

function ResultChips({ n }: { n: number }) {
  return (
    <>
      <span className="text-[11px] font-semibold opacity-80">Lottery results</span>
      {numColors(n).map((c) => (
        <span key={c} className={cn("rounded-md px-2 py-0.5 capitalize text-primary-foreground", colorBg[c])}>
          {c}
        </span>
      ))}
      <Ball n={n} size="sm" />
      <span className={cn("rounded-md px-2 py-0.5 text-primary-foreground", n >= 5 ? "bg-gold text-night" : "bg-primary")}>
        {n >= 5 ? "Big" : "Small"}
      </span>
    </>
  );
}

export function Ball({ n, size = "lg" }: { n: number; size?: "xs" | "sm" | "lg" }) {
  const c = numColors(n);
  const bg = c.length > 1 ? `linear-gradient(135deg, var(--game-${c[0]}) 50%, var(--game-${c[1]}) 50%)` : `var(--game-${c[0]})`;
  return (
    <span
      className={cn(
        "relative grid place-items-center rounded-full font-display font-extrabold text-primary-foreground shadow-card",
        size === "xs" ? "h-5 w-5 text-[10px]" : size === "sm" ? "h-7 w-7 text-xs" : "mx-auto aspect-square w-full max-w-14 text-xl"
      )}
      style={{ background: bg }}
    >
      {size === "lg" && <span className="absolute inset-1.5 rounded-full border-2 border-primary-foreground/70" />}
      <span className="relative">{n}</span>
    </span>
  );
}
