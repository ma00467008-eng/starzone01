import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useApp } from "@/lib/app-context";
import { fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { AppShell, Card, PrimaryButton, RequireLogin } from "@/components/sz/shell";
import { CoinIcon, Empty, StatusPill } from "@/components/sz/bits";

export const Route = createFileRoute("/add-coins")({
  head: () => ({ meta: [
    { title: "Add Virtual Coins — STAR ZONE" },
    { name: "description", content: "Request free virtual coins for STAR ZONE games." },
    { property: "og:title", content: "Add Virtual Coins — STAR ZONE" },
    { property: "og:description", content: "Request free virtual coins for STAR ZONE games." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  validateSearch: (s: Record<string, unknown>): { mode: "add" | "deduct" } => ({ mode: s["mode"] === "deduct" ? "deduct" : "add" }),
  component: AddCoins,
});

function AddCoins() {
  const { t, settings, session, profile } = useApp();
  const cfg = settings["coins"] ?? {};
  const min = Number(cfg.min ?? 300), max = Number(cfg.max ?? 10000);
  const amounts: number[] = cfg.amounts ?? [300, 500, 1000, 2000, 5000, 10000];
  const { mode: initialMode } = Route.useSearch();
  const [mode, setMode] = useState<"add" | "deduct">(initialMode);
  const [amount, setAmount] = useState(amounts[0] ?? min);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const table = mode === "add" ? "coin_requests" : "coin_deductions";
  const { data: reqs } = useQuery({
    queryKey: ["coin-reqs", mode, session?.user.id], enabled: !!session,
    queryFn: async () => (await supabase.from(table).select("*").order("created_at", { ascending: false }).limit(30)).data ?? [],
  });
  const submit = async () => {
    if (!amount || amount < 1) { toast.error("Enter a valid amount"); return; }
    if (mode === "add" && (amount < min || amount > max)) { toast.error(`${fmt(min)} – ${fmt(max)}`); return; }
    if (note.trim().length < 3) { toast.error("Instructions are required"); return; }
    setBusy(true);
    const { error } = mode === "add"
      ? await supabase.rpc("submit_coin_request", { _amount: amount, _note: note })
      : await supabase.rpc("submit_coin_deduction", { _amount: amount, _note: note });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success(mode === "add" ? t("coins.sent") : "Deduction request sent"); setNote("");
    qc.invalidateQueries({ queryKey: ["coin-reqs"] });
  };
  return (
    <AppShell title={t("coins.title")} back="/account">
      <RequireLogin>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
            {(["add", "deduct"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={cn("rounded-lg py-2.5 font-display text-sm font-bold transition", mode === m ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground")}>
                {m === "add" ? "Add Coins" : "Coin Deduction"}
              </button>
            ))}
          </div>
          {mode === "add" && (cfg.instructions || cfg.image_url) && (
            <Card className="space-y-3">
              {cfg.instructions && <p className="whitespace-pre-line text-sm text-muted-foreground">{cfg.instructions}</p>}
              {cfg.image_url && <img src={cfg.image_url} alt="Instructions" className="w-full rounded-xl" />}
            </Card>
          )}
          <Card className="space-y-4">
            <h2 className="font-display font-bold">{mode === "add" ? t("coins.choose") : "Amount to deduct"}</h2>
            {mode === "add" && (
              <div className="grid grid-cols-3 gap-2">
                {amounts.map((a) => (
                  <button key={a} onClick={() => setAmount(a)} className={cn("flex items-center justify-center gap-1 rounded-xl border-2 py-3 font-display font-bold tabular-nums transition", amount === a ? "border-primary bg-secondary text-primary-deep" : "border-border")}><CoinIcon />{fmt(a)}</button>
                ))}
              </div>
            )}
            <label className="block text-xs text-muted-foreground">{mode === "add" ? `${t("coins.custom")} (${fmt(min)} – ${fmt(max)})` : `Amount${profile?.balance != null ? ` (balance ${fmt(profile.balance)})` : ""}`}
              <input type="number" value={amount} min={1} onChange={(e) => setAmount(Number(e.target.value))} className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-base font-bold text-foreground outline-none focus:border-primary" />
            </label>
            <label className="block text-xs text-muted-foreground">Instructions <span className="text-destructive">*</span>
              <textarea value={note} required maxLength={300} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Write your instructions (required)" className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm text-foreground outline-none focus:border-primary" />
            </label>
            <PrimaryButton onClick={submit} loading={busy}>{mode === "add" ? t("coins.request") : "Request deduction"} · {fmt(amount || 0)}</PrimaryButton>
          </Card>
          <Card>
            <h2 className="mb-2 font-display font-bold">{mode === "add" ? t("coins.my_requests") : "My deduction requests"}</h2>
            {!reqs?.length ? <Empty /> : (
              <ul className="divide-y divide-border text-sm">
                {reqs.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0"><div className="font-bold tabular-nums">{mode === "deduct" ? "−" : ""}{fmt(r.amount)}</div><div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>{r.note && <div className="truncate text-xs text-muted-foreground">{r.note}</div>}{r.admin_note && <div className="text-xs">{r.admin_note}</div>}</div>
                    <StatusPill s={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </RequireLogin>
    </AppShell>
  );
}
