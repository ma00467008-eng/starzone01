import { useEffect, useState, type ReactNode } from "react";
import { Loader2, Minus, Plus, X } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { beep, fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";

/** Dark casino surface used by every game. */
export function Stage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("relative overflow-hidden rounded-2xl border border-casino-line bg-casino text-night-foreground shadow-card", className)}>{children}</div>;
}
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-casino-line bg-casino-panel p-3 text-night-foreground", className)}>{children}</div>;
}

const CHIPS = [10, 50, 100, 500, 1000, 5000];
const chipTone = ["bg-primary", "bg-game-green", "bg-game-red", "bg-game-violet", "bg-gold text-night", "bg-orange"];
export const chipLabel = (v: number) => (v >= 1000 ? `${v / 1000}K` : String(v));

export function Chip({ v, active, onClick, i = 0, small }: { v: number; active?: boolean; onClick?: () => void; i?: number; small?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn("relative grid shrink-0 place-items-center rounded-full font-display font-extrabold text-primary-foreground shadow-card ring-2 ring-offset-2 ring-offset-casino-panel transition active:scale-90", small ? "h-9 w-9 text-[10px]" : "h-11 w-11 text-xs", chipTone[i % chipTone.length], active ? "ring-gold scale-110" : "ring-transparent")}>
      <span className="absolute inset-1 rounded-full border-2 border-dashed border-primary-foreground/50" />
      <span className="relative">{chipLabel(v)}</span>
    </button>
  );
}

/** Popzar-style amount selector: chips + adjust row + quick multipliers. */
export function BetAmount({ value, onChange, min, max, disabled, label }: { value: number; onChange: (n: number) => void; min: number; max: number; disabled?: boolean; label?: string }) {
  const { t, profile } = useApp();
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.floor(n) || min));
  const set = (n: number) => { beep("chip"); onChange(clamp(n)); };
  return (
    <div className={cn("space-y-2.5", disabled && "pointer-events-none opacity-60")}>
      <div className="flex items-center justify-between text-[11px] text-casino-muted">
        <span>{label ?? t("game.stake")}</span><span>{fmt(min)} – {fmt(max)}</span>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => set(value - min)} className="grid h-10 w-10 place-items-center rounded-lg bg-casino-line" aria-label="Decrease"><Minus className="h-4 w-4" /></button>
        <input type="number" inputMode="numeric" value={value} onChange={(e) => onChange(Number(e.target.value))} onBlur={() => onChange(clamp(value))} aria-label={t("game.stake")} className="h-10 min-w-0 flex-1 rounded-lg border border-casino-line bg-casino px-3 text-center font-display text-lg font-bold tabular-nums text-gold outline-none" />
        <button type="button" onClick={() => set(value + min)} className="grid h-10 w-10 place-items-center rounded-lg bg-casino-line" aria-label="Increase"><Plus className="h-4 w-4" /></button>
      </div>
      <div className="no-scrollbar flex justify-between gap-2 overflow-x-auto px-1 py-1">
        {CHIPS.map((c, i) => <Chip key={c} v={c} i={i} small active={value === c} onClick={() => set(c)} />)}
      </div>
      <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
        <button type="button" onClick={() => set(min)} className="rounded-md bg-casino-line py-1.5">Min</button>
        <button type="button" onClick={() => set(value / 2)} className="rounded-md bg-casino-line py-1.5">½</button>
        <button type="button" onClick={() => set(value * 2)} className="rounded-md bg-casino-line py-1.5">2×</button>
        <button type="button" onClick={() => set(Math.min(max, profile?.balance ?? max))} className="rounded-md bg-casino-line py-1.5">Max</button>
      </div>
    </div>
  );
}

export function ActionButton({ children, onClick, disabled, loading, tone = "bet", className, sub }: { children: ReactNode; onClick?: () => void; disabled?: boolean; loading?: boolean; tone?: "bet" | "cash" | "stop"; className?: string; sub?: ReactNode }) {
  const bg = { bet: "bg-gradient-bet", cash: "bg-gradient-cash", stop: "bg-game-red" }[tone];
  return (
    <button type="button" onClick={onClick} disabled={disabled || loading} className={cn("flex min-h-14 w-full flex-col items-center justify-center rounded-xl font-display font-extrabold uppercase tracking-wide text-primary-foreground shadow-card transition active:scale-[0.98] disabled:opacity-50", bg, className)}>
      <span className="flex items-center gap-2 text-base">{loading && <Loader2 className="h-4 w-4 animate-spin" />}{children}</span>
      {sub && <span className="text-xs font-semibold normal-case opacity-90">{sub}</span>}
    </button>
  );
}

export type Outcome = { win: boolean; amount: number; stake?: number; multiplier?: number | null; round?: string; detail?: ReactNode; title?: string };

/** Full-screen win / loss popup (auto closes after 3 s). */
export function ResultPopup({ outcome, onClose }: { outcome: Outcome | null; onClose: () => void }) {
  const { t } = useApp();
  const [left, setLeft] = useState(3);
  useEffect(() => {
    if (!outcome) return;
    setLeft(3);
    const big = outcome.win && (outcome.multiplier ?? 0) >= 10;
    beep(outcome.win ? (big ? "bigwin" : "win") : "lose");
    const i = setInterval(() => setLeft((l) => { if (l <= 1) { clearInterval(i); onClose(); return 0; } return l - 1; }), 1000);
    return () => clearInterval(i);
  }, [outcome]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!outcome) return null;
  const w = outcome.win;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-night/70 p-6 backdrop-blur-sm" onClick={onClose}>
      {w && Array.from({ length: 18 }, (_, i) => (
        <span key={i} className="animate-coin-fall pointer-events-none absolute top-0 grid h-6 w-6 place-items-center rounded-full bg-gold text-[10px] font-black text-night" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 6) * 0.15}s` }}>★</span>
      ))}
      <div onClick={(e) => e.stopPropagation()} className={cn("animate-pop relative w-full max-w-xs overflow-hidden rounded-3xl text-center shadow-glow", w ? "bg-gradient-win text-night" : "bg-gradient-lose text-night-foreground")}>
        {w && <div className="animate-rays pointer-events-none absolute -inset-20 opacity-25" style={{ background: "repeating-conic-gradient(var(--card) 0 10deg, transparent 10deg 20deg)" }} />}
        <button onClick={onClose} className="absolute right-3 top-3 z-10 grid h-7 w-7 place-items-center rounded-full bg-night/20" aria-label="Close"><X className="h-4 w-4" /></button>
        <div className="relative px-6 pb-6 pt-8">
          <div className="mx-auto mb-3 grid h-20 w-20 place-items-center rounded-full bg-card/30 text-5xl">{w ? "🏆" : "😔"}</div>
          <div className="font-display text-2xl font-black uppercase tracking-wide">{outcome.title ?? (w ? t("game.congrats") : t("game.sorry"))}</div>
          {outcome.detail && <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-xs font-bold">{outcome.detail}</div>}
          <div className="mt-4 rounded-2xl bg-card/90 px-4 py-3 text-foreground">
            <div className="text-xs text-muted-foreground">{w ? t("game.bonus") : t("game.lost")}</div>
            <div className={cn("font-display text-3xl font-black tabular-nums", w ? "text-success" : "text-destructive")}>{w ? "+" : "-"}{fmt(w ? outcome.amount : (outcome.stake ?? outcome.amount))}</div>
            {!!outcome.multiplier && <div className="text-xs font-semibold text-muted-foreground">× {Number(outcome.multiplier).toFixed(2)}</div>}
          </div>
          {outcome.round && <div className="mt-3 font-mono text-[11px] opacity-80">{t("game.round")}: {outcome.round}</div>}
          <div className="mt-2 text-[11px] opacity-75">{left}s {t("game.auto_close")}</div>
        </div>
      </div>
    </div>
  );
}

export function HistoryStrip({ items, render }: { items: number[]; render?: (v: number) => string }) {
  if (!items.length) return null;
  return (
    <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
      {items.map((p, i) => (
        <span key={i} className={cn("shrink-0 rounded-full px-2.5 py-1 font-mono text-[11px] font-bold", p >= 10 ? "bg-game-violet/25 text-game-violet" : p >= 2 ? "bg-game-green/20 text-game-green" : "bg-primary/20 text-primary")}>{render ? render(p) : `${p.toFixed(2)}x`}</span>
      ))}
    </div>
  );
}
