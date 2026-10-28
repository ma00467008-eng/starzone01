import { Link, useLocation } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Home, Gift, MessageCircle, User, Loader2, Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { CoinIcon, TopBar, PageHeader } from "./bits";

export function BottomNav() {
  const { pathname } = useLocation();
  const { t } = useApp();
  const items = [
    { to: "/", icon: Home, label: t("nav.home") },
    { to: "/promo", icon: Gift, label: t("nav.promo") },
    { to: "/chat", icon: MessageCircle, label: t("nav.chat") },
    { to: "/account", icon: User, label: t("nav.account") },
  ] as const;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <div className="mx-auto grid h-16 max-w-3xl grid-cols-4">
        {items.map(({ to, icon: Icon, label }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <Link key={to} to={to} className={cn("flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors", active ? "text-primary-deep" : "text-muted-foreground")}>
              <span className={cn("grid h-8 w-12 place-items-center rounded-full transition-all", active && "bg-secondary")}><Icon className="h-5 w-5" /></span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppShell({ children, title, back, nav = true }: { children: ReactNode; title?: string; back?: string; nav?: boolean }) {
  return (
    <div className={cn("min-h-screen", nav ? "pb-24" : "pb-8")}>
      {title ? <PageHeader title={title} {...(back ? { back } : {})} /> : <TopBar />}
      <main className="mx-auto max-w-3xl px-4 pt-4">{children}</main>
      {nav && <BottomNav />}
    </div>
  );
}

export function RequireLogin({ children }: { children: ReactNode }) {
  const { session, ready, t } = useApp();
  if (!ready) return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!session) return (
    <div className="rounded-2xl bg-card p-8 text-center shadow-card">
      <p className="mb-4 text-sm text-muted-foreground">{t("common.login_required")}</p>
      <Link to="/auth" className="inline-block rounded-full bg-gradient-primary px-6 py-2 text-sm font-semibold text-primary-foreground shadow-glow">{t("auth.login")}</Link>
    </div>
  );
  return <>{children}</>;
}

export function Spinner() {
  return <div className="grid place-items-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl bg-card p-4 shadow-card", className)}>{children}</div>;
}

export function StakeInput({ value, onChange, min, max, disabled }: { value: number; onChange: (n: number) => void; min: number; max: number; disabled?: boolean }) {
  const { t } = useApp();
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.floor(n) || min));
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs text-muted-foreground"><span>{t("game.stake")}</span><span>{fmt(min)} – {fmt(max)}</span></div>
      <div className="flex items-center gap-2">
        <button type="button" disabled={disabled} onClick={() => onChange(clamp(value / 2))} className="h-11 rounded-xl bg-secondary px-3 text-xs font-bold text-secondary-foreground disabled:opacity-50">½</button>
        <button type="button" disabled={disabled} onClick={() => onChange(clamp(value - 10))} className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-secondary-foreground disabled:opacity-50" aria-label="Decrease"><Minus className="h-4 w-4" /></button>
        <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-input bg-background px-3">
          <CoinIcon />
          <input type="number" inputMode="numeric" disabled={disabled} value={value} onChange={(e) => onChange(Number(e.target.value))} onBlur={() => onChange(clamp(value))} className="w-full bg-transparent font-display font-bold tabular-nums outline-none" aria-label={t("game.stake")} />
        </label>
        <button type="button" disabled={disabled} onClick={() => onChange(clamp(value + 10))} className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-secondary-foreground disabled:opacity-50" aria-label="Increase"><Plus className="h-4 w-4" /></button>
        <button type="button" disabled={disabled} onClick={() => onChange(clamp(value * 2))} className="h-11 rounded-xl bg-secondary px-3 text-xs font-bold text-secondary-foreground disabled:opacity-50">2×</button>
      </div>
    </div>
  );
}

export function PrimaryButton({ children, onClick, disabled, loading, className, variant = "primary" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; loading?: boolean; className?: string; variant?: "primary" | "success" | "danger" | "gold" }) {
  const v = { primary: "bg-gradient-primary text-primary-foreground shadow-glow", success: "bg-success text-success-foreground", danger: "bg-destructive text-destructive-foreground", gold: "bg-gold text-night" }[variant];
  return (
    <button type="button" onClick={onClick} disabled={disabled || loading} className={cn("flex h-12 w-full items-center justify-center gap-2 rounded-xl font-display text-base font-bold transition active:scale-[0.98] disabled:opacity-50", v, className)}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}{children}
    </button>
  );
}

export function useRounds(game: string) {
  const { session } = useApp();
  return useQuery({
    queryKey: ["rounds", game, session?.user.id],
    enabled: !!session,
    queryFn: async () => (await supabase.from("game_rounds").select("*").eq("game", game).order("created_at", { ascending: false }).limit(15)).data ?? [],
  });
}

export function RoundHistory({ game }: { game: string }) {
  const { t } = useApp();
  const { data } = useRounds(game);
  return (
    <Card>
      <h3 className="mb-2 font-display text-sm font-bold">{t("game.my_history")}</h3>
      {!data?.length ? <p className="py-4 text-center text-xs text-muted-foreground">{t("common.empty")}</p> : (
        <ul className="divide-y divide-border text-xs">
          {data.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <div><div className="font-mono text-[11px] text-muted-foreground">{r.round_code}</div><div>{new Date(r.created_at).toLocaleTimeString()}</div></div>
              <div className="text-right">
                <div className="tabular-nums">{t("game.stake")}: {fmt(r.stake)}</div>
                <div className={cn("font-bold tabular-nums", r.payout > 0 ? "text-success" : "text-destructive")}>{r.payout > 0 ? `+${fmt(r.payout)}` : `-${fmt(r.stake)}`}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function useAfterPlay(game: string) {
  const qc = useQueryClient();
  const { setBalance } = useApp();
  return (balance?: number | null) => {
    if (typeof balance === "number") setBalance(balance);
    qc.invalidateQueries({ queryKey: ["rounds", game] });
  };
}
