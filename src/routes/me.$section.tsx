import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, signOut, useApp } from "@/lib/app-context";
import { phoneToEmail } from "@/lib/auth.functions";
import { uploadFile } from "@/lib/media";
import { fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { AppShell, Card, PrimaryButton, RequireLogin, Spinner } from "@/components/sz/shell";
import { Avatar, Empty, StatusPill } from "@/components/sz/bits";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/me/$section")({
  head: ({ params }) => ({ meta: [
    { title: `${params.section[0]?.toUpperCase()}${params.section.slice(1)} — STAR ZONE` },
    { name: "description", content: "Manage your STAR ZONE account." },
    { property: "og:title", content: "STAR ZONE Account" },
    { property: "og:description", content: "Manage your STAR ZONE account." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: SectionPage,
});

const TITLES: Record<string, string> = { notifications: "acc.notifications", history: "acc.history", stats: "acc.stats", transactions: "acc.transactions", security: "acc.security", support: "acc.support", gift: "acc.gift", language: "acc.language", settings: "acc.settings" };

function SectionPage() {
  const { section } = Route.useParams();
  const { t } = useApp();
  const C = { notifications: Notifications, history: History, stats: Stats, transactions: Transactions, security: Security, support: Support, gift: GiftPage, language: Language, settings: SettingsPage }[section];
  return (
    <AppShell title={t(TITLES[section] ?? "nav.account")} back="/account">
      {C ? (section === "language" || section === "settings" ? <C /> : <RequireLogin><C /></RequireLogin>) : <Empty />}
    </AppShell>
  );
}

function Notifications() {
  const { t, session } = useApp();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifs", session?.user.id],
    queryFn: async () => {
      const [{ data: n }, { data: r }] = await Promise.all([
        supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("notification_reads").select("notification_id"),
      ]);
      const read = new Set((r ?? []).map((x) => x.notification_id));
      return (n ?? []).map((x) => ({ ...x, read: read.has(x.id) }));
    },
  });
  const markAll = async () => {
    const rows = (data ?? []).filter((n) => !n.read).map((n) => ({ user_id: session!.user.id, notification_id: n.id }));
    if (rows.length) await supabase.from("notification_reads").upsert(rows);
    qc.invalidateQueries({ queryKey: ["notifs"] }); qc.invalidateQueries({ queryKey: ["notif-unread"] });
  };
  useEffect(() => { if (data?.some((n) => !n.read)) { const id = setTimeout(markAll, 2500); return () => clearTimeout(id); } return undefined; }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (isLoading) return <Spinner />;
  if (!data?.length) return <Empty />;
  return (
    <div className="space-y-2">
      <div className="text-right"><button onClick={markAll} className="text-xs font-semibold text-primary-deep">{t("notif.mark_read")}</button></div>
      {data.map((n) => (
        <Card key={n.id} className={cn("border-s-4", n.read ? "border-transparent" : "border-primary")}>
          <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{n.title}</h3><span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase text-secondary-foreground">{n.kind}</span></div>
          <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{n.body}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
        </Card>
      ))}
    </div>
  );
}

function useAllRounds() {
  const { session } = useApp();
  return useQuery({ queryKey: ["all-rounds", session?.user.id], queryFn: async () => (await supabase.from("game_rounds").select("*").order("created_at", { ascending: false }).limit(1000)).data ?? [] });
}

function History() {
  const { t } = useApp();
  const { data, isLoading } = useAllRounds();
  const [game, setGame] = useState("all");
  const games = useMemo(() => Array.from(new Set((data ?? []).map((r) => r.game))), [data]);
  if (isLoading) return <Spinner />;
  const rows = (data ?? []).filter((r) => game === "all" || r.game === game).slice(0, 200);
  return (
    <div className="space-y-3">
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {["all", ...games].map((g) => <button key={g} onClick={() => setGame(g)} className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold capitalize", g === game ? "bg-gradient-primary text-primary-foreground" : "bg-card shadow-card")}>{g}</button>)}
      </div>
      {!rows.length ? <Empty /> : rows.map((r) => {
        const net = r.payout - r.stake;
        return (
          <Card key={r.id} className="flex items-center justify-between py-3">
            <div>
              <div className="text-sm font-semibold capitalize">{r.game}</div>
              <div className="font-mono text-[11px] text-muted-foreground">{r.round_code}</div>
              <div className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
            </div>
            <div className="text-right text-xs">
              <div>{t("game.stake")}: <b className="tabular-nums">{fmt(r.stake)}</b></div>
              <div className={cn("text-sm font-bold tabular-nums", r.payout > 0 ? "text-success" : "text-destructive")}>{r.payout > 0 ? `${t("game.win")} +${fmt(r.payout)}` : `-${fmt(r.stake)}`}</div>
              <div className="text-muted-foreground">{net >= 0 ? "+" : ""}{fmt(net)}</div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function Stats() {
  const { t } = useApp();
  const { data, isLoading } = useAllRounds();
  if (isLoading) return <Spinner />;
  const rows = data ?? [];
  const sum = (a: typeof rows) => {
    const wins = a.filter((r) => r.payout > r.stake);
    return { n: a.length, won: a.reduce((s, r) => s + Math.max(0, r.payout - r.stake), 0), lost: a.reduce((s, r) => s + Math.max(0, r.stake - r.payout), 0), rate: a.length ? Math.round((wins.length / a.length) * 100) : 0 };
  };
  const all = sum(rows);
  const by = Array.from(new Set(rows.map((r) => r.game))).map((g) => ({ g, ...sum(rows.filter((r) => r.game === g)) }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[["stats.played", fmt(all.n)], ["stats.rate", `${all.rate}%`], ["stats.won", `+${fmt(all.won)}`], ["stats.lost", `-${fmt(all.lost)}`]].map(([k, v]) => (
          <Card key={k}><div className="text-xs text-muted-foreground">{t(k!)}</div><div className="font-display text-xl font-bold tabular-nums">{v}</div></Card>
        ))}
      </div>
      <Card>
        <h3 className="mb-2 font-display font-bold">{t("stats.by_game")}</h3>
        {!by.length ? <Empty /> : (
          <table className="w-full text-xs"><thead className="text-muted-foreground"><tr><th className="py-1 text-start">{t("game.name")}</th><th>#</th><th>{t("stats.rate")}</th><th className="text-end">Net</th></tr></thead>
            <tbody>{by.map((b) => <tr key={b.g} className="border-t border-border"><td className="py-2 capitalize">{b.g}</td><td className="text-center">{b.n}</td><td className="text-center">{b.rate}%</td><td className={cn("text-end font-bold tabular-nums", b.won - b.lost >= 0 ? "text-success" : "text-destructive")}>{fmt(b.won - b.lost)}</td></tr>)}</tbody></table>
        )}
      </Card>
    </div>
  );
}

function Transactions() {
  const { session } = useApp();
  const { data, isLoading } = useQuery({ queryKey: ["tx", session?.user.id], queryFn: async () => (await supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [] });
  if (isLoading) return <Spinner />;
  if (!data?.length) return <Empty />;
  return (
    <Card className="p-0"><ul className="divide-y divide-border text-sm">
      {data.map((x) => (
        <li key={x.id} className="flex items-center justify-between px-4 py-3">
          <div><div className="font-medium capitalize">{x.kind.replace(/_/g, " ")}</div><div className="text-[11px] text-muted-foreground">{x.note || x.ref} · {new Date(x.created_at).toLocaleString()}</div></div>
          <div className="text-right"><div className={cn("font-bold tabular-nums", x.amount >= 0 ? "text-success" : "text-destructive")}>{x.amount >= 0 ? "+" : ""}{fmt(x.amount)}</div><div className="text-[11px] text-muted-foreground tabular-nums">{fmt(x.balance_after)}</div></div>
        </li>
      ))}
    </ul></Card>
  );
}

export function PasswordForm({ onDone }: { onDone?: () => void }) {
  const { t, profile } = useApp();
  const [cur, setCur] = useState(""); const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [busy, setBusy] = useState(false);
  const save = async () => {
    if (pw.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (pw !== pw2) { toast.error(t("auth.mismatch")); return; }
    setBusy(true);
    try {
      const { error: e1 } = await supabase.auth.signInWithPassword({ email: phoneToEmail(profile!.phone), password: cur });
      if (e1) throw new Error("Current password is incorrect");
      const { error } = await supabase.auth.updateUser({ password: pw, current_password: cur } as never);
      if (error) throw error;
      await supabase.rpc("clear_must_change");
      toast.success(t("acc.password_changed")); setCur(""); setPw(""); setPw2(""); onDone?.();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const inp = "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary";
  return (
    <div className="space-y-2">
      <input type="password" placeholder={t("acc.current_password")} value={cur} onChange={(e) => setCur(e.target.value)} className={inp} />
      <input type="password" placeholder={t("auth.new_password")} value={pw} onChange={(e) => setPw(e.target.value)} className={inp} />
      <input type="password" placeholder={t("auth.confirm")} value={pw2} onChange={(e) => setPw2(e.target.value)} className={inp} />
      <PrimaryButton onClick={save} loading={busy}>{t("acc.change_password")}</PrimaryButton>
    </div>
  );
}

function Security() {
  const { t, profile, refreshProfile } = useApp();
  const [name, setName] = useState(profile?.username ?? "");
  const [av, setAv] = useState(profile?.avatar ?? 1);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient(); const nav = useNavigate();
  useEffect(() => { if (profile) { setName(profile.username); setAv(profile.avatar); } }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    const n = name.trim();
    if (!/^[\p{L}\p{N}_ ]{3,20}$/u.test(n)) { toast.error("Username must be 3–20 letters or numbers"); return; }
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ username: n, avatar: av }).eq("id", profile!.id);
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success(t("common.saved")); refreshProfile();
  };
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h3 className="font-display font-bold">{t("acc.profile")}</h3>
        <div className="text-xs text-muted-foreground">{t("acc.uid")}: <b className="font-mono text-foreground">{profile?.uid}</b> · {profile?.phone}</div>
        <div className="text-xs text-muted-foreground">{t("acc.avatar")}</div>
        <div className="grid grid-cols-8 gap-2">
          {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => <button key={n} onClick={() => setAv(n)} className={cn("rounded-full ring-2 ring-offset-2", av === n ? "ring-primary" : "ring-transparent")}><Avatar n={n} name={name} className="aspect-square w-full text-sm" /></button>)}
        </div>
        <label className="block text-xs text-muted-foreground">{t("acc.username")}<input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary" /></label>
        <PrimaryButton onClick={save} loading={busy}>{t("common.save")}</PrimaryButton>
      </Card>
      <Card className="space-y-3"><h3 className="font-display font-bold">{t("acc.change_password")}</h3><PasswordForm /></Card>
      <button onClick={async () => { await signOut(qc); nav({ to: "/auth" }); }} className="w-full rounded-2xl bg-card py-3 text-sm font-semibold text-destructive shadow-card">{t("acc.logout")}</button>
    </div>
  );
}

function Support() {
  const { t, lang, session } = useApp();
  const qc = useQueryClient();
  const [form, setForm] = useState(false);
  const [subject, setSubject] = useState(""); const [desc, setDesc] = useState(""); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false);
  const [openT, setOpenT] = useState<string | null>(null);
  const { data: faqs } = useQuery({ queryKey: ["faqs"], queryFn: async () => (await supabase.from("faqs").select("*").order("sort")).data ?? [] });
  const { data: tickets } = useQuery({ queryKey: ["tickets", session?.user.id], queryFn: async () => (await supabase.from("tickets").select("*, ticket_replies(*)").order("created_at", { ascending: false })).data ?? [] });
  const create = async () => {
    if (subject.trim().length < 3 || desc.trim().length < 5) { toast.error("Please fill subject and description"); return; }
    setBusy(true);
    try {
      const image_path = file ? await uploadFile(session!.user.id, file) : null;
      const { error } = await supabase.from("tickets").insert({ user_id: session!.user.id, subject: subject.trim().slice(0, 120), description: desc.trim().slice(0, 2000), image_path });
      if (error) throw error;
      toast.success(t("support.sent")); setForm(false); setSubject(""); setDesc(""); setFile(null);
      qc.invalidateQueries({ queryKey: ["tickets"] });
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="mb-1 font-display font-bold">{t("support.faq")}</h3>
        {!faqs?.length ? <Empty /> : (
          <Accordion type="single" collapsible>
            {faqs.map((f) => <AccordionItem key={f.id} value={f.id}><AccordionTrigger className="text-start text-sm">{(lang === "ur" && f.question_ur) || f.question_en}</AccordionTrigger><AccordionContent className="whitespace-pre-line text-sm text-muted-foreground">{(lang === "ur" && f.answer_ur) || f.answer_en}</AccordionContent></AccordionItem>)}
          </Accordion>
        )}
      </Card>
      <Card className="space-y-3">
        <div className="flex items-center justify-between"><span className="text-sm font-semibold">{t("support.not_helpful")}</span><button onClick={() => setForm(!form)} className="rounded-full bg-gradient-primary px-4 py-1.5 text-xs font-bold text-primary-foreground">{t("support.create")}</button></div>
        {form && (
          <div className="space-y-2">
            <input placeholder={t("support.subject")} value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none" />
            <textarea placeholder={t("support.description")} value={desc} maxLength={2000} rows={4} onChange={(e) => setDesc(e.target.value)} className="w-full rounded-xl border border-input bg-background p-3 text-sm outline-none" />
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-xs" />
            <PrimaryButton onClick={create} loading={busy}>{t("common.submit")}</PrimaryButton>
          </div>
        )}
      </Card>
      <Card>
        <h3 className="mb-2 font-display font-bold">{t("support.my_tickets")}</h3>
        {!tickets?.length ? <Empty /> : tickets.map((tk) => (
          <div key={tk.id} className="border-t border-border py-2 first:border-0">
            <button onClick={() => setOpenT(openT === tk.id ? null : tk.id)} className="flex w-full items-center justify-between text-start"><span className="text-sm font-medium">{tk.subject}</span><StatusPill s={tk.status} /></button>
            {openT === tk.id && <TicketThread ticket={tk} />}
          </div>
        ))}
      </Card>
    </div>
  );
}

export function TicketThread({ ticket, as = "user" }: { ticket: { id: string; description: string; status: string; ticket_replies: { id: number; sender: string; body: string; created_at: string | null }[] }; as?: "user" | "admin" }) {
  const { t } = useApp();
  const qc = useQueryClient();
  const [body, setBody] = useState(""); const [busy, setBusy] = useState(false);
  const reply = async () => {
    if (!body.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("ticket_replies").insert({ ticket_id: ticket.id, sender: as, body: body.trim().slice(0, 2000) });
    if (!error && as === "admin" && ticket.status === "pending") await supabase.from("tickets").update({ status: "open", updated_at: new Date().toISOString() }).eq("id", ticket.id);
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    setBody(""); qc.invalidateQueries({ queryKey: ["tickets"] }); qc.invalidateQueries({ queryKey: ["admin-tickets"] });
  };
  const replies = [...(ticket.ticket_replies ?? [])].sort((a, b) => a.id - b.id);
  return (
    <div className="mt-2 space-y-2 rounded-xl bg-secondary/40 p-3 text-sm">
      <p className="whitespace-pre-line text-muted-foreground">{ticket.description}</p>
      {replies.map((r) => <div key={r.id} className={cn("rounded-lg p-2", r.sender === "admin" ? "bg-card" : "bg-secondary")}><b className="text-xs capitalize">{r.sender}</b><p className="whitespace-pre-line">{r.body}</p></div>)}
      {ticket.status !== "closed" && (
        <div className="flex gap-2"><input value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("support.reply")} className="h-10 flex-1 rounded-lg border border-input bg-background px-3 outline-none" /><button disabled={busy} onClick={reply} className="rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground">{t("chat.send")}</button></div>
      )}
    </div>
  );
}

function GiftPage() {
  const { t, setBalance } = useApp();
  const [code, setCode] = useState(""); const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const { data: pub } = useQuery({ queryKey: ["public-codes"], queryFn: async () => (await supabase.from("gift_codes").select("code,reward,description,expires_at").eq("is_public", true).eq("active", true)).data ?? [] });
  const redeem = async (c = code) => {
    if (!c.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("redeem_gift", { _code: c.trim() });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    const r = data as { reward: number; balance: number };
    setBalance(r.balance); toast.success(`${t("gift.done")} +${fmt(r.reward)}`); setCode("");
    qc.invalidateQueries({ queryKey: ["tx"] });
  };
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h3 className="font-display font-bold">{t("gift.title")}</h3>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t("gift.placeholder")} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-center font-mono text-lg tracking-widest outline-none focus:border-primary" />
        <PrimaryButton onClick={() => redeem()} loading={busy}>{t("gift.redeem")}</PrimaryButton>
      </Card>
      {!!pub?.length && (
        <Card><h3 className="mb-2 font-display font-bold">{t("gift.available")}</h3>
          {pub.map((g) => <div key={g.code} className="flex items-center justify-between border-t border-border py-2 first:border-0"><div><div className="font-mono font-bold">{g.code}</div><div className="text-xs text-muted-foreground">{g.description} · +{fmt(g.reward)}</div></div><button onClick={() => redeem(g.code)} className="rounded-full bg-gradient-primary px-3 py-1 text-xs font-bold text-primary-foreground">{t("gift.redeem")}</button></div>)}
        </Card>
      )}
    </div>
  );
}

function Language() {
  const { lang, setLang } = useApp();
  return (
    <div className="space-y-2">
      {([["en", "English"], ["ur", "اردو (Urdu)"]] as const).map(([l, n]) => (
        <button key={l} onClick={() => setLang(l)} className={cn("flex w-full items-center justify-between rounded-2xl bg-card p-4 shadow-card", lang === l && "ring-2 ring-primary")}><span className="font-semibold">{n}</span>{lang === l && <span className="text-primary-deep">✓</span>}</button>
      ))}
    </div>
  );
}

function SettingsPage() {
  const { t, prefs, setPrefs, session } = useApp();
  const qc = useQueryClient(); const nav = useNavigate();
  const [show, setShow] = useState<"privacy" | "terms" | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="space-y-4">
      <Card className="divide-y divide-border p-0">
        {(["sound", "notifications", "animations"] as const).map((k) => (
          <label key={k} className="flex items-center justify-between px-4 py-3.5"><span className="text-sm font-medium">{t(`settings.${k}`)}</span><Switch checked={prefs[k]} onCheckedChange={(v) => setPrefs({ [k]: v })} /></label>
        ))}
        <button onClick={() => nav({ to: "/me/$section", params: { section: "language" } })} className="flex w-full justify-between px-4 py-3.5 text-sm font-medium"><span>{t("settings.language")}</span><span>›</span></button>
        <button onClick={() => setShow(show === "privacy" ? null : "privacy")} className="flex w-full justify-between px-4 py-3.5 text-sm font-medium"><span>{t("settings.privacy")}</span><span>›</span></button>
        <button onClick={() => setShow(show === "terms" ? null : "terms")} className="flex w-full justify-between px-4 py-3.5 text-sm font-medium"><span>{t("settings.terms")}</span><span>›</span></button>
      </Card>
      {show && <Card><div ref={ref} className="whitespace-pre-line text-sm text-muted-foreground">{t(`settings.${show}_text`)}</div></Card>}
      {session && <button onClick={async () => { await signOut(qc); nav({ to: "/auth" }); }} className="w-full rounded-2xl bg-card py-3 text-sm font-semibold text-destructive shadow-card">{t("acc.logout")}</button>}
    </div>
  );
}
