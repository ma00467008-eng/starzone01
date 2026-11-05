import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/** Shows enabled login pop-ups one after another, once per login session. */
export function LoginPopups() {
  const { session, t } = useApp();
  const [idx, setIdx] = useState(-1);
  const [dont, setDont] = useState(false);
  const { data: items } = useQuery({
    queryKey: ["popups"],
    enabled: !!session,
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase.from("media_items").select("*").eq("kind", "popup").eq("enabled", true).order("sort");
      return (data ?? []).filter((m) => (!m.starts_at || m.starts_at <= now) && (!m.ends_at || m.ends_at >= now));
    },
  });
  useEffect(() => {
    if (!session || !items?.length) return;
    if (sessionStorage.getItem("sz_popups") === session.user.id) return;
    sessionStorage.setItem("sz_popups", session.user.id);
    setIdx(0);
  }, [session, items]);
  const cur = items?.[idx];
  const close = () => {
    if (dont || !items || idx + 1 >= items.length) setIdx(-1);
    else setIdx(idx + 1);
  };
  if (!cur) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="w-[86vw] max-w-[340px] overflow-hidden rounded-3xl border-0 bg-card p-0 [&>button]:hidden">
        <DialogTitle className="sr-only">{cur.title || "Promotion"}</DialogTitle>
        <button onClick={close} aria-label={t("common.close")} className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-foreground/60 text-background"><X className="h-4 w-4" /></button>
        {cur.link ? <a href={cur.link} target="_blank" rel="noreferrer"><img src={cur.image_url} alt={cur.title ?? ""} className="aspect-[3/4] w-full object-cover" /></a> : <img src={cur.image_url} alt={cur.title ?? ""} className="aspect-[3/4] w-full object-cover" />}
        <div className="flex items-center justify-between px-4 py-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={dont} onChange={(e) => setDont(e.target.checked)} className="accent-primary" /> {t("popup.dont_remind")}
          </label>
          <span className="text-xs text-muted-foreground">{idx + 1}/{items?.length}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Forces the first-login password change (e.g. initial admin credentials). */
export function MustChangePassword() {
  const { profile, t, refreshProfile } = useApp();
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  if (!profile?.must_change_password) return null;
  const save = async () => {
    setErr("");
    if (pw.length < 6) return setErr("Password must be at least 6 characters");
    if (pw !== pw2) return setErr(t("auth.mismatch"));
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (!error) await supabase.rpc("clear_must_change");
    setBusy(false);
    if (error) return setErr(error.message);
    refreshProfile();
  };
  return (
    <Dialog open>
      <DialogContent className="max-w-sm [&>button]:hidden">
        <DialogTitle>{t("acc.change_password")}</DialogTitle>
        <p className="text-sm text-muted-foreground">{t("acc.must_change")}</p>
        <input type="password" placeholder={t("auth.new_password")} value={pw} onChange={(e) => setPw(e.target.value)} className="h-11 rounded-xl border border-input bg-background px-3" />
        <input type="password" placeholder={t("auth.confirm")} value={pw2} onChange={(e) => setPw2(e.target.value)} className="h-11 rounded-xl border border-input bg-background px-3" />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <button disabled={busy} onClick={save} className="h-11 rounded-xl bg-gradient-primary font-bold text-primary-foreground disabled:opacity-50">{t("common.save")}</button>
      </DialogContent>
    </Dialog>
  );
}
