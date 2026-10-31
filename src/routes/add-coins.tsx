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
  component: AddCoins,
});

function AddCoins() {
  const { t, settings, session } = useApp();
  const cfg = settings.coins ?? {};
  const min = Number(cfg.min ?? 300), max = Number(cfg.max ?? 10000);
  const amounts: number[] = cfg.amounts ?? [300, 500, 1000, 2000, 5000, 10000];
  const [amount, setAmount] = useState(amounts[0] ?? min);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const { data: reqs } = useQuery({
    queryKey: ["coin-reqs", session?.user.id], enabled: !!session,
    queryFn: async () => (await supabase.from("coin_requests").select("*").order("created_at", { ascending: false }).limit(30)).data ?? [],
  });
  const submit = async () => {
    if (amount < min || amount > max) return toast.error(`${fmt(min)} – ${fmt(max)}`);
    setBusy(true);
    const { error } = await supabase.rpc("submit_coin_request", { _amount: amount, _note: note });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(t("coins.sent")); setNote("");
    qc.invalidateQueries({ queryKey: ["coin-reqs"] });
  };
  return (
    <AppShell title={t("coins.title")} back="/account">
      <RequireLogin>
        <div className="space-y-4">
          {(cfg.instructions || cfg.image_url) && (
            <Card className="space-y-3">
              {cfg.instructions && <p className="whitespace-pre-line text-sm text-muted-foreground">{cfg.instructions}</p>}
              {cfg.image_url && <img src={cfg.image_url} alt="Instructions" className="w-full rounded-xl" />}
            </Card>
          )}
          <Card className="space-y-4">
            <h2 className="font-display font-bold">{t("coins.choose")}</h2>
            <div className="grid grid-cols-3 gap-2">
              {amounts.map((a) => (
                <button key={a} onClick={() => setAmount(a)} className={cn("flex items-center justify-center gap-1 rounded-xl border-2 py-3 font-display font-bold tabular-nums transition", amount === a ? "border-primary bg-secondary text-primary-deep" : "border-border")}><CoinIcon />{fmt(a)}</button>
              ))}
            </div>
            <label className="block text-xs text-muted-foreground">{t("coins.custom")} ({fmt(min)} – {fmt(max)})
              <input type="number" value={amount} min={min} max={max} onChange={(e) => setAmount(Number(e.target.value))} className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-base font-bold text-foreground outline-none focus:border-primary" />
            </label>
            <label className="block text-xs text-muted-foreground">{t("coins.note")}
              <textarea value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm text-foreground outline-none focus:border-primary" />
            </label>
            <PrimaryButton onClick={submit} loading={busy}>{t("coins.request")} · {fmt(amount)}</PrimaryButton>
          </Card>
          <Card>
            <h2 className="mb-2 font-display font-bold">{t("coins.my_requests")}</h2>
            {!reqs?.length ? <Empty /> : (
              <ul className="divide-y divide-border text-sm">
                {reqs.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2.5">
                    <div><div className="font-bold tabular-nums">{fmt(r.amount)}</div><div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>{r.admin_note && <div className="text-xs">{r.admin_note}</div>}</div>
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
