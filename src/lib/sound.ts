let ctx: AudioContext | null = null;
export function beep(kind: "click" | "win" | "lose" | "tick" = "click") {
  try {
    const prefs = JSON.parse(localStorage.getItem("sz_prefs") || "{}");
    if (prefs.sound === false) return;
    ctx = ctx || new AudioContext();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    const map = { click: [520, 0.05], tick: [880, 0.03], win: [660, 0.25], lose: [180, 0.3] } as const;
    const [f, d] = map[kind];
    o.frequency.value = f; o.type = kind === "lose" ? "sawtooth" : "sine";
    if (kind === "win") o.frequency.linearRampToValueAtTime(1100, ctx.currentTime + d);
    g.gain.setValueAtTime(0.08, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + d);
  } catch { /* ignore */ }
}
export const fmt = (n: number | null | undefined) => (Number(n) || 0).toLocaleString("en-US");
