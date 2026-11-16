import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DICT } from "./i18n-dict";
import type { Session } from "@supabase/supabase-js";

export type Profile = {
  id: string; uid: string; phone: string; username: string; avatar: number; balance: number;
  status: string; must_change_password: boolean; created_at: string;
  wager_required?: number; wager_done?: number;
};
type Lang = "en" | "ur";
type Prefs = { sound: boolean; notifications: boolean; animations: boolean };

type Ctx = {
  session: Session | null; ready: boolean; profile: Profile | null; isAdmin: boolean;
  setBalance: (b: number) => void; refreshProfile: () => void;
  lang: Lang; setLang: (l: Lang) => void; t: (k: string, vars?: Record<string, string | number>) => string;
  prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void;
  settings: Record<string, any>;
};
const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [lang, setLangState] = useState<Lang>("en");
  const [prefs, setPrefsState] = useState<Prefs>({ sound: true, notifications: true, animations: true });

  useEffect(() => {
    const l = localStorage.getItem("sz_lang") as Lang | null;
    if (l) setLangState(l);
    try { const p = JSON.parse(localStorage.getItem("sz_prefs") || "null"); if (p) setPrefsState(p); } catch { /* ignore */ }
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_OUT") { qc.clear(); }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") qc.invalidateQueries({ queryKey: ["profile"] });
    });
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ur" ? "rtl" : "ltr";
  }, [lang]);
  useEffect(() => { document.documentElement.classList.toggle("reduce-motion", !prefs.animations); }, [prefs.animations]);

  const uid = session?.user.id;
  const { data: profile } = useQuery({
    queryKey: ["profile", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", uid!).maybeSingle();
      return (data as Profile) ?? null;
    },
  });
  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: uid!, _role: "admin" });
      return !!data;
    },
  });
  const { data: content } = useQuery({
    queryKey: ["content"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("content").select("key,en,ur");
      const m: Record<string, { en: string; ur: string }> = {};
      (data ?? []).forEach((r) => (m[r.key] = { en: r.en, ur: r.ur }));
      return m;
    },
  });
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("key,value");
      const m: Record<string, any> = {};
      (data ?? []).forEach((r) => (m[r.key] = r.value));
      return m;
    },
  });

  // presence heartbeat
  useEffect(() => {
    if (!uid) return;
    supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", uid).then(() => {});
  }, [uid]);

  const t = useCallback((k: string, vars?: Record<string, string | number>) => {
    const o = content?.[k]; const d = DICT[k];
    let s = (lang === "ur" ? (o?.ur || d?.ur) : undefined) || o?.en || d?.en || k;
    if (vars) for (const [a, b] of Object.entries(vars)) s = s.replace(`{${a}}`, String(b));
    return s;
  }, [content, lang]);

  const value = useMemo<Ctx>(() => ({
    session, ready, profile: profile ?? null, isAdmin: !!isAdmin,
    setBalance: (b) => qc.setQueryData(["profile", uid], (p: Profile | null | undefined) => (p ? { ...p, balance: b } : p)),
    refreshProfile: () => qc.invalidateQueries({ queryKey: ["profile", uid] }),
    lang, setLang: (l) => { localStorage.setItem("sz_lang", l); setLangState(l); },
    t, prefs, setPrefs: (p) => setPrefsState((old) => { const n = { ...old, ...p }; localStorage.setItem("sz_prefs", JSON.stringify(n)); return n; }),
    settings: settings ?? {},
  }), [session, ready, profile, isAdmin, qc, uid, lang, t, prefs, settings]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
}

export function errMsg(e: unknown) {
  const m = (e as { message?: string })?.message || "Something went wrong";
  return m.replace(/^.*?ERROR:\s*/, "");
}

export async function signOut(qc: ReturnType<typeof useQueryClient>) {
  await qc.cancelQueries();
  qc.clear();
  sessionStorage.removeItem("sz_popups");
  await supabase.auth.signOut();
}
