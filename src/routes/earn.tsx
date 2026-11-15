import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { 
  Copy, Users, TrendingUp, Wallet, UserPlus, Coins, 
  Share2, Award, Sparkles 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { AppShell, Card, RequireLogin, Spinner, PrimaryButton } from "@/components/sz/shell";
import { CoinIcon } from "@/components/sz/bits";

export const Route = createFileRoute("/earn")({
  head: () => ({ meta: [
    { title: "Invite & Earn — STAR ZONE" },
    { name: "description", content: "Invite friends to STAR ZONE and earn virtual coin agency commission." },
    { property: "og:title", content: "Invite & Earn — STAR ZONE" },
    { property: "og:description", content: "Invite friends and earn virtual coin agency commission." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: EarnPage,
});

type Lvl = { 
  level: number; 
  rate: number; 
  members: number; 
  new_today: number; 
  deposit_users: number; 
  deposit_amount: number; 
  bet_amount: number; 
  bet_today: number; 
  users: { uid: string; joined: string; deposit: number; bet: number }[] 
};

type Earn = { 
  code: string; 
  total_commission: number; 
  claimable: number; 
  claimed: number; 
  today_commission: number; 
  yesterday_commission: number; 
  levels: Lvl[] 
};

function EarnPage() {
  const { t } = useApp();
  return (
    <AppShell title={`STAR ZONE · ${t("earn.title")}`} back="/account">
      <RequireLogin>
        <EarnBody />
      </RequireLogin>
    </AppShell>
  );
}

function EarnBody() {
  const { t, setBalance } = useApp();
  const qc = useQueryClient();
  const [lvl, setLvl] = useState(1);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["earn"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_earn" as never);
      if (error) throw error;
      return data as unknown as Earn;
    },
  });

  if (isLoading || !data) return <Spinner />;

  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/auth?ref=${data.code}`;
  
  const copy = (v: string, msg?: string) => { 
    navigator.clipboard.writeText(v); 
    toast.success(msg ?? t("earn.copied")); 
  };

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Join STAR ZONE",
          text: `Use my invite code ${data.code} to join STAR ZONE and play free games!`,
          url: link,
        });
        return;
      } catch {
        // fallback
      }
    }
    copy(link, "Invitation link copied to clipboard!");
  };

  const sum = (k: keyof Lvl) => data.levels.reduce((a, l) => a + Number(l[k] ?? 0), 0);
  const cur = data.levels.find((l) => l.level === lvl) ?? data.levels[0];
  const directLevel = data.levels.find((l) => l.level === 1);

  const claim = async () => {
    setBusy(true);
    const { data: r, error } = await supabase.rpc("claim_commission" as never);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const res = r as unknown as { amount: number; balance: number };
    setBalance(res.balance);
    toast.success(`+${fmt(res.amount)} coins claimed!`);
    qc.invalidateQueries({ queryKey: ["earn"] });
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Popzar Style Hero Agent Card */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/20 via-primary/15 to-card p-5 text-foreground shadow-glow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-500">
              <Award className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-500">
              Agent Promotion Hub
            </span>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-500">
            Active Rebate
          </span>
        </div>

        <div className="mt-4">
          <div className="text-xs text-muted-foreground">{t("earn.total")}</div>
          <div className="mt-1 flex items-center gap-2 font-display text-3xl font-extrabold tabular-nums text-foreground">
            <CoinIcon className="h-7 w-7" />
            {fmt(data.total_commission)}
          </div>
        </div>

        {/* Yesterday & Today Cards */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-border/50 bg-background/60 p-3 backdrop-blur-sm">
            <div className="text-[11px] font-medium text-muted-foreground">{t("earn.today")}</div>
            <div className="mt-0.5 font-display text-lg font-bold tabular-nums text-primary-deep">
              +{fmt(data.today_commission)}
            </div>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/60 p-3 backdrop-blur-sm">
            <div className="text-[11px] font-medium text-muted-foreground">{t("earn.yesterday")}</div>
            <div className="mt-0.5 font-display text-lg font-bold tabular-nums text-amber-500">
              +{fmt(Math.max(0, data.yesterday_commission))}
            </div>
          </div>
        </div>

        {/* Claim Box */}
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-background/90 p-3 shadow-sm">
          <div>
            <div className="text-[11px] font-medium text-muted-foreground">{t("earn.claimable")}</div>
            <div className="font-display text-lg font-bold tabular-nums text-primary-deep">
              {fmt(data.claimable)}
            </div>
          </div>
          <PrimaryButton
            className="h-10 w-auto px-6 text-sm font-bold shadow-glow"
            loading={busy}
            disabled={data.claimable <= 0}
            onClick={claim}
          >
            {t("earn.claim")}
          </PrimaryButton>
        </div>
      </div>

      {/* Popzar Style Invitation Bar */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-muted-foreground">{t("earn.my_code")}</div>
          <span className="text-[11px] text-primary font-bold">Quick Invite</span>
        </div>
        
        <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3 py-2">
          <span className="font-mono text-2xl font-black tracking-[0.2em] text-primary-deep">
            {data.code}
          </span>
          <button
            onClick={() => copy(data.code)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm transition active:scale-95"
          >
            <Copy className="h-3.5 w-3.5" />
            {t("earn.copy")}
          </button>
        </div>

        {/* Big Popzar Share Button */}
        <button
          onClick={handleShare}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary font-display text-sm font-extrabold text-primary-foreground shadow-glow transition active:scale-[0.98]"
        >
          <Share2 className="h-4 w-4" />
          INVITE FRIENDS NOW
        </button>

        <div className="flex items-center gap-2 rounded-xl border border-input bg-background p-1.5 text-xs">
          <span className="flex-1 truncate font-mono px-2 text-[11px] text-muted-foreground">
            {link}
          </span>
          <button
            onClick={() => copy(link)}
            className="rounded-lg bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground hover:bg-secondary/80"
          >
            {t("earn.copy")}
          </button>
        </div>
      </Card>

      {/* Popzar Promotion Dashboard */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-display text-sm font-bold text-foreground">Promotion Overview</h2>
          <span className="text-[11px] text-muted-foreground">Real-time stats</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <PopStat
            icon={Users}
            label={t("earn.direct")}
            value={fmt(directLevel?.members ?? 0)}
            subtitle="Tier 1 members"
          />
          <PopStat
            icon={Users}
            label={t("earn.team")}
            value={fmt(sum("members"))}
            subtitle="All subordinates"
          />
          <PopStat
            icon={UserPlus}
            label={t("earn.new_today")}
            value={fmt(sum("new_today"))}
            subtitle="Joined today"
          />
          <PopStat
            icon={Wallet}
            label={t("earn.deposit_users")}
            value={fmt(sum("deposit_users"))}
            subtitle="Active recharges"
          />
          <PopStat
            icon={Coins}
            label={t("earn.deposit_amount")}
            value={fmt(sum("deposit_amount"))}
            subtitle="Total recharge volume"
          />
          <PopStat
            icon={TrendingUp}
            label={t("earn.bet_amount")}
            value={fmt(sum("bet_amount"))}
            subtitle="Total team turnover"
          />
        </div>
      </div>

      {/* Popzar Subordinate Level Breakdown */}
      <Card className="p-0 overflow-hidden">
        <div className="border-b border-border bg-secondary/30 px-3 py-2.5">
          <div className="text-xs font-bold text-foreground">Subordinate Tier Data</div>
          <div className="text-[10px] text-muted-foreground">View performance by team depth</div>
        </div>

        {/* Level Tabs */}
        <div className="flex gap-1.5 overflow-x-auto p-2.5">
          {data.levels.map((l) => (
            <button
              key={l.level}
              onClick={() => setLvl(l.level)}
              className={cn(
                "shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition",
                lvl === l.level
                  ? "bg-gradient-primary text-primary-foreground shadow-glow"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              {t("earn.level")} {l.level}
              {l.level === 1 && " (Direct)"}
            </button>
          ))}
        </div>

        {/* Selected Tier Stats Grid */}
        <div className="grid grid-cols-3 gap-2 border-t border-border bg-card p-3 text-center text-[11px]">
          <MiniBox label={t("earn.members")} value={fmt(cur.members)} />
          <MiniBox label={t("earn.deposit_users")} value={fmt(cur.deposit_users)} />
          <MiniBox label={t("earn.deposit_amount")} value={fmt(cur.deposit_amount)} />
          <MiniBox label={t("earn.bet_amount")} value={fmt(cur.bet_amount)} />
          <MiniBox label={t("earn.bet_today")} value={fmt(cur.bet_today)} />
          <MiniBox label="New Today" value={fmt(cur.new_today)} />
        </div>

        {/* Subordinate User Records Table */}
        <div className="border-t border-border">
          <div className="grid grid-cols-4 bg-secondary/60 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <span>{t("earn.uid")}</span>
            <span className="text-right">{t("earn.deposit_amount")}</span>
            <span className="text-right">{t("earn.bet_amount")}</span>
            <span className="text-right">{t("earn.joined")}</span>
          </div>

          {!cur.users.length ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No members in Level {lvl} yet.
            </div>
          ) : (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto text-xs">
              {cur.users.map((u) => (
                <li key={u.uid} className="grid grid-cols-4 items-center px-3 py-2.5 hover:bg-secondary/20">
                  <span className="font-mono font-bold text-foreground">{u.uid}</span>
                  <span className="text-right font-medium tabular-nums text-foreground">{fmt(u.deposit)}</span>
                  <span className="text-right font-medium tabular-nums text-primary-deep">{fmt(u.bet)}</span>
                  <span className="text-right text-[11px] text-muted-foreground">
                    {new Date(u.joined).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* Popzar Agency Guide */}
      <Card className="space-y-2.5">
        <h3 className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Agent Rebate Program
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("earn.rules_body")}
        </p>

        <div className="mt-3 space-y-2 rounded-xl bg-secondary/40 p-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">1</span>
            <span className="text-muted-foreground">Share your exclusive invite link or code.</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">2</span>
            <span className="text-muted-foreground">Subordinates register and place bets in games.</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">3</span>
            <span className="text-muted-foreground">Automatic commission rebates settle daily and can be claimed anytime.</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function PopStat({ 
  icon: Icon, 
  label, 
  value, 
  subtitle 
}: { 
  icon: typeof Users; 
  label: string; 
  value: string; 
  subtitle: string; 
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3 shadow-card transition">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-[11px] font-medium">{label}</span>
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="mt-1 font-display text-lg font-extrabold tabular-nums text-foreground">
        {value}
      </div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{subtitle}</div>
    </div>
  );
}

function MiniBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/50 p-2">
      <div className="text-[10px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-bold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
