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

export type WinGoOutcome = {
  win: boolean;
  amount: number;
  periodId: string;
  durationLabel: string;
  winningNumber: number;
};

export function calculateBetOutcome(b: any, n: number): { win: boolean; payout: number; mult: number } {
  let win = false;
  let mult = 0;

  if (b.kind === "number") {
    if (Number(b.value) === n) {
      win = true;
      mult = 8.82;
    }
  } else if (b.kind === "size") {
    if ((b.value === "big" && n >= 5) || (b.value === "small" && n < 5)) {
      win = true;
      mult = 1.96;
    }
  } else if (b.kind === "color") {
    if (b.value === "violet") {
      if (n === 0 || n === 5) {
        win = true;
        mult = 4.41;
      }
    } else if (b.value === "green") {
      if (n === 5) {
        win = true;
        mult = 1.47;
      } else if (n % 2 === 1) {
        win = true;
        mult = 1.96;
      }
    } else if (b.value === "red") {
      if (n === 0) {
        win = true;
        mult = 1.47;
      } else if (n % 2 === 0) {
        win = true;
        mult = 1.96;
      }
    }
  }

  const payout = win ? Math.floor(b.stake * mult) : 0;
  return { win, payout, mult };
}

export function WinGoResultPopup({
  outcome,
  onClose,
}: {
  outcome: WinGoOutcome | null;
  onClose: () => void;
}) {
  if (!outcome) return null;

  const { win, amount, periodId, durationLabel, winningNumber } = outcome;
  const isBig = winningNumber >= 5;
  const colors = numColors(winningNumber);
  const primaryColor = colors[0] ?? (winningNumber % 2 === 0 ? "red" : "green");

  const colorBgHex: Record<string, string> = {
    green: "#28a745",
    red: "#dc3545",
    violet: "#6f42c1",
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 backdrop-blur-[2px] transition-all"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.65)" }}
      onClick={onClose}
    >
      <div
        className="w-[310px] max-w-[92vw] rounded-[18px] px-5 py-6 text-center animate-pop"
        style={{
          boxShadow: "0 12px 30px rgba(0, 0, 0, 0.25)",
          background: win
            ? "linear-gradient(180deg, #ff9a44 0%, #ff6a00 35%, #ffffff 35%)"
            : "linear-gradient(180deg, #6c7a89 0%, #95a5a6 35%, #ffffff 35%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[55px] leading-none mb-1 select-none">
          {win ? "🏆" : "😔"}
        </div>
        <div
          className="text-2xl font-bold text-white mt-1 mb-6"
          style={{ textShadow: "0 1px 3px rgba(0, 0, 0, 0.2)" }}
        >
          {win ? "Congratulations" : "Sorry"}
        </div>

        <div
          className="rounded-xl p-3 my-3.5 text-[13px] text-[#555] font-sans"
          style={{ background: "#f8f9fa", border: "1px solid #e9ecef" }}
        >
          <div className="font-semibold text-gray-700">Lottery Results</div>
          <div className="mt-2.5 flex justify-center items-center gap-2 flex-wrap">
            <Ball n={winningNumber} size="md" />
            <div className="flex items-center gap-1.5">
              {colors.map((c) => (
                <span
                  key={c}
                  className="px-3 py-1 rounded-xl text-white font-bold text-[13px] capitalize leading-tight"
                  style={{ backgroundColor: colorBgHex[c] || "#28a745" }}
                >
                  {c}
                </span>
              ))}
              <span
                className="px-3 py-1 rounded-xl text-white font-bold text-[13px] leading-tight"
                style={{ backgroundColor: colorBgHex[primaryColor] || "#28a745" }}
              >
                {isBig ? "Big" : "Small"}
              </span>
            </div>
          </div>
        </div>

        <div
          className="rounded-xl p-3 my-3.5"
          style={{ background: win ? "#fff3e0" : "#f1f3f5" }}
        >
          <div
            className="text-sm font-bold uppercase tracking-wide"
            style={{ color: win ? "#ff6a00" : "#6c757d" }}
          >
            {win ? "Bonus" : "Result"}
          </div>
          <div
            className="font-bold mt-1 tabular-nums"
            style={{
              fontSize: win ? "24px" : "22px",
              color: win ? "#e65100" : "#495057",
            }}
          >
            {win ? fmt(amount) : "Lose"}
          </div>
        </div>

        <div className="text-xs text-[#888] mb-4">
          Period: {durationLabel} {periodId}
        </div>

        <button
          className="w-full text-white border-none py-[11px] px-[30px] rounded-[25px] text-base font-bold cursor-pointer transition hover:opacity-95 active:scale-[0.98] shadow-sm"
          style={{
            background: win
              ? "linear-gradient(90deg, #ff9a44, #ff6a00)"
              : "#6c7a89",
          }}
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}


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
export function parseIssueRaw(issueNumber: string, duration: number): number | null {
  if (!issueNumber || issueNumber.length < 17) return null;
  try {
    const yyyy = parseInt(issueNumber.slice(0, 4), 10);
    const mm = parseInt(issueNumber.slice(4, 6), 10) - 1;
    const dd = parseInt(issueNumber.slice(6, 8), 10);
    const roundOfDay = parseInt(issueNumber.slice(13), 10);
    const startOfDay = Date.UTC(yyyy, mm, dd);
    const epochSeconds = Math.floor(startOfDay / 1000) + (roundOfDay - 1) * duration;
    return Math.floor(epochSeconds / duration);
  } catch {
    return null;
  }
}

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
  const [outcome, setOutcome] = useState<WinGoOutcome | null>(null);

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
              const mapped = list.map((item: any, idx: number) => {
                const issueStr = String(item.issueNumber);
                const parsedRaw = parseIssueRaw(issueStr, dur);
                return {
                  period: issueStr,
                  raw: parsedRaw ?? (period - 1 - idx),
                  number: Number(item.number),
                  hash: String(item.premium ?? ""),
                };
              }) as Hist[];

              if (session && mapped.length > 0) {
                const syncItems = mapped.slice(0, 10).map((m) => ({
                  period: m.raw,
                  number: m.number,
                }));
                Promise.resolve(
                  (supabase.rpc as any)("wingo_record_results", {
                    _game: game.slug,
                    _duration: dur,
                    _items: syncItems,
                  })
                ).catch(() => {});
              }

              return mapped;
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
    enabled: !!session?.user?.id,
    queryFn: async () =>
      session?.user?.id
        ? (
            await supabase
              .from("wingo_bets")
              .select("*")
              .eq("game", game.slug)
              .eq("user_id", session.user.id)
              .order("created_at", { ascending: false })
              .limit(30)
          ).data ?? []
        : [],
    refetchInterval: tab === "mine" ? 3000 : 8000,
  });


  useEffect(() => {
    if (remain <= 5 && remain > 0) beep("tick");
  }, [remain]);

  useEffect(() => {
    if (lastPeriod.current !== null && lastPeriod.current !== period) {
      const endedPeriod = lastPeriod.current;
      const endedDur = dur;
      const endedCode = formatGlobalPeriod(endedPeriod, endedDur);

      if (session) {
        let attempts = 0;
        const maxAttempts = 10;

        const checkAndSettle = async () => {
          attempts++;
          const hist = await refetchHist();
          const items = hist.data ?? [];
          const match =
            items.find((h) => h.period === endedCode || h.raw === endedPeriod) ??
            (accumulatedHist ?? []).find((h) => h.period === endedCode || h.raw === endedPeriod);

          if (match && typeof match.number === "number") {
            const payload = [
              {
                game: game.slug,
                duration: endedDur,
                period: endedPeriod,
                number: match.number,
              },
            ];

            try {
              await (supabase.rpc as any)("wingo_record_results", {
                _game: game.slug,
                _duration: endedDur,
                _items: payload,
              });
            } catch {}

            let res: any = null;
            try {
              const { data } = await (supabase.rpc as any)("wingo_settle", { _results: payload });
              res = data;
            } catch {
              const { data } = await supabase.rpc("wingo_settle");
              res = data;
            }

            const r = res as { settled: number; won: number; balance: number } | null;
            if (r?.balance != null) {
              after(r.balance);
            }
            qc.invalidateQueries({ queryKey: ["wingo-bets", game.slug] });

            // Check if user had any bets placed on this round
                       const betsRes = await supabase
              .from("wingo_bets")
              .select("*")
              .eq("game", game.slug)
              .eq("user_id", session.user.id)
              .order("created_at", { ascending: false })
              .limit(20);


            const roundBets = (betsRes.data ?? myBets ?? []).filter((b: any) => {
              const bPeriodStr = String(b.period).trim();
              return (
                Number(b.period) === endedPeriod ||
                bPeriodStr === String(endedPeriod) ||
                formatBetPeriod(b.period, b.duration || endedDur) === endedCode
              );
            });

            const hadBet = roundBets.length > 0 || (r != null && r.settled > 0);

            if (hadBet) {
              let isWin = r ? r.won > 0 : false;
              let winAmount = r?.won ?? 0;

              if (roundBets.length > 0) {
                let calcWin = false;
                let calcPayout = 0;
                for (const b of roundBets) {
                  const evalRes = calculateBetOutcome(b, match.number);
                  if (evalRes.win) {
                    calcWin = true;
                    calcPayout += evalRes.payout;
                  }
                }
                if (calcWin) {
                  isWin = true;
                  winAmount = Math.max(winAmount, calcPayout);
                }
              }

              setOutcome({
                win: isWin,
                amount: winAmount,
                periodId: endedCode,
                durationLabel: label(endedDur),
                winningNumber: match.number,
              });
              beep(isWin ? "win" : "lose");
            }
          } else if (attempts < maxAttempts) {
            setTimeout(checkAndSettle, 1200);
          } else {
            try {
              const { data } = await supabase.rpc("wingo_settle");
              const r = data as { settled: number; won: number; balance: number } | null;
              if (r?.settled) {
                after(r.balance);
                qc.invalidateQueries({ queryKey: ["wingo-bets", game.slug] });
                const latest = items[0] ?? accumulatedHist[0];
                const winningNum = latest?.number ?? 0;
                const isWin = r.won > 0;
                setOutcome({
                  win: isWin,
                  amount: r.won,
                  periodId: endedCode,
                  durationLabel: label(endedDur),
                  winningNumber: winningNum,
                });
                beep(isWin ? "win" : "lose");
              }
            } catch {}
          }
        };

        setTimeout(checkAndSettle, 1200);
      }
    }
    lastPeriod.current = period;
  }, [period, session, dur, game.slug, accumulatedHist]);

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
      <Stage className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-card via-card/95 to-secondary/30 border border-border/50 shadow-card">
        <div className="flex items-stretch justify-between gap-3">
          <div className="min-w-0 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-bold text-foreground">{isTrx ? "TRX WinGo" : game.name} {label(dur)}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-500 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
                </span>
              </div>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                Period: <span className="font-bold text-foreground">{activePeriodCode}</span>
              </div>
            </div>

            {/* Recent 5 Winning Lottery Balls Shelf */}
            <div className="mt-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-1">
                Recent Results
              </div>
              <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-secondary/50 border border-border/40 w-fit">
                {(accumulatedHist.length ? accumulatedHist : feedItems ?? []).slice(0, 5).map((h) => (
                  <Ball key={h.period} n={h.number} size="sm" />
                ))}
              </div>
            </div>
          </div>

          <div className="text-right flex flex-col items-end justify-between">
            <div className="text-xs font-semibold text-muted-foreground">{t("game.time_left")}</div>
            {/* LED Digital Flip Clock style */}
            <div className="mt-1 flex items-center gap-1 font-mono text-2xl font-black tabular-nums">
              {[mm[0], mm[1], ":", ss[0], ss[1]].map((c, i) =>
                c === ":" ? (
                  <span key={i} className="text-primary font-bold px-0.5 animate-pulse">:</span>
                ) : (
                  <span
                    key={i}
                    className={cn(
                      "grid h-10 w-7 place-items-center rounded-lg bg-secondary font-mono text-xl font-black shadow-inner border border-border/50",
                      closed ? "bg-destructive/15 text-destructive border-destructive/30 animate-pulse" : "text-foreground"
                    )}
                  >
                    {c}
                  </span>
                )
              )}
            </div>
            {closed ? (
              <span className="inline-block mt-1 text-[10px] font-extrabold uppercase tracking-wide text-destructive animate-pulse">
                Draw Locked
              </span>
            ) : (
              <span className="inline-block mt-1 text-[10px] font-medium text-emerald-500">
                Betting Open
              </span>
            )}
          </div>
        </div>
      </Stage>

      {/* Bet Controls */}
      <div className="relative space-y-3 rounded-2xl bg-card p-3.5 shadow-card border border-border/40">
        {closed && (
          <div className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-night/80 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-2">
              <div className="text-xs font-bold uppercase tracking-widest text-destructive animate-pulse">
                Draw in progress
              </div>
              <div className="flex gap-2">
                {String(remain)
                  .padStart(2, "0")
                  .split("")
                  .map((c, i) => (
                    <span
                      key={i}
                      className="grid h-20 w-14 place-items-center rounded-2xl bg-card font-display text-5xl font-black text-destructive shadow-2xl border border-destructive/20 animate-bounce"
                    >
                      {c}
                    </span>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* 3 Color Buttons */}
        <div className="grid grid-cols-3 gap-2.5">
          <button
            onClick={() => open({ kind: "color", value: "green" })}
            className="group relative flex flex-col items-center justify-center rounded-xl py-3 px-2 text-white transition-all active:scale-95 hover:brightness-105"
            style={{
              background: "linear-gradient(135deg, #22c55e 0%, #15803d 100%)",
              boxShadow: "0 4px 12px rgba(34, 197, 94, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.4)",
            }}
          >
            <span className="text-sm font-black tracking-wide uppercase drop-shadow">
              {t("game.green")}
            </span>
            <span className="text-[11px] font-bold text-white/90">×1.96</span>
          </button>

          <button
            onClick={() => open({ kind: "color", value: "violet" })}
            className="group relative flex flex-col items-center justify-center rounded-xl py-3 px-2 text-white transition-all active:scale-95 hover:brightness-105"
            style={{
              background: "linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)",
              boxShadow: "0 4px 12px rgba(168, 85, 247, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.4)",
            }}
          >
            <span className="text-sm font-black tracking-wide uppercase drop-shadow">
              {t("game.violet")}
            </span>
            <span className="text-[11px] font-bold text-white/90">×4.41</span>
          </button>

          <button
            onClick={() => open({ kind: "color", value: "red" })}
            className="group relative flex flex-col items-center justify-center rounded-xl py-3 px-2 text-white transition-all active:scale-95 hover:brightness-105"
            style={{
              background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
              boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.4)",
            }}
          >
            <span className="text-sm font-black tracking-wide uppercase drop-shadow">
              {t("game.red")}
            </span>
            <span className="text-[11px] font-bold text-white/90">×1.96</span>
          </button>
        </div>

        {/* 10 Number Balls Grid (5 columns x 2 rows) */}
        <div className="grid grid-cols-5 gap-2 rounded-2xl bg-secondary/40 p-2.5 border border-border/40">
          {Array.from({ length: 10 }, (_, n) => (
            <button
              key={n}
              onClick={() => open({ kind: "number", value: String(n) })}
              className="group flex flex-col items-center gap-1 rounded-xl p-1 transition-all hover:scale-105 active:scale-95 focus-visible:outline-none"
            >
              <Ball n={n} size="lg" />
              <span className="text-[10px] font-bold text-muted-foreground group-hover:text-foreground transition-colors font-mono">
                ×8.82
              </span>
            </button>
          ))}
        </div>

        {/* Big / Small Buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => open({ kind: "size", value: "big" })}
            className="relative flex items-center justify-between rounded-xl py-3 px-4 text-white transition-all active:scale-95 hover:brightness-105"
            style={{
              background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
              boxShadow: "0 4px 12px rgba(245, 158, 11, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.4)",
            }}
          >
            <span className="text-base font-black tracking-wider uppercase drop-shadow">{t("game.big")}</span>
            <span className="rounded-full bg-black/25 px-2.5 py-0.5 text-xs font-bold text-white/95">×1.96</span>
          </button>

          <button
            onClick={() => open({ kind: "size", value: "small" })}
            className="relative flex items-center justify-between rounded-xl py-3 px-4 text-white transition-all active:scale-95 hover:brightness-105"
            style={{
              background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
              boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.4)",
            }}
          >
            <span className="text-base font-black tracking-wider uppercase drop-shadow">{t("game.small")}</span>
            <span className="rounded-full bg-black/25 px-2.5 py-0.5 text-xs font-bold text-white/95">×1.96</span>
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
                const formattedPeriod = formatBetPeriod(b.period, b.duration || dur);

                // Match against historical drawn results (from live feed or database)
                const histMatch = (accumulatedHist.length ? accumulatedHist : feedItems ?? []).find(
                  (h) => h.period === formattedPeriod || String(h.period) === String(b.period) || h.raw === Number(b.period)
                );

                // Calculate win / loss based on the actual drawn number
                let calculatedWin: boolean | null = null;
                let calculatedPayout = 0;

                if (histMatch != null && typeof histMatch.number === "number") {
                  const evalRes = calculateBetOutcome(b, histMatch.number);
                  calculatedWin = evalRes.win;
                  calculatedPayout = evalRes.payout;
                }

                const isSettled = Boolean(
                  b.settled === true ||
                  histMatch != null ||
                  (b.period && period > Number(b.period))
                );

                const isWin =
                  calculatedWin !== null
                    ? calculatedWin
                    : Boolean(
                        b.is_win === true ||
                        b.won === true ||
                        b.status === "win" ||
                        b.status === "won" ||
                        b.result === "win" ||
                        b.result === "won" ||
                        Number(b.payout) > 0 ||
                        Number(b.win) > 0 ||
                        Number(b.profit) > 0
                      );

                const displayWinAmount =
                  calculatedWin !== null && calculatedWin
                    ? calculatedPayout
                    : (Number(b.payout) > 0 ? Number(b.payout) : null) ??
                      (Number(b.win_amount) > 0 ? Number(b.win_amount) : null) ??
                      (b.kind === "number"
                        ? Math.floor(b.stake * 8.82)
                        : b.value === "violet"
                        ? Math.floor(b.stake * 4.41)
                        : Math.floor(b.stake * 1.96));

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
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <span>{label(b.duration || dur)}</span>
                        <span>·</span>
                        <span>{new Date(b.created_at ?? "").toLocaleTimeString()}</span>
                        {histMatch != null && (
                          <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1 font-bold text-foreground">
                              Result:
                              <span className={cn("grid h-4 w-4 place-items-center rounded-full text-[9px] text-primary-foreground", colorBg[numColors(histMatch.number)[0]!])}>
                                {histMatch.number}
                              </span>
                            </span>
                          </>
                        )}
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

      <WinGoResultPopup outcome={outcome} onClose={() => setOutcome(null)} />
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

export function Ball({
  n,
  size = "lg",
  className,
}: {
  n: number;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const c = numColors(n);
  const isSplit = c.length > 1;

  // Authentic WinGo colors
  const redColor = "#fe3838";
  const greenColor = "#18b653";
  const violetColor = "#9b38fe";

  const c0 = c[0] === "red" ? redColor : c[0] === "green" ? greenColor : violetColor;
  const c1 = isSplit ? (c[1] === "violet" ? violetColor : greenColor) : c0;

  const baseBg = isSplit
    ? `linear-gradient(135deg, ${c0} 50%, ${c1} 50%)`
    : `radial-gradient(circle at 35% 35%, ${c[0] === "red" ? "#ff6b6b" : c[0] === "green" ? "#34d399" : "#c084fc"} 0%, ${c0} 55%, ${c[0] === "red" ? "#c81e1e" : c[0] === "green" ? "#0f7634" : "#721acb"} 100%)`;

  return (
    <span
      className={cn(
        "relative inline-grid place-items-center select-none rounded-full font-display font-black text-white shrink-0 overflow-hidden",
        size === "xs" && "h-5 w-5 text-[10px]",
        size === "sm" && "h-7 w-7 text-xs",
        size === "md" && "h-9 w-9 text-sm",
        size === "lg" && "mx-auto aspect-square w-full max-w-[50px] text-xl ring-1 ring-white/30",
        className
      )}
      style={{
        background: baseBg,
        boxShadow:
          size === "lg"
            ? "0 4px 10px rgba(0, 0, 0, 0.35), inset 0 -3px 5px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.6)"
            : size === "md"
            ? "0 3px 6px rgba(0, 0, 0, 0.3), inset 0 -2px 3px rgba(0, 0, 0, 0.35), inset 0 1.5px 2px rgba(255, 255, 255, 0.55)"
            : "0 2px 4px rgba(0, 0, 0, 0.25), inset 0 -1.5px 2.5px rgba(0, 0, 0, 0.35), inset 0 1.5px 2px rgba(255, 255, 255, 0.5)",
      }}
    >
      {/* 3D Specular highlight / gloss */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 32% 24%, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.25) 28%, transparent 60%)",
        }}
      />
      {/* Inner white lottery ring on large & medium balls */}
      {(size === "lg" || size === "md") && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-1.5 rounded-full border border-white/40"
        />
      )}
      {/* Centered number with depth shadow */}
      <span
        className="relative z-10 leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
        style={{
          textShadow: "0 1px 2px rgba(0, 0, 0, 0.6)",
        }}
      >
        {n}
      </span>
    </span>
  );
}
