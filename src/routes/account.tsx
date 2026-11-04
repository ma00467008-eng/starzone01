import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronRight, Gamepad2, BarChart3, Shield, LifeBuoy, Gift, Languages, Settings, Receipt, LogOut, Crown, Copy, PlusCircle, MinusCircle, Users } from "lucide-react";
import { toast } from "sonner";
import { signOut, useApp } from "@/lib/app-context";
import { AppShell, RequireLogin } from "@/components/sz/shell";
import { Avatar, Balance, useUnreadNotifications } from "@/components/sz/bits";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [
    { title: "My Account — STAR ZONE" },
    { name: "description", content: "Your STAR ZONE profile, virtual coins, history and settings." },
    { property: "og:title", content: "My Account — STAR ZONE" },
    { property: "og:description", content: "Your STAR ZONE profile, virtual coins, history and settings." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AccountPage,
});

const MENU = [
  { s: "notifications", icon: Bell, k: "acc.notifications" },
  { s: "history", icon: Gamepad2, k: "acc.history" },
  { s: "stats", icon: BarChart3, k: "acc.stats" },
  { s: "transactions", icon: Receipt, k: "acc.transactions" },
  { s: "security", icon: Shield, k: "acc.security" },
  { s: "support", icon: LifeBuoy, k: "acc.support" },
  { s: "gift", icon: Gift, k: "acc.gift" },
  { s: "language", icon: Languages, k: "acc.language" },
  { s: "settings", icon: Settings, k: "acc.settings" },
] as const;

function AccountPage() {
  const { profile, t, isAdmin } = useApp();
  const { data: unread } = useUnreadNotifications();
  const qc = useQueryClient();
  const nav = useNavigate();
  return (
    <AppShell>
      <RequireLogin>
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-5 text-primary-foreground shadow-glow">
            <div className="flex items-center gap-4">
              <Avatar n={profile?.avatar} name={profile?.username} className="h-16 w-16 border-2 border-primary-foreground/60 text-2xl" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-lg font-bold">{profile?.username ?? "…"}</div>
                <button onClick={() => { navigator.clipboard?.writeText(profile?.uid ?? ""); toast.success("UID copied"); }} className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs">
                  {t("acc.uid")}: <b className="font-mono">{profile?.uid}</b><Copy className="h-3 w-3" />
                </button>
              </div>
              <Link to="/me/$section" params={{ section: "security" }} className="rounded-full bg-primary-foreground/20 px-3 py-1 text-xs font-semibold">{t("acc.edit")}</Link>
            </div>
            <div className="mt-5 flex items-end justify-between rounded-2xl bg-primary-foreground/15 p-4">
              <div><div className="text-xs opacity-85">{t("acc.balance")}</div><Balance className="text-2xl" /></div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link to="/add-coins" search={{ mode: "add" }} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-card px-4 py-2.5 text-sm font-bold text-primary-deep shadow-card"><PlusCircle className="h-4 w-4" />{t("home.add_coins")}</Link>
              <Link to="/add-coins" search={{ mode: "deduct" }} className="inline-flex items-center justify-center gap-1.5 rounded-full border border-primary-foreground/60 bg-primary-foreground/15 px-4 py-2.5 text-sm font-bold"><MinusCircle className="h-4 w-4" />Coin Deduction</Link>
            </div>
          </div>

          {isAdmin && (
            <Link to="/admin" className="flex items-center gap-3 rounded-2xl bg-night p-4 text-night-foreground shadow-card">
              <Crown className="h-5 w-5 text-gold" /><span className="flex-1 font-semibold">{t("acc.admin")}</span><ChevronRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          )}

          <Link to="/earn" className="flex items-center gap-3 rounded-2xl bg-gradient-primary p-4 text-primary-foreground shadow-glow">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-foreground/20"><Users className="h-5 w-5" /></span>
            <span className="flex-1 font-display font-bold">{t("acc.earn")}</span><ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Link>

          <div className="divide-y divide-border overflow-hidden rounded-2xl bg-card shadow-card">
            {MENU.map(({ s, icon: Icon, k }) => (
              <Link key={s} to="/me/$section" params={{ section: s }} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-secondary/50">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-primary-deep"><Icon className="h-4.5 w-4.5" /></span>
                <span className="flex-1 text-sm font-medium">{t(k)}</span>
                {s === "notifications" && !!unread && <span className="rounded-full bg-destructive px-2 text-[11px] font-bold text-destructive-foreground">{unread}</span>}
                <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
              </Link>
            ))}
          </div>

          <button onClick={async () => { await signOut(qc); nav({ to: "/auth" }); }} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-card py-3.5 text-sm font-semibold text-destructive shadow-card">
            <LogOut className="h-4 w-4" />{t("acc.logout")}
          </button>
        </div>
      </RequireLogin>
    </AppShell>
  );
}
