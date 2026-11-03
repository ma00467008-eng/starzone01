import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, Loader2, Phone, Lock, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { loginUser, registerUser, recoverPassword } from "@/lib/auth.functions";
import { CaptchaDialog } from "@/components/sz/Captcha";
import { Logo } from "@/components/sz/bits";
import { useApp, errMsg } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Log in or Register — STAR ZONE" },
      { name: "description", content: "Create your free STAR ZONE account with your phone number and start playing with virtual coins." },
      { property: "og:title", content: "Log in or Register — STAR ZONE" },
      { property: "og:description", content: "Create your free STAR ZONE account." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { ref?: string } => (typeof s.ref === "string" && s.ref ? { ref: s.ref } : {}),
  component: AuthPage,
});

type Mode = "login" | "register" | "recover";

function Field({ icon: Icon, type = "text", value, onChange, placeholder, toggle }: { icon: typeof Phone; type?: string; value: string; onChange: (v: string) => void; placeholder: string; toggle?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <label className="flex h-12 items-center gap-3 rounded-xl border border-input bg-card px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
      <Icon className="h-4.5 w-4.5 text-muted-foreground" />
      <input className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" type={toggle ? (show ? "text" : "password") : type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} inputMode={type === "tel" ? "tel" : undefined} />
      {toggle && <button type="button" onClick={() => setShow(!show)} className="text-muted-foreground" aria-label="Toggle password">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>}
    </label>
  );
}

function AuthPage() {
  const { t, settings } = useApp();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<Mode>(search.ref ? "register" : "login");
  const [ref, setRef] = useState(search.ref ?? "");
  const [phone, setPhone] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [code, setCode] = useState("");
  const [captcha, setCaptcha] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState<string | null>(null);
  const login = useServerFn(loginUser);
  const register = useServerFn(registerUser);
  const recover = useServerFn(recoverPassword);

  const start = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!phone.trim() || !pw) { toast.error(t("auth.phone") + " / " + t("auth.password")); return; }
    if (mode !== "login" && pw !== pw2) { toast.error(t("auth.mismatch")); return; }
    if (mode !== "login" && pw.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (mode === "recover" && !code.trim()) { toast.error(t("auth.recovery_code")); return; }
    setCaptcha(true);
  };

  const finish = async (captchaId: string) => {
    setCaptcha(false); setBusy(true);
    try {
      if (mode === "login") {
        const s = await login({ data: { phone, password: pw, captchaId } });
        await supabase.auth.setSession(s);
        sessionStorage.setItem("sz_popups", "pending");
        navigate({ to: "/", replace: true });
      } else if (mode === "register") {
        const r = await register({ data: { phone, password: pw, captchaId, ref } });
        if (r.access_token) await supabase.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token ?? "" });
        sessionStorage.setItem("sz_popups", "pending");
        setRecovery(r.recovery);
      } else {
        const r = await recover({ data: { phone, code, password: pw, captchaId } });
        toast.success("Password updated. Please log in.");
        setRecovery(r.recovery);
        setMode("login"); setPw(""); setPw2(""); setCode("");
      }
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const closed = settings["site"]?.registration_open === false;

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-10 pt-10">
        <div className="mb-8 text-center text-primary-foreground">
          <div className="mx-auto mb-4 inline-flex rounded-2xl bg-card px-4 py-2 shadow-card"><Logo /></div>
          <h1 className="font-display text-2xl font-extrabold">{t("auth.welcome")}</h1>
          <p className="mt-1 text-sm opacity-90">{t("auth.tagline")}</p>
        </div>
        <div className="rounded-3xl bg-card p-5 shadow-card animate-rise">
          {mode !== "recover" && (
            <div className="mb-5 grid grid-cols-2 rounded-xl bg-secondary p-1">
              {(["login", "register"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} className={`h-10 rounded-lg text-sm font-semibold transition ${mode === m ? "bg-card text-foreground shadow-card" : "text-muted-foreground"}`}>{t(`auth.${m}`)}</button>
              ))}
            </div>
          )}
          {mode === "recover" && <h2 className="mb-4 font-display text-lg font-bold">{t("auth.recover")}</h2>}
          {mode === "register" && closed ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Registration is currently closed.</p>
          ) : (
            <form onSubmit={start} className="space-y-3">
              <Field icon={Phone} type="tel" value={phone} onChange={setPhone} placeholder={t("auth.phone")} />
              {mode === "recover" && <Field icon={Lock} value={code} onChange={setCode} placeholder={t("auth.recovery_code")} />}
              <Field icon={Lock} toggle value={pw} onChange={setPw} placeholder={mode === "recover" ? t("auth.new_password") : t("auth.password")} />
              {mode !== "login" && <Field icon={Lock} toggle value={pw2} onChange={setPw2} placeholder={t("auth.confirm")} />}
              {mode === "register" && <Field icon={Gift} value={ref} onChange={setRef} placeholder={t("earn.invite_code_opt")} />}
              <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl bg-gradient-primary text-base font-semibold shadow-glow">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "login" ? t("auth.login") : mode === "register" ? t("auth.register") : t("auth.recover")}
              </Button>
            </form>
          )}
          <div className="mt-4 text-center text-sm">
            {mode === "login" && <button onClick={() => setMode("recover")} className="font-medium text-primary-deep">{t("auth.forgot")}</button>}
            {mode === "recover" && <button onClick={() => setMode("login")} className="font-medium text-primary-deep">{t("common.back")}</button>}
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-primary-foreground/90">{t("virtual.note")}</p>
      </div>
      <CaptchaDialog open={captcha} onClose={() => setCaptcha(false)} onPassed={finish} />
      <Dialog open={!!recovery} onOpenChange={(o) => { if (!o) { setRecovery(null); if (mode === "register") navigate({ to: "/", replace: true }); } }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">{t("auth.save_code")}</DialogTitle>
            <DialogDescription>{t("auth.save_code_desc")}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3 font-mono text-lg font-bold tracking-wider">
            {recovery}
            <button onClick={() => { navigator.clipboard?.writeText(recovery || ""); toast.success("Copied"); }} aria-label="Copy"><Copy className="h-4 w-4" /></button>
          </div>
          <Button className="w-full bg-gradient-primary" onClick={() => { setRecovery(null); if (mode === "register") navigate({ to: "/", replace: true }); }}>{t("auth.continue")}</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
