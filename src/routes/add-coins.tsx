import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useApp } from "@/lib/app-context";
import { fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { uploadFile } from "@/lib/media";
import { ImagePlus, X, ShieldCheck, Wallet } from "lucide-react";
import { AppShell, Card, PrimaryButton, RequireLogin } from "@/components/sz/shell";
import { Empty, StatusPill } from "@/components/sz/bits";

export const Route = createFileRoute("/add-coins")({
  head: () => ({
    meta: [
      { title: "Deposit & Withdraw PKR — STAR ZONE" },
      { name: "description", content: "Deposit and withdraw PKR via Easypaisa & JazzCash." },
      { property: "og:title", content: "Deposit & Withdraw PKR — STAR ZONE" },
      { property: "og:description", content: "Deposit and withdraw PKR via Easypaisa & JazzCash." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { mode: "add" | "deduct" } => ({
    mode: s["mode"] === "deduct" ? "deduct" : "add",
  }),
  component: AddCoins,
});

function AddCoins() {
  const { t, settings, session, profile } = useApp();
  const cfg = settings["coins"] ?? {};
  const min = Number(cfg.min ?? 300);
  const max = Number(cfg.max ?? 10000);
  const amounts: number[] = cfg.amounts ?? [300, 500, 1000, 2000, 5000, 10000];
  const { mode: initialMode } = Route.useSearch();
  const [mode, setMode] = useState<"add" | "deduct">(initialMode);
  const [amount, setAmount] = useState(amounts[0] ?? min);
  const [note, setNote] = useState("Deposit");
  const [busy, setBusy] = useState(false);
  const [shot, setShot] = useState<File | null>(null);
  const [txn, setTxn] = useState("");
  const [source, setSource] = useState<"easypaisa" | "jazzcash">("easypaisa");
  const qc = useQueryClient();
  const table = mode === "add" ? "coin_requests" : "coin_deductions";

  // Check bound payout account
  const { data: payoutAccount, refetch: refetchPayout } = useQuery({
    queryKey: ["payout-account", session?.user.id],
    enabled: !!session,
    queryFn: async () => (await supabase.from("payout_accounts").select("*").maybeSingle()).data,
  });

  const [bindMethod, setBindMethod] = useState<"easypaisa" | "jazzcash">("easypaisa");
  const [bindName, setBindName] = useState("");
  const [bindNumber, setBindNumber] = useState("");
  const [bindBusy, setBindBusy] = useState(false);

  const handleBind = async () => {
    if (!bindName.trim() || !bindNumber.trim()) {
      toast.error("Please enter account name and number");
      return;
    }
    setBindBusy(true);
    const { error } = await supabase.rpc("bind_payout_account", {
      _method: bindMethod,
      _name: bindName.trim(),
      _number: bindNumber.trim(),
    });
    setBindBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account bound successfully!");
    refetchPayout();
  };

  const { data: reqs } = useQuery({
    queryKey: ["coin-reqs", mode, session?.user.id],
    enabled: !!session,
    queryFn: async () =>
      (await supabase.from(table).select("*").order("created_at", { ascending: false }).limit(30)).data ?? [],
  });

  const submit = async () => {
    if (!amount || amount < 1) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (mode === "add" && (amount < min || amount > max)) {
      toast.error(`Deposit limit: ${fmt(min)} – ${fmt(max)}`);
      return;
    }
    if (mode === "deduct" && !payoutAccount) {
      toast.error("Please bind your Easypaisa or JazzCash account first");
      return;
    }
    setBusy(true);
    let path: string | undefined;
    if (mode === "add" && shot && session) {
      try {
        path = await uploadFile(session.user.id, shot);
      } catch (e) {
        setBusy(false);
        toast.error(errMsg(e));
        return;
      }
    }
    const { error } =
      mode === "add"
        ? await supabase.rpc("submit_coin_request", {
            _amount: amount,
            _note: note,
            _screenshot: path ?? "",
            _txn: txn,
            _source: source,
          })
        : await supabase.rpc("submit_coin_deduction", { _amount: amount, _note: note });
    setBusy(false);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    toast.success(mode === "add" ? "Deposit request submitted!" : "Withdrawal request submitted!");
    setNote("");
    setShot(null);
    setTxn("");
    qc.invalidateQueries({ queryKey: ["coin-reqs"] });
  };

  return (
    <AppShell title={mode === "add" ? "Deposit PKR" : "Withdraw PKR"} back="/account">
      <RequireLogin>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
            <button
              onClick={() => setMode("add")}
              className={cn(
                "rounded-lg py-2.5 font-display text-sm font-bold transition",
                mode === "add" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"
              )}
            >
              Deposit PKR
            </button>
            <button
              onClick={() => setMode("deduct")}
              className={cn(
                "rounded-lg py-2.5 font-display text-sm font-bold transition",
                mode === "deduct" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"
              )}
            >
              Withdraw PKR
            </button>
          </div>

          {(() => {
            const ins = mode === "add" ? cfg.instructions : cfg.deduct_instructions;
            const img = mode === "add" ? cfg.image_url : cfg.deduct_image_url;
            return ins || img ? (
              <Card className="space-y-3">
                {ins && <p className="whitespace-pre-line text-sm text-muted-foreground">{ins}</p>}
                {img && <img src={img} alt="" className="w-full rounded-xl" />}
              </Card>
            ) : null;
          })()}

          {/* Account Binding for Withdrawals */}
          {mode === "deduct" && (
            <Card className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold">Withdrawal Account</h2>
                {payoutAccount && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600">
                    <ShieldCheck className="h-3 w-3" /> Bound
                  </span>
                )}
              </div>
              {payoutAccount ? (
                <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs space-y-1">
                  <div className="font-bold text-primary capitalize">{payoutAccount.method}</div>
                  <div className="text-foreground font-semibold text-sm">{payoutAccount.account_name}</div>
                  <div className="font-mono text-muted-foreground">{payoutAccount.account_number}</div>
                  <p className="pt-1 text-[10px] text-muted-foreground">
                    Account is permanently bound. Only Admin can unbind.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <p className="text-[11px] text-muted-foreground">
                    Bind your Easypaisa or JazzCash account once. All future withdrawals will go directly to this account.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["easypaisa", "jazzcash"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setBindMethod(m)}
                        className={cn(
                          "rounded-xl border-2 py-2.5 font-bold capitalize transition",
                          bindMethod === m ? "border-primary bg-primary/10 text-primary" : "border-border"
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                      Account Title / Full Name
                    </label>
                    <input
                      value={bindName}
                      onChange={(e) => setBindName(e.target.value)}
                      placeholder="e.g. Muhammad Ali"
                      className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                      Account / Mobile Number
                    </label>
                    <input
                      value={bindNumber}
                      onChange={(e) => setBindNumber(e.target.value)}
                      placeholder="e.g. 03001234567"
                      className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                    />
                  </div>
                  <PrimaryButton onClick={handleBind} loading={bindBusy}>
                    Bind Account
                  </PrimaryButton>
                </div>
              )}
            </Card>
          )}

          <Card className="space-y-4">
            <h2 className="font-display font-bold">
              {mode === "add" ? "Select Deposit Amount" : "Enter Withdrawal Amount"}
            </h2>

            {mode === "add" && (
              <div className="grid grid-cols-3 gap-2">
                {amounts.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAmount(a)}
                    className={cn(
                      "flex items-center justify-center rounded-xl border-2 py-3 font-display font-bold tabular-nums transition",
                      amount === a ? "border-primary bg-secondary text-primary-deep" : "border-border"
                    )}
                  >
                    {fmt(a)}
                  </button>
                ))}
              </div>
            )}

            <label className="block text-xs text-muted-foreground">
              {mode === "add"
                ? `Custom Amount (${fmt(min)} – ${fmt(max)})`
                : `Amount to Withdraw${profile?.balance != null ? ` (Available Balance: ${fmt(profile.balance)})` : ""}`}
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-sm">
                  PKR
                </span>
                <input
                  type="number"
                  value={amount}
                  min={1}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="h-11 w-full rounded-xl border border-input bg-background pl-12 pr-3 text-base font-bold text-foreground outline-none focus:border-primary"
                />
              </div>
            </label>

            {mode === "add" && (
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="grid grid-cols-2 gap-2">
                  {(["easypaisa", "jazzcash"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSource(s)}
                      className={cn(
                        "rounded-xl border-2 py-2.5 font-bold capitalize",
                        source === s ? "border-primary bg-secondary text-primary-deep" : "border-border"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <input
                  value={txn}
                  onChange={(e) => setTxn(e.target.value)}
                  placeholder="Transaction ID / Sender Number"
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
            )}

            {mode === "add" && (
              <div className="text-xs text-muted-foreground">
                Payment Screenshot
                {shot ? (
                  <div className="relative mt-1 inline-block">
                    <img
                      src={URL.createObjectURL(shot)}
                      alt=""
                      className="h-28 rounded-xl border border-border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setShot(null)}
                      className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-destructive text-destructive-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="mt-1 flex h-20 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-secondary/50 font-semibold text-primary-deep">
                    <ImagePlus className="h-5 w-5" />
                    Upload Payment Proof
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setShot(e.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
              </div>
            )}

            <PrimaryButton onClick={submit} loading={busy}>
              {mode === "add" ? "Submit Deposit" : "Request Withdrawal"} · {fmt(amount || 0)}
            </PrimaryButton>
          </Card>

          <Card>
            <h2 className="mb-2 font-display font-bold">
              {mode === "add" ? "My Deposit Requests" : "My Withdrawal Requests"}
            </h2>
            {!reqs?.length ? (
              <Empty />
            ) : (
              <ul className="divide-y divide-border text-sm">
                {reqs.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="font-bold tabular-nums">
                        {mode === "deduct" ? "−" : "+"}
                        {fmt(r.amount)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </div>
                      {r.note && <div className="truncate text-xs text-muted-foreground">{r.note}</div>}
                      {r.admin_note && <div className="text-xs text-amber-500">{r.admin_note}</div>}
                    </div>
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
