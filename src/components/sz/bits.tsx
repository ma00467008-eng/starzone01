import { Link } from "@tanstack/react-router";
import { Bell, Plus, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/lib/app-context";
import { fmt } from "@/lib/sound";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  const { settings } = useApp();
  const name: string = settings["site"]?.name || "STAR ZONE";
  const logo: string | undefined = settings["site"]?.logo_url;
  return (
    <Link to="/" className={cn("flex items-center gap-2", className)}>
      {logo ? <img src={logo} alt={name} className="h-8 w-8 rounded-lg object-cover" /> : (
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary shadow-glow">
          <Star className="h-4.5 w-4.5 fill-primary-foreground text-primary-foreground" />
        </span>
      )}
      <span className="font-display text-lg font-extrabold tracking-tight text-foreground">
        {name.split(" ")[0]}<span className="text-primary-deep"> {name.split(" ").slice(1).join(" ")}</span>
      </span>
    </Link>
  );
}

export function CoinIcon({ className }: { className?: string }) {
  return (
    <span className={cn("inline-grid h-4.5 w-4.5 place-items-center rounded-full bg-gold text-[9px] font-black text-night ring-2 ring-gold/30", className)}>★</span>
  );
}

export function Balance({ className }: { className?: string }) {
  const { profile } = useApp();
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-display font-bold tabular-nums", className)}>
      <CoinIcon />{fmt(profile?.balance)}
    </span>
  );
}

const HUES = [230, 210, 255, 195, 245, 220, 265, 200];
export function Avatar({ n, name, className }: { n?: number; name?: string; className?: string }) {
  return (
    <span className={cn("grid place-items-center rounded-full font-display font-bold text-primary-foreground", className)} style={{ background: `linear-gradient(135deg, oklch(0.8 0.12 ${HUES[((n ?? 1) - 1) % 8]}), oklch(0.5 0.15 ${(HUES[((n ?? 1) - 1) % 8] ?? 230) + 15}))` }}>
      {(name || "S").slice(0, 1).toUpperCase()}
    </span>
  );
}

export function useUnreadNotifications() {
  const { session } = useApp();
  return useQuery({
    queryKey: ["notif-unread", session?.user.id],
    enabled: !!session,
    refetchInterval: 30000,
    queryFn: async () => {
      const [{ data: n }, { data: r }] = await Promise.all([
        supabase.from("notifications").select("id").order("created_at", { ascending: false }).limit(100),
        supabase.from("notification_reads").select("notification_id"),
      ]);
      const read = new Set((r ?? []).map((x) => x.notification_id));
      return (n ?? []).filter((x) => !read.has(x.id)).length;
    },
  });
}

export function TopBar() {
  const { session, t } = useApp();
  const { data: unread } = useUnreadNotifications();
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-card/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Logo />
        {session ? (
          <div className="flex items-center gap-2">
            <Link to="/coins" className="flex items-center gap-1.5 rounded-full bg-secondary py-1 pl-3 pr-1 text-sm text-secondary-foreground">
              <Balance />
              <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-primary text-primary-foreground" aria-label={t("home.add_coins")}><Plus className="h-3.5 w-3.5" /></span>
            </Link>
            <Link to="/notifications" className="relative grid h-9 w-9 place-items-center rounded-full bg-secondary text-secondary-foreground" aria-label={t("acc.notifications")}>
              <Bell className="h-4.5 w-4.5" />
              {!!unread && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{unread > 9 ? "9+" : unread}</span>}
            </Link>
          </div>
        ) : (
          <Link to="/auth" className="rounded-full bg-gradient-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground shadow-glow">{t("auth.login")}</Link>
        )}
      </div>
    </header>
  );
}

export function PageHeader({ title, back = "/account" }: { title: string; back?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-card/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
        <Link to={back} className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-secondary-foreground" aria-label="Back">
          <span className="rtl:rotate-180">‹</span>
        </Link>
        <h1 className="font-display text-base font-bold">{title}</h1>
      </div>
    </header>
  );
}

export function Empty({ text }: { text?: string }) {
  const { t } = useApp();
  return <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">{text || t("common.empty")}</div>;
}

export function StatusPill({ s }: { s: string }) {
  const { t } = useApp();
  const c = s === "approved" || s === "open" ? "bg-success/10 text-success" : s === "rejected" || s === "closed" ? "bg-destructive/10 text-destructive" : "bg-gold/15 text-foreground";
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", c)}>{t(`status.${s}`)}</span>;
}
