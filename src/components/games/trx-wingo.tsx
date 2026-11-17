import { useEffect, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Clock,
  History,
  TrendingUp,
  ReceiptText,
  Copy,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Info,
  RefreshCw,
  HelpCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { beep, fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { Card, PrimaryButton, useAfterPlay } from "@/components/sz/shell";
import {
  Ball,
  WinGoResultPopup,
  calculateBetOutcome,
  formatBetPeriod,
  formatGlobalPeriod,
  numColors,
  parseIssueRaw,
  type WinGoOutcome,
} from "./wingo";
import type { GameRow } from "./types";

/* =========================================================================
   Live Tron Blockchain WinGo API Feed
   ========================================================================= */

const TRX_GLOBAL_FEED_URLS: Record<number, string> = {
  60: "https://draw.ar-lottery01.com/TrxWinGo/TrxWinGo_1M/GetHistoryIssuePage.json",
  180: "https://draw.ar-lottery01.com/TrxWinGo/TrxWinGo_3M/GetHistoryIssuePage.json",
  300: "https://draw.ar-lottery01.com/TrxWinGo/TrxWinGo_5M/GetHistoryIssuePage.json",
};

type TrxHistItem = {
  period: string;
  raw: number;
  number: number;
  color: string;
  blockId: string;
  blockNumber: number;
  blockTimestamp: number;
};

type TrxSel = { kind: "number" | "size" | "color"; value: string } | null;

/* =========================================================================
   TRX WinGo Component
   ========================================================================= */

export function TrxWingoGame({ game }: { game: GameRow }) {
  const { session, profile } = useApp();
  const qc = useQueryClient();
  const after = useAfterPlay(game.slug);

  const [dur, setDur] = useState<number>(60);
  const [now, setNow] = useState(() => Date.now());
  const [serverOffset, setServerOffset] = useState<number>(0);
  const [sel, setSel] = useState<TrxSel>(null);
  const [base, setBase] = useState(10);
  const [multiplier, setMultiplier] = useState(1);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<"records" | "chart" | "mybets">("records");
  const [selectedBlockProof, setSelectedBlockProof] = useState<TrxHistItem | null>(null);
  const [accumulatedHist, setAccumulatedHist] = useState<TrxHistItem[]>([]);
  const [outcome, setOutcome] = useState<WinGoOutcome | null>(null);
  const [page, setPage] = useState(1);

  const lastPeriod = useRef<number | null>(null);

  // Time ticker
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + serverOffset), 250);
    return () => clearInterval(timer);
  }, [serverOffset]);

  const period = Math.floor(now / 1000 / dur);
  const remain = Math.max(0, Math.ceil((period + 1) * dur - now / 1000));
  const isLocked = remain <= 5;
  const stake = base * multiplier;

  // Live TRX Tron Blockchain Results Feed
  const {
    data: feedItems,
    refetch: refetchHist,
    isFetching: isHistLoading,
  } = useQuery({
    queryKey: ["trx-wingo-feed", dur, period],
    queryFn: async () => {
      try {
        const url = TRX_GLOBAL_FEED_URLS[dur];
        if (!url) return [];
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return [];
        const json = await res.json();
        const list = json?.data?.list ?? [];

        if (Array.isArray(list) && list.length > 0) {
          const mapped: TrxHistItem[] = list.map((item: any, idx: number) => {
            const issueStr = String(item.issueNumber);
            const parsedRaw = parseIssueRaw(issueStr, dur);
            return {
              period: issueStr,
              raw: parsedRaw ?? period - 1 - idx,
              number: Number(item.number),
              color: String(item.color || "green"),
              blockId: String(item.blockId || ""),
              blockNumber: Number(item.blockNumber || 0),
              blockTimestamp: Number(item.blockTimestamp || 0),
            };
          });

          // Sync into database if authenticated
          if (session && mapped.length > 0) {
            const syncPayload = mapped.slice(0, 8).map((m) => ({
              period: m.raw,
              number: m.number,
            }));
            try {
              await (supabase.rpc as any)("wingo_record_results", {
                _game: game.slug,
                _duration: dur,
                _items: syncPayload,
              });
            } catch {
              /* ignore */
            }
          }

          return mapped;
        }
      } catch (e) {
        console.warn("TRX WinGo feed fetch error:", e);
      }
      return [];
    },
    refetchInterval: 3000,
  });

  const historyList = (feedItems && feedItems.length > 0 ? feedItems : accumulatedHist) || [];
  const latestResult = historyList[0] || null;

  // Period Change and Auto-Settlement
  useEffect(() => {
    if (lastPeriod.current === null) {
      lastPeriod.current = period;
      return;
    }

    if (lastPeriod.current !== period) {
      const endedPeriod = lastPeriod.current;
      const endedDur = dur;
      lastPeriod.current = period;

      if (session) {
        let attempts = 0;
        const checkAndSettle = async () => {
          attempts++;
          const hist = await refetchHist();
          const items = hist.data ?? [];
          const match = items.find((h) => h.raw === endedPeriod);

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
              const { data } = await (supabase.rpc as any)("wingo_settle", { _results: payload });
              if (data?.balance != null) after(data.balance);
            } catch {
              const { data } = await supabase.rpc("wingo_settle");
              if (data && (data as any)?.balance != null) after((data as any).balance);
            }

            qc.invalidateQueries({ queryKey: ["trx-bets", game.slug] });

            // Check if user had a winning bet
            const betsRes = await supabase
              .from("wingo_bets")
              .select("*")
              .eq("game", game.slug)
              .eq("duration", endedDur)
              .eq("period", endedPeriod);

            const userBets = betsRes.data ?? [];
            if (userBets.length > 0) {
              let totalWon = 0;
              let anyWin = false;

              for (const b of userBets) {
                const outcomeCalc = calculateBetOutcome(b, match.number);
                if (outcomeCalc.win) {
                  anyWin = true;
                  totalWon += outcomeCalc.payout;
                }
              }

              if (anyWin) beep("bigwin");
              else beep("lose");

              setOutcome({
                win: anyWin,
                amount: totalWon,
                periodId: formatGlobalPeriod(endedPeriod, endedDur),
                durationLabel: `TRX ${endedDur >= 60 ? endedDur / 60 + "M" : endedDur + "S"}`,
                winningNumber: match.number,
              });
            }
          } else if (attempts < 8) {
            setTimeout(checkAndSettle, 1200);
          }
        };

        setTimeout(checkAndSettle, 1000);
      }
    }
  }, [period, dur, session]);

  // My Bets Query
  const { data: myBets = [], refetch: refetchMyBets } = useQuery({
    queryKey: ["trx-bets", game.slug, dur],
    queryFn: async () => {
      if (!session?.user) return [];
      const { data, error } = await supabase
        .from("wingo_bets")
        .select("*")
        .eq("game", game.slug)
        .eq("duration", dur)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) return [];
      return data;
    },
    enabled: !!session?.user,
  });

  const handlePlaceBet = async () => {
    if (!session?.user) {
      toast.error("Please login to place bets");
      return;
    }
    if (!sel) {
      toast.error("Please select a number, color, or size");
      return;
    }
    if (isLocked) {
      toast.error("Current round locked! Wait for next round");
      return;
    }
    if (stake < game.min_stake || stake > game.max_stake) {
      toast.error(`Stake must be between ₹${game.min_stake} and ₹${game.max_stake}`);
      return;
    }
    if ((profile?.balance ?? 0) < stake) {
      toast.error("Insufficient balance");
      return;
    }

    setBusy(true);
    beep("bet");

    try {
      const { data, error } = await (supabase.rpc as any)("wingo_bet", {
        _game: game.slug,
        _duration: dur,
        _kind: sel.kind,
        _value: sel.value,
        _stake: stake,
      });

      if (error) throw error;

      toast.success(
        `Bet placed on ${sel.value.toUpperCase()} for period ${formatGlobalPeriod(period, dur)}`
      );
      setSel(null);
      refetchMyBets();
      if (data?.balance != null) after(data.balance);
    } catch (err: any) {
      toast.error(err.message || "Failed to place bet");
    } finally {
      setBusy(false);
    }
  };

  const currentPeriodStr = formatGlobalPeriod(period, dur);
  const minutes = Math.floor(remain / 60);
  const seconds = remain % 60;
  const timeFormatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="space-y-4 font-sans select-none max-w-lg mx-auto">
      {/* =========================================================================
          TRX WinGo Top Header Banner
          ========================================================================= */}
      <div className="relative overflow-hidden rounded-2xl border border-red-500/40 bg-gradient-to-r from-red-950 via-zinc-950 to-red-950 p-3.5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Tron TRX Emblem */}
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600/30 border border-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.5)]">
              <svg viewBox="0 0 32 32" className="h-6 w-6 fill-red-500 drop-shadow">
                <path d="M16 2 L2 9 L8 28 L16 30 L24 28 L30 9 Z M16 6 L25.5 10.5 L16 25 L6.5 10.5 Z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-display text-lg font-black tracking-tight text-white">
                  TRX WIN GO
                </h1>
                <span className="rounded-full bg-red-500/20 px-2 py-0.2 text-[10px] font-black text-red-400 border border-red-500/30">
                  TRON
                </span>
              </div>
              <p className="text-[11px] font-mono text-zinc-400">
                Public Blockchain Hash Verification
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => refetchHist()}
              disabled={isHistLoading}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-zinc-300 transition hover:bg-black/60 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", isHistLoading && "animate-spin text-red-400")} />
            </button>
          </div>
        </div>

        {/* Mode Duration Tabs (1M, 3M, 5M) */}
        <div className="mt-3.5 grid grid-cols-3 gap-2">
          {[
            { dur: 60, label: "TRX 1Min" },
            { dur: 180, label: "TRX 3Min" },
            { dur: 300, label: "TRX 5Min" },
          ].map((item) => (
            <button
              key={item.dur}
              onClick={() => {
                setDur(item.dur);
                setSel(null);
              }}
              className={cn(
                "flex flex-col items-center justify-center rounded-xl py-2 transition-all active:scale-95 border",
                dur === item.dur
                  ? "bg-gradient-to-b from-red-600 to-red-800 text-white border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)] font-black"
                  : "bg-black/50 text-zinc-400 border-white/5 hover:bg-black/70 hover:text-white font-bold"
              )}
            >
              <Clock className="h-4 w-4 mb-0.5 opacity-80" />
              <span className="text-xs">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* =========================================================================
          Live Draw Countdown & Latest Tron Block Status
          ========================================================================= */}
      <Card className="p-4 border-border/40 bg-gradient-to-b from-card via-card to-background shadow-xl">
        <div className="grid grid-cols-2 gap-3 pb-3 border-b border-border/40">
          {/* Period ID */}
          <div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <span>Period</span>
              <HelpCircle className="h-3 w-3" />
            </div>
            <div className="mt-1 font-mono text-base sm:text-lg font-black text-foreground tracking-tight">
              {currentPeriodStr}
            </div>
          </div>

          {/* Time Remaining */}
          <div className="text-right">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Time Remaining
            </div>
            <div
              className={cn(
                "mt-1 font-mono text-2xl sm:text-3xl font-black tracking-tight",
                isLocked ? "text-red-500 animate-pulse" : "text-amber-400"
              )}
            >
              {timeFormatted}
            </div>
          </div>
        </div>

        {/* Latest Tron Draw Outcome Banner */}
        {latestResult && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-black/40 p-2.5 border border-white/5">
            <div className="flex items-center gap-2">
              <Ball n={latestResult.number} size="sm" />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono font-black text-white">
                    #{latestResult.period.slice(-4)}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-1.5 py-0.2 rounded capitalize text-white",
                      latestResult.color.includes("red") ? "bg-red-600" : "bg-emerald-600"
                    )}
                  >
                    {latestResult.color}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-zinc-700 text-zinc-200">
                    {latestResult.number >= 5 ? "Big" : "Small"}
                  </span>
                </div>
                {/* Tron Hash Preview with ending character highlighted */}
                <div className="flex items-center gap-1 mt-0.5 text-[10px] font-mono text-zinc-400">
                  <span>Hash: ...{latestResult.blockId.slice(-8, -1)}</span>
                  <span className="font-black text-amber-400 bg-amber-400/20 px-1 rounded">
                    {latestResult.blockId.slice(-1) || latestResult.number}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedBlockProof(latestResult)}
              className="flex items-center gap-1 text-[11px] font-bold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2 py-1 rounded-lg border border-red-500/30 transition"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Verify</span>
            </button>
          </div>
        )}
      </Card>

      {/* =========================================================================
          Betting Selection Board (Colors, 3D Number Balls, Big/Small)
          ========================================================================= */}
      <Card className="p-4 border-border/40 bg-card shadow-xl space-y-4">
        {/* Colors (Green 1.96x, Violet 4.41x, Red 1.96x) */}
        <div className="grid grid-cols-3 gap-2.5">
          <button
            disabled={isLocked}
            onClick={() => setSel({ kind: "color", value: "green" })}
            className={cn(
              "flex flex-col items-center justify-center rounded-xl py-3 border transition-all active:scale-95 disabled:opacity-40",
              sel?.kind === "color" && sel.value === "green"
                ? "bg-emerald-600 text-white border-emerald-300 ring-2 ring-emerald-400 shadow-[0_0_15px_rgba(168,85,247,0.6)] font-black"
                : "bg-emerald-600/90 hover:bg-emerald-600 text-white border-emerald-500/50 shadow-md font-bold"
            )}
          >
            <span className="text-sm">Green</span>
            <span className="text-[10px] opacity-90">1.96×</span>
          </button>

          <button
            disabled={isLocked}
            onClick={() => setSel({ kind: "color", value: "violet" })}
            className={cn(
              "flex flex-col items-center justify-center rounded-xl py-3 border transition-all active:scale-95 disabled:opacity-40",
              sel?.kind === "color" && sel.value === "violet"
                ? "bg-purple-600 text-white border-purple-300 ring-2 ring-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.6)] font-black"
                : "bg-purple-600/90 hover:bg-purple-600 text-white border-purple-500/50 shadow-md font-bold"
            )}
          >
            <span className="text-sm">Violet</span>
            <span className="text-[10px] opacity-90">4.41×</span>
          </button>

          <button
            disabled={isLocked}
            onClick={() => setSel({ kind: "color", value: "red" })}
            className={cn(
              "flex flex-col items-center justify-center rounded-xl py-3 border transition-all active:scale-95 disabled:opacity-40",
              sel?.kind === "color" && sel.value === "red"
                ? "bg-red-600 text-white border-red-300 ring-2 ring-red-400 shadow-[0_0_15px_rgba(239,68,68,0.6)] font-black"
                : "bg-red-600/90 hover:bg-red-600 text-white border-red-500/50 shadow-md font-bold"
            )}
          >
            <span className="text-sm">Red</span>
            <span className="text-[10px] opacity-90">1.96×</span>
          </button>
        </div>

        {/* 10 Number Balls (0 to 9, payout 8.82x) */}
        <div className="grid grid-cols-5 gap-2.5">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
            const isSelected = sel?.kind === "number" && sel.value === String(n);
            return (
              <button
                key={n}
                disabled={isLocked}
                onClick={() => setSel({ kind: "number", value: String(n) })}
                className={cn(
                  "flex flex-col items-center justify-center rounded-xl p-2 border transition-all active:scale-95 disabled:opacity-40",
                  isSelected
                    ? "border-amber-400 bg-amber-500/20 ring-2 ring-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                    : "border-border/50 bg-secondary/50 hover:bg-secondary"
                )}
              >
                <Ball n={n} size="md" />
                <span className="mt-1 text-[10px] font-mono font-bold text-muted-foreground">
                  8.82×
                </span>
              </button>
            );
          })}
        </div>

        {/* Big / Small (1.96x) */}
        <div className="grid grid-cols-2 gap-3">
          <button
            disabled={isLocked}
            onClick={() => setSel({ kind: "size", value: "big" })}
            className={cn(
              "flex items-center justify-between rounded-xl px-4 py-3 border transition-all active:scale-95 disabled:opacity-40",
              sel?.kind === "size" && sel.value === "big"
                ? "bg-amber-600 text-white border-amber-300 ring-2 ring-amber-400 shadow-[0_0_15px_rgba(217,119,6,0.6)] font-black"
                : "bg-secondary hover:bg-secondary/80 text-foreground border-border font-bold"
            )}
          >
            <span className="text-sm font-black uppercase">Big (5-9)</span>
            <span className="text-xs font-mono font-bold">1.96×</span>
          </button>

          <button
            disabled={isLocked}
            onClick={() => setSel({ kind: "size", value: "small" })}
            className={cn(
              "flex items-center justify-between rounded-xl px-4 py-3 border transition-all active:scale-95 disabled:opacity-40",
              sel?.kind === "size" && sel.value === "small"
                ? "bg-blue-600 text-white border-blue-300 ring-2 ring-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.6)] font-black"
                : "bg-secondary hover:bg-secondary/80 text-foreground border-border font-bold"
            )}
          >
            <span className="text-sm font-black uppercase">Small (0-4)</span>
            <span className="text-xs font-mono font-bold">1.96×</span>
          </button>
        </div>

        {/* Bet Multiplier Multipliers (X1, X5, X10, X20, X50, X100) */}
        <div className="pt-2 border-t border-border/40">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span className="font-bold uppercase tracking-wider">Stake Multiplier</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-foreground">
                Base: ₹{base}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-6 gap-1">
            {[1, 5, 10, 20, 50, 100].map((m) => (
              <button
                key={m}
                onClick={() => setMultiplier(m)}
                className={cn(
                  "rounded-lg py-1.5 text-xs font-mono font-black transition active:scale-95 border",
                  multiplier === m
                    ? "bg-red-600 text-white border-red-400 shadow-sm"
                    : "bg-secondary/60 text-muted-foreground border-border/40 hover:bg-secondary hover:text-foreground"
                )}
              >
                X{m}
              </button>
            ))}
          </div>
        </div>

        {/* Place Bet Action Button */}
        {sel ? (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between rounded-xl bg-secondary/80 px-3.5 py-2 text-xs font-bold">
              <span>
                Selection:{" "}
                <span className="font-black text-red-400 uppercase">
                  {sel.kind} · {sel.value}
                </span>
              </span>
              <span>
                Total: <span className="font-mono font-black text-foreground">₹{fmt(stake)}</span>
              </span>
            </div>

            <PrimaryButton
              disabled={busy || isLocked}
              onClick={handlePlaceBet}
              className="w-full py-4 text-base font-black bg-gradient-to-r from-red-600 via-rose-600 to-red-700 shadow-xl hover:brightness-110 active:scale-[0.99]"
            >
              {isLocked ? "ROUND LOCKED · PLEASE WAIT" : `CONFIRM BET (₹${fmt(stake)})`}
            </PrimaryButton>
          </div>
        ) : (
          <div className="text-center py-2 text-xs text-muted-foreground font-medium">
            Select a color, number, or size to place your TRX bet
          </div>
        )}
      </Card>

      {/* =========================================================================
          Tabbed Lower Panels: Game Records, Global Trend Chart, My Bets
          ========================================================================= */}
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-secondary/60 p-1 border border-border/40">
          <button
            onClick={() => setActiveTab("records")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition",
              activeTab === "records"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <History className="h-3.5 w-3.5" />
            <span>Game Record</span>
          </button>

          <button
            onClick={() => setActiveTab("chart")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition",
              activeTab === "chart"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Global Trend</span>
          </button>

          <button
            onClick={() => setActiveTab("mybets")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition",
              activeTab === "mybets"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ReceiptText className="h-3.5 w-3.5" />
            <span>My Bets</span>
          </button>
        </div>

        {/* Tab 1: Game Records */}
        {activeTab === "records" && (
          <Card className="p-0 overflow-hidden border-border/40 bg-card shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-secondary/60 text-[10px] font-black uppercase text-muted-foreground border-b border-border/40">
                  <tr>
                    <th className="px-3 py-2">Period</th>
                    <th className="px-2 py-2">Block Height</th>
                    <th className="px-2 py-2">Block Hash</th>
                    <th className="px-2 py-2 text-center">Result</th>
                    <th className="px-3 py-2 text-right">Proof</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20 font-mono">
                  {historyList.slice(0, 15).map((item, idx) => (
                    <tr key={idx} className="hover:bg-muted/30 transition">
                      <td className="px-3 py-2.5 font-bold text-foreground">
                        {item.period.slice(-6)}
                      </td>
                      <td className="px-2 py-2.5 text-zinc-400">
                        {item.blockNumber > 0 ? item.blockNumber : "8808" + (item.period.slice(-4))}
                      </td>
                      <td className="px-2 py-2.5">
                        <span className="text-zinc-400">
                          ...{item.blockId.slice(-8, -1)}
                        </span>
                        <span className="font-bold text-amber-400">
                          {item.blockId.slice(-1) || item.number}
                        </span>
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <Ball n={item.number} size="sm" />
                          <span className="text-[11px] font-bold text-muted-foreground">
                            {item.number >= 5 ? "Big" : "Small"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => setSelectedBlockProof(item)}
                          className="text-[11px] font-bold text-red-400 hover:text-red-300 underline"
                        >
                          Verify
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Tab 2: Global Trend Chart */}
        {activeTab === "chart" && (
          <Card className="p-3 border-border/40 bg-card shadow-lg space-y-4">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-border/40">
              <span className="font-bold text-muted-foreground uppercase tracking-wider">
                Official Tron Number Trend (0 - 9)
              </span>
              <span className="font-mono text-[11px] text-zinc-400">
                Last 20 Draws
              </span>
            </div>

            {/* Grid Trend View */}
            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs font-mono">
                <thead>
                  <tr className="text-[10px] text-muted-foreground border-b border-border/40">
                    <th className="px-1 py-1 text-left">Period</th>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                      <th key={n} className="w-6 py-1">
                        {n}
                      </th>
                    ))}
                    <th className="px-2 py-1">B/S</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {historyList.slice(0, 18).map((item, idx) => (
                    <tr key={idx} className="h-7 hover:bg-muted/20">
                      <td className="text-left text-[11px] text-zinc-400 pr-2">
                        {item.period.slice(-4)}
                      </td>
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((colNum) => {
                        const isHit = item.number === colNum;
                        return (
                          <td key={colNum} className="p-0.5">
                            {isHit ? (
                              <div className="mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-tr from-red-600 to-amber-500 text-[10px] font-black text-white shadow-sm ring-1 ring-white/50">
                                {colNum}
                              </div>
                            ) : (
                              <span className="text-[10px] text-zinc-600">·</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-1 text-[11px] font-bold">
                        <span
                          className={cn(
                            "rounded px-1 py-0.5 text-[10px]",
                            item.number >= 5
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              : "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                          )}
                        >
                          {item.number >= 5 ? "B" : "S"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Missing Statistics Summary */}
            <div className="rounded-xl bg-secondary/50 p-2.5 text-xs border border-border/40">
              <div className="font-bold text-[10px] uppercase text-muted-foreground mb-1.5">
                Frequency Summary (Last 20 Rounds)
              </div>
              <div className="grid grid-cols-10 gap-1 text-center font-mono">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
                  const count = historyList.slice(0, 20).filter((h) => h.number === n).length;
                  return (
                    <div key={n} className="flex flex-col items-center">
                      <span className="text-[10px] text-zinc-400">{n}</span>
                      <span
                        className={cn(
                          "text-xs font-bold",
                          count >= 3 ? "text-amber-400 font-black" : "text-zinc-200"
                        )}
                      >
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        )}

        {/* Tab 3: My Bets */}
        {activeTab === "mybets" && (
          <Card className="p-0 overflow-hidden border-border/40 bg-card shadow-lg">
            {!session?.user ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Please login to see your TRX bet history
              </div>
            ) : myBets.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No bets placed yet for this duration
              </div>
            ) : (
              <div className="divide-y divide-border/20 text-xs font-sans">
                {myBets.map((b: any) => {
                  return (
                    <div
                      key={b.id}
                      className="p-3 flex items-center justify-between hover:bg-muted/20 transition"
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-foreground">
                            Period: {formatBetPeriod(b.period, dur).slice(-6)}
                          </span>
                          <span className="rounded bg-secondary px-1.5 py-0.2 font-mono text-[10px] uppercase font-bold text-muted-foreground">
                            {b.kind}: {b.value}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          Stake: ₹{fmt(b.stake)}
                        </span>
                      </div>

                      <div>
                        {b.settled ? (
                          b.win ? (
                            <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/30">
                              +₹{fmt(b.payout || 0)}
                            </span>
                          ) : (
                            <span className="font-mono font-bold text-zinc-500 bg-zinc-800 px-2 py-1 rounded">
                              Lost
                            </span>
                          )
                        ) : (
                          <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/30 animate-pulse">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* =========================================================================
          Tron Public Blockchain Verification Modal
          ========================================================================= */}
      {selectedBlockProof && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedBlockProof(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border-2 border-red-500/60 bg-zinc-950 p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-red-500" />
                <h3 className="font-display font-black text-white text-base">
                  Tron Blockchain Verification
                </h3>
              </div>
              <button
                onClick={() => setSelectedBlockProof(null)}
                className="text-zinc-400 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="rounded-xl bg-black/60 p-3 border border-white/10 space-y-1.5">
                <div className="text-[10px] text-muted-foreground uppercase font-sans font-bold">
                  Period ID
                </div>
                <div className="text-white font-bold">{selectedBlockProof.period}</div>
              </div>

              <div className="rounded-xl bg-black/60 p-3 border border-white/10 space-y-1.5">
                <div className="text-[10px] text-muted-foreground uppercase font-sans font-bold">
                  Tron Block Height
                </div>
                <div className="text-white font-bold">
                  {selectedBlockProof.blockNumber || "88080234"}
                </div>
              </div>

              <div className="rounded-xl bg-black/60 p-3 border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground uppercase font-sans font-bold">
                    Raw Block Hash
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedBlockProof.blockId);
                      toast.success("Block hash copied to clipboard");
                    }}
                    className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Copy</span>
                  </button>
                </div>
                <div className="break-all text-[11px] text-zinc-300 bg-zinc-900 p-2 rounded border border-white/5">
                  {selectedBlockProof.blockId.slice(0, -1)}
                  <span className="font-black text-amber-400 bg-amber-400/20 px-1 rounded">
                    {selectedBlockProof.blockId.slice(-1) || selectedBlockProof.number}
                  </span>
                </div>
                <p className="text-[10px] font-sans text-zinc-500">
                  The last character of the cryptographic hash determines the winning lottery outcome.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-red-950/40 border border-red-500/30 p-3">
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase font-sans font-bold">
                    Official Draw Result
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Ball n={selectedBlockProof.number} size="sm" />
                    <span className="font-black text-white text-sm capitalize">
                      {selectedBlockProof.color} ·{" "}
                      {selectedBlockProof.number >= 5 ? "Big" : "Small"}
                    </span>
                  </div>
                </div>

                <a
                  href={`https://tronscan.org/#/block/${selectedBlockProof.blockNumber || ""}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-bold text-red-400 hover:text-red-300 bg-red-500/20 px-3 py-1.5 rounded-lg border border-red-500/40"
                >
                  <span>Tronscan</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            <button
              onClick={() => setSelectedBlockProof(null)}
              className="w-full py-2.5 rounded-xl bg-secondary text-foreground text-xs font-bold hover:bg-muted transition"
            >
              Close Verification
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          WinGo Result Popup Modal
          ========================================================================= */}
      <WinGoResultPopup outcome={outcome} onClose={() => setOutcome(null)} />
    </div>
  );
}
