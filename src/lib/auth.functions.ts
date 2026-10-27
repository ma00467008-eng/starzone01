import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const PHONE_RE = /^0?3\d{9}$|^\+?\d{10,15}$/;
export const phoneToEmail = (phone: string) => `${phone.replace(/\D/g, "")}@phone.starzone.app`;

function normPhone(p: string) {
  const v = (p || "").trim().replace(/[\s-]/g, "");
  if (!PHONE_RE.test(v)) throw new Error("Enter a valid phone number");
  return v.replace(/^\+/, "");
}
function checkPassword(p: string) {
  if (!p || p.length < 6 || p.length > 72) throw new Error("Password must be 6-72 characters");
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function consumeCaptcha(id: string) {
  const db = await admin();
  const { data } = await db.from("captcha_challenges").select("*").eq("id", id).maybeSingle();
  if (!data || !data.passed_at || data.consumed) throw new Error("Please complete the puzzle verification");
  if (Date.now() - new Date(data.passed_at).getTime() > 3 * 60 * 1000) throw new Error("Verification expired, try again");
  await db.from("captcha_challenges").update({ consumed: true }).eq("id", id);
}

export const getCaptcha = createServerFn({ method: "POST" }).handler(async () => {
  const db = await admin();
  const target_x = 110 + Math.floor(Math.random() * 140);
  const target_y = 15 + Math.floor(Math.random() * 85);
  const image = Math.floor(Math.random() * 6);
  const { data, error } = await db.from("captcha_challenges").insert({ target_x, target_y, image }).select("id").single();
  if (error) throw new Error("Could not create puzzle");
  // Position of the gap is necessarily visible in the image; the server validates the drag.
  return { id: data.id, y: target_y, x: target_x, image };
});

export const verifyCaptcha = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; x: number; trace: number[][]; duration: number }) => d)
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: c } = await db.from("captcha_challenges").select("*").eq("id", data.id).maybeSingle();
    if (!c || c.consumed || c.passed_at) return { ok: false };
    if (Date.now() - new Date(c.created_at).getTime() > 2 * 60 * 1000) return { ok: false, expired: true };
    if (c.attempts >= 3) return { ok: false, expired: true };
    const trace = Array.isArray(data.trace) ? data.trace.slice(0, 400) : [];
    const ys = trace.map((p) => Number(p[1]) || 0);
    const yVar = ys.length ? Math.max(...ys) - Math.min(...ys) : 0;
    const human = trace.length >= 6 && data.duration >= 250 && data.duration < 30000 && yVar >= 0;
    const ok = human && Math.abs(Number(data.x) - c.target_x) <= 6;
    await db.from("captcha_challenges").update({ attempts: c.attempts + 1, passed_at: ok ? new Date().toISOString() : null }).eq("id", c.id);
    return { ok, expired: !ok && c.attempts + 1 >= 3 };
  });

function randomRecovery() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(b, (x) => chars[x % chars.length]).join("").replace(/(.{4})/g, "$1-").slice(0, 14);
}

export const registerUser = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string; password: string; captchaId: string }) => d)
  .handler(async ({ data }) => {
    const phone = normPhone(data.phone);
    checkPassword(data.password);
    const db = await admin();
    const { data: site } = await db.from("site_settings").select("value").eq("key", "site").maybeSingle();
    if ((site?.value as { registration_open?: boolean } | null)?.registration_open === false)
      throw new Error("Registration is currently closed");
    const { data: existing } = await db.from("profiles").select("id").eq("phone", phone).maybeSingle();
    if (existing) throw new Error("This phone number is already registered");
    await consumeCaptcha(data.captchaId);
    const { data: created, error } = await db.auth.admin.createUser({
      email: phoneToEmail(phone),
      password: data.password,
      email_confirm: true,
      app_metadata: { starzone: "true", phone },
    });
    if (error || !created.user) throw new Error(error?.message?.includes("already") ? "This phone number is already registered" : "Registration failed");
    const recovery = randomRecovery();
    await db.from("user_secrets").insert({ user_id: created.user.id, recovery_hash: await sha256(recovery.replace(/-/g, "")) });
    const session = await signIn(phone, data.password);
    return { ...session, recovery };
  });

async function signIn(phone: string, password: string) {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await client.auth.signInWithPassword({ email: phoneToEmail(phone), password });
  if (error || !data.session) return null;
  return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
}

export const loginUser = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string; password: string; captchaId: string }) => d)
  .handler(async ({ data }) => {
    const phone = normPhone(data.phone);
    const db = await admin();
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await db.from("login_attempts").select("id", { count: "exact", head: true }).eq("phone", phone).eq("success", false).gte("created_at", since);
    if ((count ?? 0) >= 5) throw new Error("Too many failed attempts. Try again in 15 minutes.");
    await consumeCaptcha(data.captchaId);
    const session = await signIn(phone, data.password);
    await db.from("login_attempts").insert({ phone, success: !!session });
    if (!session) throw new Error("Incorrect phone number or password");
    const { data: prof } = await db.from("profiles").select("status").eq("phone", phone).maybeSingle();
    if (prof?.status === "suspended") throw new Error("This account is suspended. Contact support.");
    return session;
  });

export const recoverPassword = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string; code: string; password: string; captchaId: string }) => d)
  .handler(async ({ data }) => {
    const phone = normPhone(data.phone);
    checkPassword(data.password);
    const db = await admin();
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await db.from("login_attempts").select("id", { count: "exact", head: true }).eq("phone", phone).eq("success", false).gte("created_at", since);
    if ((count ?? 0) >= 5) throw new Error("Too many failed attempts. Try again in 15 minutes.");
    await consumeCaptcha(data.captchaId);
    const { data: prof } = await db.from("profiles").select("id").eq("phone", phone).maybeSingle();
    const { data: sec } = prof ? await db.from("user_secrets").select("recovery_hash").eq("user_id", prof.id).maybeSingle() : { data: null };
    const hash = await sha256((data.code || "").toUpperCase().replace(/[^A-Z0-9]/g, ""));
    if (!prof || !sec || sec.recovery_hash !== hash) {
      await db.from("login_attempts").insert({ phone, success: false });
      throw new Error("Phone number or recovery code is incorrect");
    }
    await db.auth.admin.updateUserById(prof.id, { password: data.password });
    const recovery = randomRecovery();
    await db.from("user_secrets").update({ recovery_hash: await sha256(recovery.replace(/-/g, "")) }).eq("user_id", prof.id);
    return { ok: true, recovery };
  });
