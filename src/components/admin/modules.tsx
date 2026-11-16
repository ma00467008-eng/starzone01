// @ts-nocheck -- admin panel uses loosely typed rows
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, RotateCcw, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg } from "@/lib/app-context";
import { DICT } from "@/lib/i18n-dict";
import { signedUrl } from "@/lib/media";
import { fmt } from "@/lib/sound";
import { ChatThread } from "@/components/sz/chat-thread";
import { StatusPill, Empty } from "@/components/sz/bits";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Panel, Btn, Field, ImageUpload, inputCls, areaCls, confirmDo } from "./ui";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

function useRows(key: string, q: () => Promise<{ data: Row[] | null }>) {
  return useQuery({ queryKey: ["adm", key], queryFn: async () => (await q()).data ?? [] });
}
function useRefresh() {
  const qc = useQueryClient();
  return (...keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: ["adm", k] }));
}
async function run(p: PromiseLike<{ error: unknown }>, ok?: string) {
  const { error } = await p;
  if (error) { toast.error(errMsg(error)); return false; }
  if (ok) toast.success(ok);
  return true;
}
const when = (s?: string) => (s ? new Date(s).toLocaleString() : "—");

/* ---------------- Dashboard ---------------- */
export function Dashboard() {
  const { data: s } = useQuery({ queryKey: ["adm", "stats"], refetchInterval: 30000, queryFn: async () => (await supabase.rpc("admin_stats")).data as Row });
  const { data: logs } = useRows("logs", () => db.from("admin_logs").select("*").order("created_at", { ascending: false }).limit(15));
  const cards = [
    ["Registered users", s?.users], ["Active (24h)", s?.active], ["New today", s?.new_today], ["Coins in circulation", s?.coins],
    ["Pending coin requests", s?.pending_coins], ["Games played", s?.games_played], ["Games today", s?.games_today],
    ["Open tickets", s?.pending_tickets], ["Unread messages", s?.unread_messages],
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {cards.map(([l, v]) => (
          <div key={l as string} className="rounded-2xl bg-card p-4 shadow-card">
            <div className="text-xs text-muted-foreground">{l}</div>
            <div className="mt-1 font-display text-2xl font-bold text-primary-deep">{v == null ? "…" : fmt(Number(v))}</div>
          </div>
        ))}
      </div>
      <Panel title="Game activity">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {Object.entries((s?.by_game ?? {}) as Record<string, number>).map(([g, c]) => <div key={g} className="rounded-lg bg-secondary p-2 text-sm"><b className="capitalize">{g}</b><div>{fmt(c)} rounds</div></div>)}
          {!Object.keys(s?.by_game ?? {}).length && <p className="text-sm text-muted-foreground">No rounds yet.</p>}
        </div>
      </Panel>
      <Panel title="Recent admin activity">
        <ul className="divide-y divide-border text-sm">
          {logs?.map((l) => <li key={l.id} className="flex justify-between gap-2 py-2"><span className="font-medium">{l.action.replace(/_/g, " ")}</span><span className="text-xs text-muted-foreground">{when(l.created_at)}</span></li>)}
          {!logs?.length && <li className="py-2 text-muted-foreground">Nothing yet.</li>}
        </ul>
      </Panel>
    </>
  );
}

/* ---------------- Users ---------------- */
export function UsersMod() {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Row | null>(null);
  const refresh = useRefresh();
  const { data: users } = useQuery({
    queryKey: ["adm", "users", q],
    queryFn: async () => {
      let r = db.from("profiles").select("*").order("created_at", { ascending: false }).limit(50);
      const s = q.trim().replace(/[%,()]/g, "");
      if (s) r = r.or(`uid.ilike.%${s}%,username.ilike.%${s}%,phone.ilike.%${s}%`);
      return (await r).data ?? [];
    },
  });
  return (
    <>
      <Panel title="User management">
        <div className="relative mb-3"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search UID, username or phone" className={cn(inputCls, "pl-9")} /></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">UID</th><th>Username</th><th>Phone</th><th>Balance</th><th>Status</th><th>Joined</th></tr></thead>
            <tbody className="divide-y divide-border">
              {users?.map((u: Row) => (
                <tr key={u.id} onClick={() => setSel(u)} className={cn("cursor-pointer hover:bg-secondary/50", sel?.id === u.id && "bg-secondary")}>
                  <td className="py-2 font-mono">{u.uid}</td><td>{u.username}</td><td>{u.phone}</td><td>{fmt(u.balance)}</td>
                  <td><span className={u.status === "active" ? "text-success" : "text-destructive"}>{u.status}</span></td><td className="text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {sel && <UserDetail key={sel.id} u={sel} onChange={() => { refresh("users"); setSel(null); }} />}
    </>
  );
}

function UserDetail({ u, onChange }: { u: Row; onChange: () => void }) {
  const [amt, setAmt] = useState("");
  const [reason, setReason] = useState("");
  const { data: rounds } = useRows(`rounds-${u.id}`, () => db.from("game_rounds").select("*").eq("user_id", u.id).order("created_at", { ascending: false }).limit(20));
  const { data: tx } = useRows(`tx-${u.id}`, () => db.from("transactions").select("*").eq("user_id", u.id).order("created_at", { ascending: false }).limit(20));
  const adjust = async (sign: 1 | -1) => {
    const n = Math.floor(Number(amt));
    if (!n || n <= 0) return toast.error("Enter an amount");
    if (!reason.trim()) return toast.error("Reason required");
    if (!confirmDo(`${sign > 0 ? "Credit" : "Deduct"} ${n} coins ${sign > 0 ? "to" : "from"} ${u.username}?`)) return;
    if (await run(supabase.rpc("admin_adjust_balance", { _user: u.id, _amount: sign * n, _reason: reason.trim() }), "Balance updated")) onChange();
  };
  return (
    <Panel title={`${u.username} · UID ${u.uid}`} actions={
      <Btn variant={u.status === "active" ? "danger" : "success"} onClick={async () => {
        const st = u.status === "active" ? "suspended" : "active";
        if (confirmDo(`Set account to ${st}?`) && await run(supabase.rpc("admin_set_status", { _user: u.id, _status: st }), "Status updated")) onChange();
      }}>{u.status === "active" ? "Suspend" : "Reactivate"}</Btn>
    }>
      <div className="grid gap-2 text-sm md:grid-cols-4">
        <div>Phone: <b>{u.phone}</b></div><div>Balance: <b>{fmt(u.balance)}</b></div><div>Joined: <b>{when(u.created_at)}</b></div><div>Last seen: <b>{when(u.last_seen)}</b></div>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-[140px_1fr_auto_auto]">
        <input value={amt} onChange={(e) => setAmt(e.target.value.replace(/\D/g, ""))} placeholder="Amount" className={inputCls} />
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (recorded)" className={inputCls} />
        <Btn variant="success" onClick={() => adjust(1)}>Credit</Btn>
        <Btn variant="danger" onClick={() => adjust(-1)}>Deduct</Btn>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div><h3 className="mb-1 text-sm font-semibold">Game history</h3>
          <ul className="max-h-64 divide-y divide-border overflow-y-auto text-xs">{rounds?.map((r) => <li key={r.id} className="flex justify-between py-1.5"><span className="capitalize">{r.game} · {r.round_code}</span><span className={r.payout > r.stake ? "text-success" : "text-destructive"}>{fmt(r.stake)} → {fmt(r.payout)}</span></li>)}{!rounds?.length && <li className="py-1.5 text-muted-foreground">No games yet</li>}</ul>
        </div>
        <div><h3 className="mb-1 text-sm font-semibold">Transactions</h3>
          <ul className="max-h-64 divide-y divide-border overflow-y-auto text-xs">{tx?.map((r) => <li key={r.id} className="flex justify-between py-1.5"><span>{r.kind}{r.note ? ` · ${r.note}` : ""}</span><span className={r.amount >= 0 ? "text-success" : "text-destructive"}>{r.amount >= 0 ? "+" : ""}{fmt(r.amount)}</span></li>)}{!tx?.length && <li className="py-1.5 text-muted-foreground">None</li>}</ul>
        </div>
      </div>
    </Panel>
  );
}

/* ---------------- Settings helper ---------------- */
function useSetting(key: string) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["adm", "setting", key], queryFn: async () => ((await db.from("site_settings").select("value").eq("key", key).maybeSingle()).data?.value ?? {}) as Row });
  const save = async (value: Row) => {
    if (await run(db.from("site_settings").upsert({ key, value, updated_at: new Date().toISOString() }), "Saved")) {
      qc.invalidateQueries({ queryKey: ["adm", "setting", key] });
      qc.invalidateQueries({ queryKey: ["settings"] });
    }
  };
  return { value: data, save };
}
function useDraft(v: Row | undefined) {
  const [d, setD] = useState<Row>({});
  useEffect(() => { if (v) setD(v); }, [v]);
  return [d, (p: Row) => setD((o) => ({ ...o, ...p }))] as const;
}

/* ---------------- Coin deductions ---------------- */
function DeductionsPanel() {
  const [filter, setFilter] = useState("pending");
  const refresh = useRefresh();
  const { data: reqs } = useQuery({
    queryKey: ["adm", "deductions", filter],
    queryFn: async () => {
      const r = (await db.from("coin_deductions").select("*").eq("status", filter).order("created_at", { ascending: filter === "pending" }).limit(100)).data ?? [];
      const ids = [...new Set(r.map((x: Row) => x.user_id))];
      const ps = ids.length ? (await db.from("profiles").select("id,uid,username,phone,balance").in("id", ids)).data ?? [] : [];
      const m = Object.fromEntries(ps.map((p: Row) => [p.id, p]));
      return r.map((x: Row) => ({ ...x, p: m[x.user_id] }));
    },
  });
  const [busy, setBusy] = useState<string | null>(null);
  const review = async (r: Row, approve: boolean) => {
    const note = approve ? "" : window.prompt("Rejection reason (shown to user)", "Your deduction request was not approved.");
    if (!approve && note === null) return;
    setBusy(r.id);
    await run(supabase.rpc("admin_review_deduction", { _id: r.id, _approve: approve, _note: note ?? "" }), approve ? "Approved & deducted" : "Rejected");
    setBusy(null); refresh("deductions", "stats");
  };
  return (
    <Panel title="Coin deduction requests" actions={
      <div className="flex gap-1">{["pending", "approved", "rejected"].map((s) => <Btn key={s} variant={filter === s ? "primary" : "ghost"} onClick={() => setFilter(s)} className="capitalize">{s}</Btn>)}</div>
    }>
      {!reqs?.length ? <Empty text="No requests" /> : (
        <ul className="divide-y divide-border">
          {reqs.map((r: Row) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{r.p?.username} <span className="font-mono text-xs text-muted-foreground">UID {r.p?.uid} · {r.p?.phone} · Bal {fmt(r.p?.balance ?? 0)}</span></div>
                <div className="text-xs text-muted-foreground">{when(r.created_at)} · “{r.note}”{r.admin_note ? ` · Admin: ${r.admin_note}` : ""}</div>
              </div>
              <div className="font-display text-lg font-bold text-destructive">−{fmt(r.amount)}</div>
              {r.status === "pending" ? (
                <div className="flex gap-1">
                  <Btn variant="success" disabled={busy === r.id} onClick={() => review(r, true)}><Check className="h-4 w-4" />Approve</Btn>
                  <Btn variant="danger" disabled={busy === r.id} onClick={() => review(r, false)}><X className="h-4 w-4" />Reject</Btn>
                </div>
              ) : <StatusPill s={r.status} />}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ---------------- Coin deductions ---------------- */
function DeductionsPanel() {
  const [filter, setFilter] = useState("pending");
  const refresh = useRefresh();
  const { data: reqs } = useQuery({
    queryKey: ["adm", "deductions", filter],
    queryFn: async () => {
      let q = db.from("coin_deductions").select("*");
      if (filter === "cross_bet") {
        q = q.eq("is_cross_bet", true).order("created_at", { ascending: false }).limit(100);
      } else {
        q = q.eq("status", filter).order("created_at", { ascending: filter === "pending" }).limit(100);
      }
      const r = (await q).data ?? [];
      const ids = [...new Set(r.map((x: Row) => x.user_id))];
      const ps = ids.length ? (await db.from("profiles").select("id,uid,username,phone,balance").in("id", ids)).data ?? [] : [];
      const m = Object.fromEntries(ps.map((p: Row) => [p.id, p]));
      return r.map((x: Row) => ({ ...x, p: m[x.user_id] }));
    },
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectItem, setRejectItem] = useState<Row | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [penaltyWager, setPenaltyWager] = useState(0);

  const startReject = (r: Row) => {
    setRejectItem(r);
    setRejectNote(r.is_cross_bet ? "Our system detected cross betting in your gameplay. Please complete the additional wagering requirement before requesting another withdrawal." : "Your withdrawal request was not approved.");
    setPenaltyWager(r.is_cross_bet ? Math.round(Number(r.amount) * 2) : 0);
  };

  const confirmReject = async () => {
    if (!rejectItem) return;
    setBusy(rejectItem.id);
    await run(supabase.rpc("admin_review_deduction", {
      _id: rejectItem.id,
      _approve: false,
      _note: rejectNote,
      _penalty_wager: penaltyWager || 0,
    }), "Rejected withdrawal request");
    setBusy(null);
    setRejectItem(null);
    refresh("deductions", "stats");
  };

  const approve = async (r: Row) => {
    setBusy(r.id);
    await run(supabase.rpc("admin_review_deduction", {
      _id: r.id,
      _approve: true,
      _note: "",
      _penalty_wager: 0,
    }), "Approved & deducted");
    setBusy(null);
    refresh("deductions", "stats");
  };

  return (
    <>
      <Panel title="Coin deduction requests" actions={
        <div className="flex flex-wrap gap-1">
          {["pending", "cross_bet", "approved", "rejected"].map((s) => (
            <Btn
              key={s}
              variant={filter === s ? "primary" : "ghost"}
              onClick={() => setFilter(s)}
              className={cn("capitalize", s === "cross_bet" && "text-amber-400")}
            >
              {s === "cross_bet" ? "⚠️ Cross-Bet Flags" : s}
            </Btn>
          ))}
        </div>
      }>
        {!reqs?.length ? <Empty text="No requests" /> : (
          <ul className="divide-y divide-border">
            {reqs.map((r: Row) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-semibold">
                    <span>{r.p?.username}</span>
                    <span className="font-mono text-xs text-muted-foreground">UID {r.p?.uid} · {r.p?.phone} · Bal {fmt(r.p?.balance ?? 0)}</span>
                    {r.is_cross_bet && (
                      <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-400">
                        ⚠️ Cross-Bet ({r.cross_bet_count}x detected)
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {when(r.created_at)} · {r.method?.toUpperCase()} · {r.account_name} ({r.account_number})
                    {r.note ? ` · “${r.note}”` : ""}
                    {r.admin_note ? ` · Admin: ${r.admin_note}` : ""}
                  </div>
                </div>
                <div className="font-display text-lg font-bold text-destructive">−{fmt(r.amount)}</div>
                {r.status === "pending" ? (
                  <div className="flex gap-1">
                    <Btn variant="success" disabled={busy === r.id} onClick={() => approve(r)}><Check className="h-4 w-4" />Approve</Btn>
                    <Btn variant="danger" disabled={busy === r.id} onClick={() => startReject(r)}><X className="h-4 w-4" />Reject</Btn>
                  </div>
                ) : <StatusPill s={r.status} />}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Reject Modal */}
      {rejectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <h3 className="text-base font-bold text-foreground">Reject Withdrawal Request</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              User: <span className="font-semibold text-foreground">{rejectItem.p?.username}</span> (Amount: {fmt(rejectItem.amount)} PKR)
              {rejectItem.is_cross_bet && <span className="block mt-1 font-semibold text-rose-400">⚠️ Flagged for {rejectItem.cross_bet_count} cross bets</span>}
            </p>
            <div className="mt-4 space-y-3">
              <Field label="Rejection reason (shown to user)">
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  className={areaCls}
                  rows={3}
                />
              </Field>
              <Field label="Add Penalty Betting Wager (PKR)">
                <input
                  type="number"
                  min="0"
                  value={penaltyWager}
                  onChange={(e) => setPenaltyWager(Number(e.target.value))}
                  placeholder="e.g. 2000"
                  className={inputCls}
                />
                <span className="text-[11px] text-muted-foreground">
                  This turnover will be added to the player's required wagering requirement before they can withdraw again.
                </span>
              </Field>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setRejectItem(null)}>Cancel</Btn>
              <Btn variant="danger" disabled={busy === rejectItem.id} onClick={confirmReject}>Confirm Rejection</Btn>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------- Coins ---------------- */
export function CoinsMod() {
  const [filter, setFilter] = useState("pending");
  const refresh = useRefresh();
  const { data: reqs } = useQuery({
    queryKey: ["adm", "coins", filter],
    queryFn: async () => {
      const r = (await db.from("coin_requests").select("*").eq("status", filter).order("created_at", { ascending: filter !== "pending" ? false : true }).limit(100)).data ?? [];
      const ids = [...new Set(r.map((x: Row) => x.user_id))];
      const ps = ids.length ? (await db.from("profiles").select("id,uid,username,phone,balance").in("id", ids)).data ?? [] : [];
      const m = Object.fromEntries(ps.map((p: Row) => [p.id, p]));
      return r.map((x: Row) => ({ ...x, p: m[x.user_id] }));
    },
  });
  const [busy, setBusy] = useState<string | null>(null);
  const review = async (r: Row, approve: boolean) => {
    const note = approve ? null : window.prompt("Rejection reason (shown to user)", "Your request was not approved.");
    if (!approve && note === null) return;
    setBusy(r.id);
    await run(supabase.rpc("admin_review_coin", { _id: r.id, _approve: approve, _note: note ?? "" }), approve ? "Approved & credited" : "Rejected");
    setBusy(null); refresh("coins", "stats");
  };
  const { value, save } = useSetting("coins");
  const [d, set] = useDraft(value);
  return (
    <>
      <Panel title="Coin requests" actions={
        <div className="flex gap-1">{["pending", "approved", "rejected"].map((s) => <Btn key={s} variant={filter === s ? "primary" : "ghost"} onClick={() => setFilter(s)} className="capitalize">{s}</Btn>)}</div>
      }>
        {!reqs?.length ? <Empty text="No requests" /> : (
          <ul className="divide-y divide-border">
            {reqs.map((r: Row) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{r.p?.username} <span className="font-mono text-xs text-muted-foreground">UID {r.p?.uid} · {r.p?.phone}</span></div>
                  <div className="text-xs text-muted-foreground">{when(r.created_at)}{r.note ? ` · “${r.note}”` : ""}{r.admin_note ? ` · Admin: ${r.admin_note}` : ""}</div>
                </div>
                {r.screenshot_path && <Shot path={r.screenshot_path} />}
                <div className="font-display text-lg font-bold text-primary-deep">{fmt(r.amount)}</div>
                {r.status === "pending" ? (
                  <div className="flex gap-1">
                    <Btn variant="success" disabled={busy === r.id} onClick={() => review(r, true)}><Check className="h-4 w-4" />Approve</Btn>
                    <Btn variant="danger" disabled={busy === r.id} onClick={() => review(r, false)}><X className="h-4 w-4" />Reject</Btn>
                  </div>
                ) : <StatusPill s={r.status} />}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <DeductionsPanel />
      <Panel title="Add Coins page settings">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Minimum"><input type="number" value={d.min ?? 300} onChange={(e) => set({ min: Number(e.target.value) })} className={inputCls} /></Field>
          <Field label="Maximum"><input type="number" value={d.max ?? 10000} onChange={(e) => set({ max: Number(e.target.value) })} className={inputCls} /></Field>
          <Field label="Requests per day"><input type="number" value={d.daily_limit ?? 3} onChange={(e) => set({ daily_limit: Number(e.target.value) })} className={inputCls} /></Field>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="1st Deposit Wager Multiplier (e.g. 2 for 2x)">
            <input
              type="number"
              step="0.1"
              min="0"
              value={d.wager_first ?? 2}
              onChange={(e) => set({ wager_first: Number(e.target.value) })}
              className={inputCls}
            />
          </Field>
          <Field label="2nd+ Deposit Wager Multiplier (e.g. 1 for 1x)">
            <input
              type="number"
              step="0.1"
              min="0"
              value={d.wager_next ?? 1}
              onChange={(e) => set({ wager_next: Number(e.target.value) })}
              className={inputCls}
            />
          </Field>
        </div>
        <div className="mt-3 space-y-3">
          <Field label="Amount buttons (comma separated)"><input value={(d.amounts ?? [300, 500, 1000, 2000, 5000, 10000]).join(", ")} onChange={(e) => set({ amounts: e.target.value.split(",").map((x) => Number(x.trim())).filter((x) => x > 0) })} className={inputCls} /></Field>
          <Field label="Deposit instructions"><textarea value={d.instructions ?? ""} onChange={(e) => set({ instructions: e.target.value })} className={areaCls} /></Field>
          <div className="flex flex-wrap items-center gap-2">
            <ImageUpload label="Instruction screenshot" onDone={(url) => set({ image_url: url })} />
            {d.image_url && <><img src={d.image_url} alt="" className="h-16 rounded-lg" /><Btn variant="ghost" onClick={() => set({ image_url: null })}>Remove</Btn></>}
          </div>
          <Field label="Withdrawal instructions"><textarea value={d.deduct_instructions ?? ""} onChange={(e) => set({ deduct_instructions: e.target.value })} className={areaCls} /></Field>
          <div className="flex flex-wrap items-center gap-2">
            <ImageUpload label="Withdrawal screenshot" onDone={(url) => set({ deduct_image_url: url })} />
            {d.deduct_image_url && <><img src={d.deduct_image_url} alt="" className="h-16 rounded-lg" /><Btn variant="ghost" onClick={() => set({ deduct_image_url: null })}>Remove</Btn></>}
          </div>
          <Btn onClick={() => save(d)}>Save settings</Btn>
        </div>
      </Panel>
    </>
  );
}

/* ---------------- Games ---------------- */
export function GamesMod() {
  const refresh = useRefresh();
  const qc = useQueryClient();
  const { data: games } = useRows("games", () => db.from("games").select("*").order("sort"));
  const [edit, setEdit] = useState<Row | null>(null);
  const save = async (g: Row) => {
    const { slug, ...rest } = g;
    if (await run(db.from("games").update(rest).eq("slug", slug), "Game saved")) { refresh("games"); qc.invalidateQueries({ queryKey: ["games"] }); setEdit(null); }
  };
  return (
    <Panel title="Game management">
      <div className="grid gap-3 md:grid-cols-2">
        {games?.map((g) => (
          <div key={g.slug} className="flex gap-3 rounded-xl border border-border p-3">
            <img src={g.image_url} alt="" className="h-16 w-24 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{g.name} {g.badge && <span className="rounded bg-gold/20 px-1 text-[10px]">{g.badge}</span>}</div>
              <div className="text-xs text-muted-foreground">Stake {fmt(g.min_stake)}–{fmt(g.max_stake)} · {g.enabled ? (g.maintenance ? "Maintenance" : "Live") : "Hidden"}</div>
              <Btn variant="ghost" className="mt-1 h-7" onClick={() => setEdit(g)}>Edit</Btn>
            </div>
          </div>
        ))}
      </div>
      {edit && (
        <div className="mt-4 space-y-3 rounded-xl border border-primary/40 p-4">
          <h3 className="font-semibold">Edit {edit.name}</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Name"><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={inputCls} /></Field>
            <Field label="Badge (NEW / HOT / empty)"><input value={edit.badge ?? ""} onChange={(e) => setEdit({ ...edit, badge: e.target.value || null })} className={inputCls} /></Field>
            <Field label="Order"><input type="number" value={edit.sort} onChange={(e) => setEdit({ ...edit, sort: Number(e.target.value) })} className={inputCls} /></Field>
            <Field label="Min stake"><input type="number" value={edit.min_stake} onChange={(e) => setEdit({ ...edit, min_stake: Number(e.target.value) })} className={inputCls} /></Field>
            <Field label="Max stake"><input type="number" value={edit.max_stake} onChange={(e) => setEdit({ ...edit, max_stake: Number(e.target.value) })} className={inputCls} /></Field>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            {(["enabled", "maintenance", "featured"] as const).map((k) => <label key={k} className="flex items-center gap-2 capitalize"><Switch checked={!!edit[k]} onCheckedChange={(v) => setEdit({ ...edit, [k]: v })} />{k}</label>)}
          </div>
          <Field label="Rules & payout table"><textarea value={edit.rules ?? ""} onChange={(e) => setEdit({ ...edit, rules: e.target.value })} className={areaCls} /></Field>
          <Field label="Game announcement"><input value={edit.announcement ?? ""} onChange={(e) => setEdit({ ...edit, announcement: e.target.value })} className={inputCls} /></Field>
          <div className="flex flex-wrap items-center gap-2"><ImageUpload label="Replace artwork" onDone={(url) => setEdit({ ...edit, image_url: url })} /><img src={edit.image_url} alt="" className="h-12 rounded" /></div>
          <div className="flex gap-2"><Btn onClick={() => save(edit)}>Save</Btn><Btn variant="ghost" onClick={() => setEdit(null)}>Cancel</Btn></div>
        </div>
      )}
    </Panel>
  );
}

/* ---------------- Media (slider / popup / promo) ---------------- */
const KINDS = [{ k: "slider", l: "Home slider" }, { k: "popup", l: "Login pop-ups" }, { k: "promo", l: "PROMO page" }];
export function MediaMod() {
  const [kind, setKind] = useState("slider");
  const refresh = useRefresh();
  const qc = useQueryClient();
  const { data: items } = useRows(`media-${kind}`, () => db.from("media_items").select("*").eq("kind", kind).order("sort"));
  const done = () => { refresh(`media-${kind}`); qc.invalidateQueries(); };
  const add = async (url: string) => { await run(db.from("media_items").insert({ kind, image_url: url, sort: (items?.length ?? 0) + 1 }), "Added"); done(); };
  const upd = async (id: string, p: Row) => { await run(db.from("media_items").update(p).eq("id", id)); done(); };
  const move = async (i: number, dir: -1 | 1) => {
    const a = items![i], b = items![i + dir]; if (!b) return;
    await Promise.all([db.from("media_items").update({ sort: b.sort === a.sort ? i + dir : b.sort }).eq("id", a.id), db.from("media_items").update({ sort: b.sort === a.sort ? i : a.sort }).eq("id", b.id)]);
    done();
  };
  return (
    <Panel title="Banners, pop-ups & PROMO images" actions={<ImageUpload label="Add image" onDone={add} />}>
      <div className="mb-3 flex gap-1">{KINDS.map((x) => <Btn key={x.k} variant={kind === x.k ? "primary" : "ghost"} onClick={() => setKind(x.k)}>{x.l}</Btn>)}</div>
      {!items?.length ? <Empty text="No images yet — click Add image." /> : (
        <ul className="space-y-3">
          {items.map((m, i) => <MediaRow key={m.id} m={m} first={i === 0} last={i === items.length - 1} onMove={(d) => move(i, d)} onSave={(p) => upd(m.id, p)} onDelete={async () => { if (confirmDo("Delete this image?")) { await run(db.from("media_items").delete().eq("id", m.id), "Deleted"); done(); } }} />)}
        </ul>
      )}
    </Panel>
  );
}
function MediaRow({ m, first, last, onMove, onSave, onDelete }: { m: Row; first: boolean; last: boolean; onMove: (d: -1 | 1) => void; onSave: (p: Row) => void; onDelete: () => void }) {
  const [d, setD] = useState<Row>({ title: m.title ?? "", link: m.link ?? "", starts_at: m.starts_at?.slice(0, 16) ?? "", ends_at: m.ends_at?.slice(0, 16) ?? "" });
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border p-3 md:flex-row">
      <img src={m.image_url} alt="" className="h-24 w-full rounded-lg object-cover md:w-44" />
      <div className="grid flex-1 gap-2 md:grid-cols-2">
        <input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Title (optional)" className={inputCls} />
        <input value={d.link} onChange={(e) => setD({ ...d, link: e.target.value })} placeholder="Link (optional)" className={inputCls} />
        <Field label="Show from"><input type="datetime-local" value={d.starts_at} onChange={(e) => setD({ ...d, starts_at: e.target.value })} className={inputCls} /></Field>
        <Field label="Show until"><input type="datetime-local" value={d.ends_at} onChange={(e) => setD({ ...d, ends_at: e.target.value })} className={inputCls} /></Field>
        <div className="flex flex-wrap items-center gap-2 md:col-span-2">
          <label className="flex items-center gap-2 text-sm"><Switch checked={m.enabled} onCheckedChange={(v) => onSave({ enabled: v })} />Visible</label>
          <Btn variant="ghost" disabled={first} onClick={() => onMove(-1)}><ArrowUp className="h-4 w-4" /></Btn>
          <Btn variant="ghost" disabled={last} onClick={() => onMove(1)}><ArrowDown className="h-4 w-4" /></Btn>
          <ImageUpload label="Replace" onDone={(url) => onSave({ image_url: url })} />
          <Btn onClick={() => onSave({ title: d.title || null, link: d.link || null, starts_at: d.starts_at ? new Date(d.starts_at).toISOString() : null, ends_at: d.ends_at ? new Date(d.ends_at).toISOString() : null })}>Save</Btn>
          <Btn variant="danger" onClick={onDelete}><Trash2 className="h-4 w-4" /></Btn>
        </div>
      </div>
    </li>
  );
}

/* ---------------- Chat inbox ---------------- */
export function ChatMod() {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Row | null>(null);
  const { data: convos } = useQuery({ queryKey: ["admin-convos"], refetchInterval: 10000, queryFn: async () => (await supabase.rpc("admin_conversations")).data ?? [] });
  const { data: found } = useQuery({
    queryKey: ["adm", "chat-find", q], enabled: q.trim().length > 1,
    queryFn: async () => { const s = q.trim().replace(/[%,()]/g, ""); return (await db.from("profiles").select("id,uid,username,phone").or(`uid.ilike.%${s}%,username.ilike.%${s}%,phone.ilike.%${s}%`).limit(10)).data ?? []; },
  });
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const c = (convos ?? []).filter((x: Row) => !s || [x.uid, x.username, x.phone].some((v) => String(v).toLowerCase().includes(s)));
    const extra = (found ?? []).filter((f: Row) => !c.some((x: Row) => x.user_id === f.id)).map((f: Row) => ({ user_id: f.id, uid: f.uid, username: f.username, phone: f.phone, last_body: "Start conversation", unread: 0 }));
    return [...c, ...extra];
  }, [convos, found, q]);
  return (
    <div className="grid h-[calc(100vh-7rem)] gap-3 md:grid-cols-[300px_1fr]">
      <div className={cn("flex min-h-0 flex-col rounded-2xl bg-card shadow-card", sel && "hidden md:flex")}>
        <div className="p-3"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search UID, username, phone" className={inputCls} /></div>
        <ul className="flex-1 divide-y divide-border overflow-y-auto">
          {list.map((c: Row) => (
            <li key={c.user_id}><button onClick={() => setSel(c)} className={cn("flex w-full items-center gap-2 px-3 py-2.5 text-start hover:bg-secondary/50", sel?.user_id === c.user_id && "bg-secondary")}>
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{c.username} <span className="font-mono text-[11px] text-muted-foreground">{c.uid}</span></div><div className="truncate text-xs text-muted-foreground">{c.last_body}</div></div>
              {Number(c.unread) > 0 && <span className="rounded-full bg-destructive px-1.5 text-[11px] font-bold text-destructive-foreground">{c.unread}</span>}
            </button></li>
          ))}
          {!list.length && <li className="p-4 text-sm text-muted-foreground">No conversations</li>}
        </ul>
      </div>
      <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-2xl bg-background shadow-card", !sel && "hidden md:flex")}>
        {sel ? (
          <>
            <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2"><button className="md:hidden" onClick={() => setSel(null)}>‹</button><b className="text-sm">{sel.username}</b><span className="text-xs text-muted-foreground">UID {sel.uid} · {sel.phone}</span></div>
            <div className="min-h-0 flex-1"><ChatThread key={sel.user_id} userId={sel.user_id} as="admin" /></div>
          </>
        ) : <div className="grid flex-1 place-items-center text-sm text-muted-foreground">Select a conversation</div>}
      </div>
    </div>
  );
}

/* ---------------- Auto messages ---------------- */
export function AutoMsgMod() {
  const refresh = useRefresh();
  const { data: items } = useRows("auto", () => db.from("auto_messages").select("*").order("sort"));
  const [body, setBody] = useState("");
  const [img, setImg] = useState<string | null>(null);
  const add = async () => {
    if (!body.trim() && !img) return toast.error("Write a message or add a picture");
    if (!confirmDo("This message will be sent to every current user now, and to every new user when they join. Continue?")) return;
    if (await run(db.from("auto_messages").insert({ body: body.trim() || null, image_url: img, sort: (items?.length ?? 0) + 1 }), "Sent to all users")) { setBody(""); setImg(null); refresh("auto"); }
  };
  return (
    <Panel title="Automatic chat messages">
      <p className="mb-3 text-sm text-muted-foreground">Messages added here are delivered in the Chat section to all users right away, and automatically to everyone who signs up later (while enabled).</p>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message text" className={areaCls} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <ImageUpload label="Attach picture" onDone={setImg} />
        {img && <img src={img} alt="" className="h-12 rounded" />}
        <Btn onClick={add}>Send to everyone</Btn>
      </div>
      <ul className="mt-4 divide-y divide-border">
        {items?.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-2 text-sm">
            {m.image_url && <img src={m.image_url} alt="" className="h-10 w-10 rounded object-cover" />}
            <span className="flex-1 whitespace-pre-wrap">{m.body}</span>
            <label className="flex items-center gap-1 text-xs"><Switch checked={m.enabled} onCheckedChange={async (v) => { await run(db.from("auto_messages").update({ enabled: v }).eq("id", m.id)); refresh("auto"); }} />New users</label>
            <Btn variant="danger" onClick={async () => { if (confirmDo("Delete? (Already delivered messages stay in chats.)")) { await run(db.from("auto_messages").delete().eq("id", m.id)); refresh("auto"); } }}><Trash2 className="h-4 w-4" /></Btn>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ---------------- Support: FAQ + tickets ---------------- */
export function SupportMod() {
  const refresh = useRefresh();
  const qc = useQueryClient();
  const { data: faqs } = useRows("faqs", () => db.from("faqs").select("*").order("sort"));
  const empty = { question_en: "", answer_en: "", question_ur: "", answer_ur: "", sort: 0 };
  const [f, setF] = useState<Row>(empty);
  const saveFaq = async () => {
    if (!f.question_en.trim() || !f.answer_en.trim()) return toast.error("Question and answer required");
    const { id, ...rest } = f;
    const ok = id ? await run(db.from("faqs").update(rest).eq("id", id), "FAQ updated") : await run(db.from("faqs").insert({ ...rest, sort: (faqs?.length ?? 0) + 1 }), "FAQ added");
    if (ok) { setF(empty); refresh("faqs"); qc.invalidateQueries({ queryKey: ["faqs"] }); }
  };
  const [st, setSt] = useState("pending");
  const { data: tickets } = useQuery({
    queryKey: ["adm", "tickets", st],
    queryFn: async () => {
      const r = (await db.from("tickets").select("*, ticket_replies(*)").eq("status", st).order("created_at", { ascending: false }).limit(50)).data ?? [];
      const ids = [...new Set(r.map((x: Row) => x.user_id))];
      const ps = ids.length ? (await db.from("profiles").select("id,uid,username").in("id", ids)).data ?? [] : [];
      const m = Object.fromEntries(ps.map((p: Row) => [p.id, p]));
      return r.map((x: Row) => ({ ...x, p: m[x.user_id] }));
    },
  });
  return (
    <>
      <Panel title="FAQ — questions & answers">
        <div className="grid gap-2 md:grid-cols-2">
          <input value={f.question_en} onChange={(e) => setF({ ...f, question_en: e.target.value })} placeholder="Question (English)" className={inputCls} />
          <input value={f.question_ur ?? ""} onChange={(e) => setF({ ...f, question_ur: e.target.value })} placeholder="Question (Urdu)" dir="rtl" className={inputCls} />
          <textarea value={f.answer_en} onChange={(e) => setF({ ...f, answer_en: e.target.value })} placeholder="Answer (English)" className={areaCls} />
          <textarea value={f.answer_ur ?? ""} onChange={(e) => setF({ ...f, answer_ur: e.target.value })} placeholder="Answer (Urdu)" dir="rtl" className={areaCls} />
        </div>
        <div className="mt-2 flex gap-2"><Btn onClick={saveFaq}>{f.id ? "Update FAQ" : "Add FAQ"}</Btn>{f.id && <Btn variant="ghost" onClick={() => setF(empty)}>Cancel</Btn>}</div>
        <ul className="mt-4 divide-y divide-border">
          {faqs?.map((x) => (
            <li key={x.id} className="flex items-start gap-2 py-2 text-sm">
              <div className="flex-1"><b>{x.question_en}</b><p className="text-muted-foreground">{x.answer_en}</p></div>
              <Btn variant="ghost" onClick={() => setF(x)}>Edit</Btn>
              <Btn variant="danger" onClick={async () => { if (confirmDo("Delete FAQ?")) { await run(db.from("faqs").delete().eq("id", x.id)); refresh("faqs"); } }}><Trash2 className="h-4 w-4" /></Btn>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Support tickets" actions={<div className="flex gap-1">{["pending", "open", "closed"].map((s) => <Btn key={s} variant={st === s ? "primary" : "ghost"} onClick={() => setSt(s)} className="capitalize">{s}</Btn>)}</div>}>
        {!tickets?.length ? <Empty text="No tickets" /> : <ul className="space-y-3">{tickets.map((tk: Row) => <AdminTicket key={tk.id} tk={tk} onChange={() => refresh("tickets", "stats")} />)}</ul>}
      </Panel>
    </>
  );
}
function AdminTicket({ tk, onChange }: { tk: Row; onChange: () => void }) {
  const [reply, setReply] = useState("");
  const [img, setImg] = useState<string | null>(null);
  useEffect(() => { if (tk.image_path) supabase.storage.from("private").createSignedUrl(tk.image_path, 3600).then(({ data }) => setImg(data?.signedUrl ?? null)); }, [tk.image_path]);
  const replies = [...(tk.ticket_replies ?? [])].sort((a: Row, b: Row) => a.id - b.id);
  const send = async () => {
    if (!reply.trim()) return;
    if (await run(db.from("ticket_replies").insert({ ticket_id: tk.id, sender: "admin", body: reply.trim().slice(0, 2000) }), "Reply sent")) {
      if (tk.status === "pending") await db.from("tickets").update({ status: "open", updated_at: new Date().toISOString() }).eq("id", tk.id);
      await db.rpc("notify", { _user: tk.user_id, _title: "Support reply", _body: `Admin replied to “${tk.subject}”`, _kind: "support" }).then(() => {}, () => {});
      setReply(""); onChange();
    }
  };
  const setStatus = async (s: string) => { await run(db.from("tickets").update({ status: s, updated_at: new Date().toISOString() }).eq("id", tk.id), `Ticket ${s}`); onChange(); };
  return (
    <li className="rounded-xl border border-border p-3 text-sm">
      <div className="flex items-center justify-between gap-2"><b>{tk.subject}</b><StatusPill s={tk.status} /></div>
      <div className="text-xs text-muted-foreground">{tk.p?.username} · UID {tk.p?.uid} · {when(tk.created_at)}</div>
      <p className="mt-2 whitespace-pre-wrap">{tk.description}</p>
      {img && <a href={img} target="_blank" rel="noreferrer"><img src={img} alt="" className="mt-2 max-h-40 rounded-lg" /></a>}
      <div className="mt-2 space-y-1">{replies.map((r: Row) => <div key={r.id} className={cn("rounded-lg px-2 py-1", r.sender === "admin" ? "bg-primary/10" : "bg-secondary")}><b className="text-xs">{r.sender === "admin" ? "Admin" : "User"}:</b> {r.body}</div>)}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {tk.status !== "closed" && <><input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply…" className={cn(inputCls, "flex-1")} /><Btn onClick={send}>Reply</Btn><Btn variant="danger" onClick={() => setStatus("closed")}>Close</Btn></>}
        {tk.status === "closed" && <Btn variant="ghost" onClick={() => setStatus("open")}>Reopen</Btn>}
      </div>
    </li>
  );
}

/* ---------------- Gift codes ---------------- */
export function GiftsMod() {
  const refresh = useRefresh();
  const { data: codes } = useRows("gifts", () => db.from("gift_codes").select("*").order("created_at", { ascending: false }));
  const empty = { code: "", reward: 100, usage_limit: 100, expires_at: "", is_public: false, active: true, description: "" };
  const [g, setG] = useState<Row>(empty);
  const save = async () => {
    if (!g.code.trim() || g.reward <= 0) return toast.error("Code and reward required");
    const { id, used_count: _u, created_at: _c, ...rest } = g;
    const row = { ...rest, code: g.code.trim().toUpperCase(), expires_at: g.expires_at ? new Date(g.expires_at).toISOString() : null };
    const ok = id ? await run(db.from("gift_codes").update(row).eq("id", id), "Code updated") : await run(db.from("gift_codes").insert(row), "Code created");
    if (ok) { setG(empty); refresh("gifts"); }
  };
  return (
    <Panel title="Gift codes">
      <div className="grid gap-2 md:grid-cols-4">
        <Field label="Code"><input value={g.code} onChange={(e) => setG({ ...g, code: e.target.value })} className={inputCls} /></Field>
        <Field label="Reward coins"><input type="number" value={g.reward} onChange={(e) => setG({ ...g, reward: Number(e.target.value) })} className={inputCls} /></Field>
        <Field label="Usage limit"><input type="number" value={g.usage_limit} onChange={(e) => setG({ ...g, usage_limit: Number(e.target.value) })} className={inputCls} /></Field>
        <Field label="Expires"><input type="datetime-local" value={g.expires_at?.slice(0, 16) ?? ""} onChange={(e) => setG({ ...g, expires_at: e.target.value })} className={inputCls} /></Field>
      </div>
      <input value={g.description ?? ""} onChange={(e) => setG({ ...g, description: e.target.value })} placeholder="Description (optional)" className={cn(inputCls, "mt-2")} />
      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2"><Switch checked={g.active} onCheckedChange={(v) => setG({ ...g, active: v })} />Active</label>
        <label className="flex items-center gap-2"><Switch checked={g.is_public} onCheckedChange={(v) => setG({ ...g, is_public: v })} />Show to users</label>
        <Btn onClick={save}>{g.id ? "Update" : "Create code"}</Btn>{g.id && <Btn variant="ghost" onClick={() => setG(empty)}>Cancel</Btn>}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Each user can redeem a code only once.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm"><thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">Code</th><th>Reward</th><th>Used</th><th>Expires</th><th>Status</th><th /></tr></thead>
          <tbody className="divide-y divide-border">{codes?.map((c) => (
            <tr key={c.id}><td className="py-2 font-mono font-bold">{c.code}</td><td>{fmt(c.reward)}</td><td>{c.used_count}/{c.usage_limit}</td><td className="text-xs">{c.expires_at ? when(c.expires_at) : "Never"}</td>
              <td className="text-xs">{c.active ? "Active" : "Inactive"}{c.is_public ? " · Public" : ""}</td>
              <td className="flex gap-1 py-1"><Btn variant="ghost" onClick={() => setG(c)}>Edit</Btn><Btn variant="danger" onClick={async () => { if (confirmDo("Deactivate this code?")) { await run(db.from("gift_codes").update({ active: false }).eq("id", c.id)); refresh("gifts"); } }}><X className="h-4 w-4" /></Btn></td></tr>
          ))}</tbody></table>
      </div>
    </Panel>
  );
}

/* ---------------- Notifications ---------------- */
export function NotifyMod() {
  const refresh = useRefresh();
  const [target, setTarget] = useState("all");
  const [uids, setUids] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const { data: sent } = useRows("notifs", () => db.from("notifications").select("*").order("created_at", { ascending: false }).limit(30));
  const send = async () => {
    if (!title.trim() || !body.trim()) return toast.error("Title and message required");
    let rows: Row[];
    if (target === "all") rows = [{ user_id: null, title, body, kind: "announcement" }];
    else {
      const list = uids.split(/[\s,]+/).filter(Boolean);
      const { data } = await db.from("profiles").select("id,uid").in("uid", list);
      if (!data?.length) return toast.error("No users found for those UIDs");
      if (data.length < list.length) toast.warning(`${list.length - data.length} UID(s) not found`);
      rows = data.map((p: Row) => ({ user_id: p.id, title, body, kind: "admin" }));
    }
    if (await run(db.from("notifications").insert(rows), "Notification sent")) { setTitle(""); setBody(""); refresh("notifs"); }
  };
  return (
    <Panel title="Send notification">
      <div className="mb-2 flex gap-1"><Btn variant={target === "all" ? "primary" : "ghost"} onClick={() => setTarget("all")}>All users</Btn><Btn variant={target === "some" ? "primary" : "ghost"} onClick={() => setTarget("some")}>Selected UIDs</Btn></div>
      {target === "some" && <input value={uids} onChange={(e) => setUids(e.target.value)} placeholder="UIDs separated by commas" className={cn(inputCls, "mb-2")} />}
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={cn(inputCls, "mb-2")} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message" className={areaCls} />
      <Btn className="mt-2" onClick={send}>Send</Btn>
      <ul className="mt-4 divide-y divide-border text-sm">
        {sent?.map((n) => <li key={n.id} className="flex items-start gap-2 py-2"><div className="flex-1"><b>{n.title}</b> <span className="text-xs text-muted-foreground">{n.user_id ? "· individual" : "· everyone"} · {when(n.created_at)}</span><p className="text-muted-foreground">{n.body}</p></div><Btn variant="danger" onClick={async () => { await run(db.from("notifications").delete().eq("id", n.id)); refresh("notifs"); }}><Trash2 className="h-4 w-4" /></Btn></li>)}
      </ul>
    </Panel>
  );
}

/* ---------------- Site settings & social ---------------- */
export function SettingsMod() {
  const site = useSetting("site"); const [s, setS] = useDraft(site.value);
  const social = useSetting("social"); const [so, setSo] = useDraft(social.value);
  const ann = useSetting("announcement"); const [a, setA] = useDraft(ann.value);
  return (
    <>
      <Panel title="Website">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Website name"><input value={s.name ?? "STAR ZONE"} onChange={(e) => setS({ name: e.target.value })} className={inputCls} /></Field>
          <Field label="Footer text"><input value={s.footer ?? ""} onChange={(e) => setS({ footer: e.target.value })} className={inputCls} /></Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2"><Switch checked={s.registration_open !== false} onCheckedChange={(v) => setS({ registration_open: v })} />Registration open</label>
          <label className="flex items-center gap-2"><Switch checked={!!s.maintenance} onCheckedChange={(v) => setS({ maintenance: v })} />Maintenance mode</label>
          <ImageUpload label="Logo" onDone={(url) => setS({ logo_url: url })} />
          {s.logo_url && <><img src={s.logo_url} alt="" className="h-8" /><Btn variant="ghost" onClick={() => setS({ logo_url: null })}>Remove logo</Btn></>}
        </div>
        <Field label="Maintenance message"><input value={s.maintenance_text ?? ""} onChange={(e) => setS({ maintenance_text: e.target.value })} className={cn(inputCls, "mt-1")} /></Field>
        <Btn className="mt-3" onClick={() => site.save(s)}>Save website settings</Btn>
      </Panel>
      <Panel title="Home announcement">
        <textarea value={a.text ?? ""} onChange={(e) => setA({ text: e.target.value })} className={areaCls} placeholder="Leave empty to hide" />
        <Btn className="mt-2" onClick={() => ann.save(a)}>Save</Btn>
      </Panel>
      <Panel title="WhatsApp & Telegram links">
        <p className="mb-2 text-xs text-muted-foreground">Empty links stay hidden on the site.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {[["whatsapp_support", "WhatsApp Support"], ["telegram_support", "Telegram Support"], ["whatsapp_channel", "WhatsApp Channel"], ["telegram_channel", "Telegram Channel"]].map(([k, l]) => (
            <Field key={k} label={l}><input value={so[k] ?? ""} onChange={(e) => setSo({ [k]: e.target.value.trim() })} placeholder="https://" className={inputCls} /></Field>
          ))}
        </div>
        <Btn className="mt-3" onClick={() => social.save(so)}>Save links</Btn>
      </Panel>
    </>
  );
}

/* ---------------- Content (every text) ---------------- */
export function ContentMod() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data: rows } = useRows("content", () => db.from("content").select("*"));
  const over = useMemo(() => Object.fromEntries((rows ?? []).map((r) => [r.key, r])), [rows]);
  const keys = useMemo(() => [...new Set([...Object.keys(DICT), ...Object.keys(over)])].sort(), [over]);
  const s = q.trim().toLowerCase();
  const shown = keys.filter((k) => !s || k.includes(s) || (over[k]?.en ?? DICT[k]?.en ?? "").toLowerCase().includes(s) || (over[k]?.ur ?? DICT[k]?.ur ?? "").includes(q.trim())).slice(0, 80);
  const done = () => { qc.invalidateQueries({ queryKey: ["adm", "content"] }); qc.invalidateQueries({ queryKey: ["content"] }); };
  return (
    <Panel title="Text editor — every label on the site">
      <div className="relative mb-3"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any text…" className={cn(inputCls, "pl-9")} /></div>
      <p className="mb-3 text-xs text-muted-foreground">Showing {shown.length} of {keys.length}. Changes appear live across the site after saving.</p>
      <ul className="space-y-3">{shown.map((k) => <ContentRow key={k} k={k} row={over[k]} onDone={done} />)}</ul>
    </Panel>
  );
}
function ContentRow({ k, row, onDone }: { k: string; row?: Row; onDone: () => void }) {
  const def = DICT[k] ?? { en: "", ur: "" };
  const [en, setEn] = useState(row?.en ?? def.en);
  const [ur, setUr] = useState(row?.ur ?? def.ur);
  const [preview, setPreview] = useState(false);
  useEffect(() => { setEn(row?.en ?? def.en); setUr(row?.ur ?? def.ur); }, [row]); // eslint-disable-line react-hooks/exhaustive-deps
  const long = (def.en.length > 60) || en.length > 60;
  const I = long ? "textarea" : "input";
  return (
    <li className={cn("rounded-xl border p-3", row ? "border-primary/40" : "border-border")}>
      <div className="mb-1 flex items-center justify-between gap-2"><code className="text-[11px] text-muted-foreground">{k}</code>{row && <span className="text-[10px] font-semibold text-primary">EDITED</span>}</div>
      <div className="grid gap-2 md:grid-cols-2">
        <I value={en} onChange={(e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setEn(e.target.value)} className={long ? areaCls : inputCls} />
        <I value={ur} dir="rtl" onChange={(e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setUr(e.target.value)} className={long ? areaCls : inputCls} />
      </div>
      {preview && <div className="mt-2 grid gap-2 rounded-lg bg-secondary p-2 text-sm md:grid-cols-2"><div className="whitespace-pre-line">{en}</div><div dir="rtl" className="whitespace-pre-line">{ur}</div></div>}
      <div className="mt-2 flex gap-2">
        <Btn className="h-8" onClick={async () => { if (await run(db.from("content").upsert({ key: k, en, ur, updated_at: new Date().toISOString() }), "Saved")) onDone(); }}>Save</Btn>
        <Btn variant="ghost" className="h-8" onClick={() => setPreview(!preview)}>Preview</Btn>
        {row && DICT[k] && <Btn variant="ghost" className="h-8" onClick={async () => { if (await run(db.from("content").delete().eq("key", k), "Restored default")) onDone(); }}><RotateCcw className="h-3.5 w-3.5" />Restore default</Btn>}
      </div>
    </li>
  );
}

function Shot({ path }: { path: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => { signedUrl(path).then(setUrl); }, [path]);
  if (!url) return null;
  return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Screenshot" className="h-14 w-14 rounded-lg border border-border object-cover" /></a>;
}

/* ---------------- Admin security ---------------- */
export function SecurityMod() {
  const [cur, setCur] = useState(""); const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [busy, setBusy] = useState(false);
  const save = async () => {
    if (pw.length < 8) return toast.error("Password must be at least 8 characters");
    if (pw !== pw2) return toast.error("Passwords do not match");
    if (!cur) return toast.error("Enter your current password");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw, current_password: cur } as never);
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    await supabase.rpc("clear_must_change");
    setCur(""); setPw(""); setPw2(""); toast.success("Admin password changed. The old password no longer works.");
  };
  const reset = async () => {
    if (!confirmDo("Reset ALL stats? This clears every game round, transaction, coin request and withdrawal, and sets every balance to 0. This cannot be undone.")) return;
    await run(db.rpc("admin_reset_stats"), "All stats reset to 0");
  };
  return (
    <>
      <Panel title="Change admin password">
        <div className="grid max-w-md gap-3">
          <Field label="Current password"><input type="password" value={cur} onChange={(e) => setCur(e.target.value)} className={inputCls} /></Field>
          <Field label="New password"><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} /></Field>
          <Field label="Confirm new password"><input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={inputCls} /></Field>
          <Btn disabled={busy} onClick={save}>Save new password</Btn>
        </div>
      </Panel>
      <Panel title="Fresh start">
        <p className="mb-2 text-sm text-muted-foreground">Set all stats, balances and history back to 0 like a brand-new website. Users, games, banners and texts are kept.</p>
        <Btn variant="danger" onClick={reset}>Reset all stats to 0</Btn>
      </Panel>
    </>
  );
}
