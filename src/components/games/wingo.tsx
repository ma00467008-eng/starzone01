// WinGo Component - Synchronized Periods, Accurate Win/Loss & Clean Trend
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Minus, Plus, TrendingUp, BarChart3, Globe, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
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

// Official WinGo Mode Codes & Endpoints
const MODE_CODES: Record<number, string> = {
  30: "10005",
  60: "10001",
  180: "10002",
  300: "10003",
};

const GLOBAL_FEED_URLS: Record<number, string> = {
  30: "https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json",
  60: "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json",
  180: "https://draw.ar-lottery01.com/WinGo/WinGo_3M/GetHistoryIssuePage.json",
  300: "https://draw.ar-lottery01.com/WinGo/WinGo_5M/GetHistoryIssuePage.json",
};

/**
 * Standard WinGo Period Formatter
 */
export function formatGlobalPeriod(rawPeriod: number, duration: number): string {
  const d = new Date(rawPeriod * duration * 1000);
  const startOfDay = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const secondsSinceMidnight = Math.floor((d.getTime() - startOfDay) / 1000);
  const roundOfDay = Math.max(1, Math.floor(secondsSinceMidnight / duration) + 1);

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const code = MODE_CODES[duration] ?? "10001";
  const roundStr = String(roundOfDay).padStart(4, "0");

  return `${yyyy}${mm}${dd}${code}${roundStr}`;
}

/**
 * Normalizes any stored bet period to display consistently
 */
export function formatBetPeriod(p: any, duration: number): string {
  if (!p) return "";
  const s = String(p).trim();
  if (s.length >= 14) return s;

  const num = Number(s);
  if (!isNaN(num) && num > 0) {
    if (num > 1_000_000_000_000) {
      return formatGlobalPeriod(Math.floor(num / 1000 / duration), duration);
    }
    if (num > 1_000_000_000) {
      return formatGlobalPeriod(Math.floor(num / duration), duration);
    }
    return formatGlobalPeriod(num, duration);
  }
  return s;
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
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  // Pagination (10 results per page, up to 50 results / 5 pages)
  const [page, setPage] = useState<number>(1);
  const [accumulatedHist, setAccumulatedHist] = useState<Hist[]>([]);

  const qc = useQueryClient();
  const after = useAfterPlay(game.slug);
  const lastPeriod = useRef<number | null>(null);
  const isTrx = game.slug === "trx";

  useEffect(() => {
    setPage(1);
    setAccumulatedHist([]);
  }, [dur]);

  // Global time tick
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now() + serverOffset), 250);
    return () => clearInterval(i);
  }, [serverOffset]);

  const period = Math.floor(now / 1000 / dur);
  const remain = Math.max(0, Math.ceil((period + 1) * dur - now / 1000));
  const stake = base * qty;

  // Live Results Feed
  const {
    data: feedItems,
    refetch: refetchHist,
    isFetching: isHistLoading,
  } = useQuery({
    queryKey: ["wingo-global-hist", game.slug, dur, period],
    queryFn: async () => {
      try {
        const feedUrl = GLOBAL_FEED_URLS[dur];
        if (feedUrl) {
          const res = await fetch(feedUrl, { cache: "no-store" });
          if (res.ok) {
            const json = await res.json();
            const list = json?.data?.list ?? [];
            if (Array.isArray(list) && list.length > 0) {
              return list.map((item: any, idx: number) => ({
                period: String(item.issueNumber),
                raw: period - 1 - idx,
                number: Number(item.number),
                hash: String(item.premium ?? ""),
              })) as Hist[];
            }
          }
        }
      } catch (err) {
        console.warn("Feed fetch fallback to Supabase:", err);
      }

      // Fallback to database
      const { data, error } = await supabase.rpc("wingo_history", { _game: game.slug, _duration: dur, _n: 50 });
      if (error) throw error;
      return ((data as Hist[]) ?? []).map((h) => ({
        ...h,
        period: h.period ? String(h.period) : formatGlobalPeriod(h.raw, dur),
      }));
    },
    refetchInterval: remain <= 3 ? 1000 : 4000,
  });

  // Accumulate up to 50 unique results
  useEffect(() => {
    if (feedItems && feedItems.length > 0) {
      setAccumulatedHist((prev) => {
        const map = new Map<string, Hist>();
        feedItems.forEach((item) => map.set(item.period, item));
        prev.forEach((item) => {
          if (!map.has(item.period)) map.set(item.period, item);
        });
        const merged = Array.from(map.values()).sort((a, b) => b.period.localeCompare(a.period));
        return merged.slice(0, 50);
      });
    }
  }, [feedItems]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.min(5, Math.ceil(accumulatedHist.length / pageSize)));
  const currentPage = Math.min(page, totalPages);

  const pagedHist = useMemo(() => {
    return accumulatedHist.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [accumulatedHist, currentPage, pageSize]);

  // Synchronized active period code: derived from latest history issue + 1
  const latestHistPeriod = accumulatedHist?.[0]?.period ?? feedItems?.[0]?.period;
  const activePeriodCode = useMemo(() => {
    if (latestHistPeriod && /^\d+$/.test(latestHistPeriod)) {
      try {
        return (BigInt(latestHistPeriod) + 1n).toString();
      } catch {
        // Fallback
      }
    }
    return formatGlobalPeriod(period, dur);
  }, [latestHistPeriod, period, dur]);

  // User Bets History
  const { data: myBets } = useQuery({
    queryKey: ["wingo-bets", game.slug, session?.user?.id],
    enabled: !!session,
    queryFn: async () =>
      (
        await supabase
          .from("wingo_bets")
          .select("*")
          .eq("game", game.slug)
          .order("created_at", { ascending: false })
          .limit(30)
      ).data ?? [],
    refetchInterval: tab === "mine" ? 3000 : 8000,
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
            const last = accumulatedHist?.[0] ?? feedItems?.[0];
            setOutcome({
              win: r.won > 0,
              amount: r.won,
              round: last ? last.period : formatGlobalPeriod(period - 1, prevDur),
              detail: last ? <ResultChips n={last.number} /> : undefined,
            });
          });
        }, 700);
      }
    }
    lastPeriod.current = period;
  }, [period, session, accumulatedHist, feedItems]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const closed = remain <= 5;
  const mm = String(Math.floor(remain / 60)).padStart(2, "0");
  const ss = String(remain % 60).padStart(2, "0");
  const selTone: string = (sel ? (sel.kind === "number" ? colorBg[numColors(Number(sel.value))[0]!] : colorBg[sel.value]) : "") ?? "";

  const open = (s: Sel) => {
    if (closed) return;
    beep("click");
    setSel(s);
  };

  // Omission Matrix for current 10 visible rounds
  const pagedOmissionMatrix = useMemo(() => {
    if (!pagedHist.length) return [];
    const reversed = [...pagedHist].reverse();
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
      rowOmissions[row.period] = [...currMissing];
    });

    return pagedHist.map((r) => ({
      ...r,
      missing: rowOmissions[r.period] ?? Array(10).fill(1),
    }));
  }, [pagedHist]);

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
              {(accumulatedHist.length ? accumulatedHist : feedItems ?? []).slice(0, 5).map((h) => (
                <Ball key={h.period} n={h.number} size="sm" />
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
            <div className="mt-1.5 font-mono text-[11px] text-casino-muted">{activePeriodCode}</div>
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
          <div>
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
                  {(pagedHist.length ? pagedHist : (feedItems ?? []).slice(0, 10)).map((h) => (
                    <tr key={h.period} className="border-t border-border/60 hover:bg-secondary/20">
                      <td className="px-3 py-2.5 font-mono text-xs">{h.period}</td>
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

            {/* Pagination Controls */}
            <div className="flex items-center justify-center gap-4 py-3 border-t border-border/50 bg-secondary/30">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="grid h-8 w-8 place-items-center rounded-lg bg-card text-foreground shadow-sm transition disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-bold text-muted-foreground font-mono">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="grid h-8 w-8 place-items-center rounded-lg bg-card text-foreground shadow-sm transition disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* TREND TAB */}
        {tab === "chart" && (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">Trend Chart</span>
                <span className="text-[11px] text-muted-foreground font-mono">({dur}s)</span>
              </div>
              <button
                onClick={() => refetchHist()}
                disabled={isHistLoading}
                className="text-muted-foreground hover:text-foreground p-1 flex items-center gap-1 text-xs"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isHistLoading && "animate-spin text-primary")} /> Sync
              </button>
            </div>

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
                  {pagedOmissionMatrix.length > 1 && (
                    <div className="absolute top-0 bottom-0 right-2 left-[12.9rem] pointer-events-none z-10">
                      <svg className="w-full h-full" viewBox={`0 0 1000 ${pagedOmissionMatrix.length * 36}`} preserveAspectRatio="none">
                        <polyline
                          points={pagedOmissionMatrix
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

                  {pagedOmissionMatrix.map((h, rowIdx) => (
                    <div
                      key={h.period}
                      className={cn(
                        "grid grid-cols-[5.5rem_2.5rem_2.2rem_2.2rem_1fr] items-center px-2 h-9 border-b border-border/40 text-xs transition hover:bg-secondary/30",
                        rowIdx % 2 === 0 ? "bg-card/40" : "bg-card/20"
                      )}
                    >
                      <span className="font-mono text-[11px] text-muted-foreground">{h.period.slice(-5)}</span>
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

            {/* Pagination Controls */}
            <div className="flex items-center justify-center gap-4 py-2 bg-secondary/30 rounded-xl">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="grid h-8 w-8 place-items-center rounded-lg bg-card text-foreground shadow-sm transition disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-bold text-muted-foreground font-mono">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="grid h-8 w-8 place-items-center rounded-lg bg-card text-foreground shadow-sm transition disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* MY BETS TAB */}
        {tab === "mine" &&
          (!myBets?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No bets yet</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {myBets.map((b: any) => {
                // Settle check
                const isSettled = Boolean(
                  b.settled === true ||
                  b.status === "settled" ||
                  b.status === "win" ||
                  b.status === "won" ||
                  b.status === "loss" ||
                  b.status === "lost" ||
                  b.is_settled === true ||
                  b.settled_at != null ||
                  (b.payout !== null && b.payout !== undefined) ||
                  (b.won !== null && b.won !== undefined) ||
                  (b.is_win !== null && b.is_win !== undefined)
                );

                // Win check
                const isWin = Boolean(
                  b.is_win === true ||
                  b.won === true ||
                  b.status === "win" ||
                  b.status === "won" ||
                  b.result === "win" ||
                  b.result === "won" ||
                  Number(b.payout) > 0 ||
                  Number(b.win) > 0 ||
                  Number(b.won) > 0 ||
                  Number(b.win_amount) > 0 ||
                  Number(b.won_amount) > 0 ||
                  Number(b.payout_amount) > 0 ||
                  Number(b.profit) > 0 ||
                  (typeof b.won === "number" && b.won > 0)
                );

                // Win payout calculation
                const payoutVal =
                  (Number(b.payout) > 0 ? Number(b.payout) : null) ??
                  (Number(b.win_amount) > 0 ? Number(b.win_amount) : null) ??
                  (Number(b.won_amount) > 0 ? Number(b.won_amount) : null) ??
                  (Number(b.payout_amount) > 0 ? Number(b.payout_amount) : null) ??
                  (Number(b.profit) > 0 ? Number(b.profit) : null) ??
                  (typeof b.won === "number" && b.won > 0 ? b.won : null) ??
                  (Number(b.win) > 0 ? Number(b.win) : null) ??
                  (b.kind === "number"
                    ? b.stake * 9
                    : b.value === "violet"
                    ? b.stake * 4.5
                    : b.stake * 1.96);

                const displayWinAmount = isWin ? payoutVal : 0;
                const formattedPeriod = formatBetPeriod(b.period, b.duration || dur);

                return (
                  <li key={b.id} className="flex items-center gap-3 px-3 py-3 hover:bg-secondary/20 transition">
                    <span
                      className={cn(
                        "grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-bold uppercase text-primary-foreground shadow-sm",
                        b.kind === "number" ? colorBg[numColors(Number(b.value))[0]!] : colorBg[b.value]
                      )}
                    >
                      {b.value}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-xs font-semibold">{formattedPeriod}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {label(b.duration || dur)} · {new Date(b.created_at ?? "").toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="text-right">
                      {isSettled ? (
                        isWin ? (
                          <div className="flex items-center justify-end gap-0.5 font-bold text-emerald-500 tabular-nums text-sm">
                            <Plus className="h-3.5 w-3.5 stroke-[3]" />
                            <span>{fmt(displayWinAmount)}</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-0.5 font-bold text-destructive tabular-nums text-sm">
                            <Minus className="h-3.5 w-3.5 stroke-[3]" />
                            <span>{fmt(b.stake)}</span>
                          </div>
                        )
                      ) : (
                        <div className="text-sm font-bold tabular-nums text-foreground">{fmt(b.stake)}</div>
                      )}
                      <div
                        className={cn(
                          "text-[10px] font-bold uppercase mt-0.5",
                          !isSettled ? "text-amber-500" : isWin ? "text-emerald-500" : "text-destructive"
                        )}
                      >
                        {!isSettled ? "Waiting" : isWin ? "Win" : "Loss"}
                      </div>
                    </div>
                  </li>
                );
              })}
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
            <div className="grid grid-cols-6 gap-1.5">{MULTS.map((m) => (
              <Pill key={m} active={qty === m} tone={selTone} onClick={() => setQty(m)}>
                X{m}
              </Pill>
            ))}</div>
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
