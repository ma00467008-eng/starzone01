import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Users, TrendingUp, Wallet, UserPlus, Coins, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { AppShell, Card, RequireLogin, Spinner, PrimaryButton } from "@/components/sz/shell";
import { CoinIcon } from "@/components/sz/bits";

export const Route = createFileRoute("/earn")({
  head: () => ({ meta: [
    { title: "Invite & Earn — STAR ZONE" },
    { name: "description", content: "Invite friends to STAR ZONE and earn virtual coin commission across 6 team levels." },
    { property: "og:title", content: "Invite & Earn — STAR ZONE" },
    { property: "og:description", content: "Invite friends and earn virtual coin commission across 6 team levels." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: EarnPage,
});

type Lvl = { level: number; rate: number; members: number; new_today: number; deposit_users: number; deposit_amount: number; bet_amount: number; bet_today: number; users: { uid: string; joined: string; deposit: number; bet: number }[] };
type Earn = { code: string; total_commission: number; claimable: number; claimed: number; today_commission: number; yesterday_commission: number; levels: Lvl[] };

function EarnPage() {
  const { t } = useApp();
  return <AppShell title={`STAR ZONE · ${t("earn.title")}`} back="/account"><RequireLogin><EarnBody /></RequireLogin></AppShell>;
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
  const copy = (v: string) => { navigator.clipboard.writeText(v); toast.success(t("earn.copied")); };
  const sum = (k: keyof Lvl) => data.levels.reduce((a, l) => a + Number(l[k] ?? 0), 0);
  const cur = data.levels.find((l) => l.level === lvl)!;

  const claim = async () => {
    setBusy(true);
    const { data: r, error } = await supabase.rpc("claim_commission" as never);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const res = r as unknown as { amount: number; balance: number };
    setBalance(res.balance);
    toast.success(`+${fmt(res.amount)}`);
    qc.invalidateQueries({ queryKey: ["earn"] });
  };

  return (
    <div className="space-y-4 pb-4">
      <div className="overflow-hidden rounded-2xl bg-gradient-hero p-5 text-primary-foreground shadow-glow">
        <div className="text-xs font-semibold uppercase tracking-wider opacity-80">STAR ZONE · {t("earn.total")}</div>
        <div className="mt-1 flex items-center gap-2 font-display text-3xl font-extrabold tabular-nums"><CoinIcon className="h-7 w-7" />{fmt(data.total_commission)}</div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl bg-primary-foreground/15 p-3"><div className="text-[11px] opacity-80">{t("earn.today")}</div><div className="font-display text-lg font-bold tabular-nums">{fmt(data.today_commission)}</div></div>
          <div className="rounded-xl bg-primary-foreground/15 p-3"><div className="text-[11px] opacity-80">{t("earn.yesterday")}</div><div className="font-display text-lg font-bold tabular-nums">{fmt(Math.max(0, data.yesterday_commission))}</div></div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-card p-3 text-foreground">
          <div><div className="text-[11px] text-muted-foreground">{t("earn.claimable")}</div><div className="font-display text-lg font-bold tabular-nums text-primary-deep">{fmt(data.claimable)}</div></div>
          <PrimaryButton className="h-10 w-auto px-5 text-sm" loading={busy} disabled={data.claimable <= 0} onClick={claim}>{t("earn.claim")}</PrimaryButton>
        </div>
      </div>

      <Card>
        <div className="text-xs text-muted-foreground">{t("earn.my_code")}</div>
        <div className="mt-1 flex items-center justify-between">
          <span className="font-mono text-2xl font-extrabold tracking-[0.2em] text-primary-deep">{data.code}</span>
          <button onClick={() => copy(data.code)} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-primary-deep"><Copy className="h-3.5 w-3.5" />{t("earn.copy")}</button>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">{t("earn.link")}</div>
        <div className="mt-1 flex items-center gap-2 rounded-xl border border-input bg-background p-2">
          <span className="flex-1 truncate font-mono text-xs">{link}</span>
          <button onClick={() => copy(link)} className="rounded-lg bg-gradient-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">{t("earn.copy")}</button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Stat icon={Users} label={t("earn.team")} value={fmt(sum("members"))} />
        <Stat icon={UserPlus} label={t("earn.new_today")} value={fmt(sum("new_today"))} />
        <Stat icon={Wallet} label={t("earn.deposit_users")} value={fmt(sum("deposit_users"))} />
        <Stat icon={Coins} label={t("earn.deposit_amount")} value={fmt(sum("deposit_amount"))} />
        <Stat icon={TrendingUp} label={t("earn.bet_amount")} value={fmt(sum("bet_amount"))} />
        <Stat icon={TrendingUp} label={t("earn.bet_today")} value={fmt(sum("bet_today"))} />
      </div>

      <Card className="p-0">
        <div className="flex gap-1 overflow-x-auto border-b border-border p-2">
          {data.levels.map((l) => (
            <button key={l.level} onClick={() => setLvl(l.level)} className={cn("shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition", lvl === l.level ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-secondary text-primary-deep")}>
              {t("earn.level")} {l.level}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 p-3 text-center text-[11px]">
          <Mini label={t("earn.rate")} value={`${(cur.rate * 100).toFixed(cur.rate < 0.001 ? 4 : 2)}%`} />
          <Mini label={t("earn.members")} value={fmt(cur.members)} />
          <Mini label={t("earn.deposit_users")} value={fmt(cur.deposit_users)} />
          <Mini label={t("earn.deposit_amount")} value={fmt(cur.deposit_amount)} />
          <Mini label={t("earn.bet_amount")} value={fmt(cur.bet_amount)} />
          <Mini label={t("earn.bet_today")} value={fmt(cur.bet_today)} />
        </div>
        <div className="border-t border-border">
          <div className="grid grid-cols-4 bg-secondary/60 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
            <span>{t("earn.uid")}</span><span className="text-right">{t("earn.deposit_amount")}</span><span className="text-right">{t("earn.bet_amount")}</span><span className="text-right">{t("earn.joined")}</span>
          </div>
          {!cur.users.length ? <p className="py-8 text-center text-xs text-muted-foreground">{t("common.empty")}</p> : (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto text-xs">
              {cur.users.map((u) => (
                <li key={u.uid} className="grid grid-cols-4 items-center px-3 py-2.5">
                  <span className="font-mono font-semibold">{u.uid}</span>
                  <span className="text-right tabular-nums">{fmt(u.deposit)}</span>
                  <span className="text-right tabular-nums">{fmt(u.bet)}</span>
                  <span className="text-right text-muted-foreground">{new Date(u.joined).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card>
        <h3 className="mb-2 flex items-center gap-2 font-display text-sm font-bold"><Info className="h-4 w-4 text-primary" />{t("earn.rules")}</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">{t("earn.rules_body")}</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
          {data.levels.map((l) => <Mini key={l.level} label={`${t("earn.level")} ${l.level}`} value={`${(l.rate * 100).toFixed(l.rate < 0.001 ? 4 : 2)}%`} />)}
        </div>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card p-3 shadow-card">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Icon className="h-3.5 w-3.5 text-primary" />{label}</div>
      <div className="mt-1 font-display text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-secondary/60 p-2"><div className="text-muted-foreground">{label}</div><div className="font-bold tabular-nums text-foreground">{value}</div></div>;
}
