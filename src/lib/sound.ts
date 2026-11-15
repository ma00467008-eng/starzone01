let ctx: AudioContext | null = null;
type Kind = "click" | "chip" | "bet" | "win" | "bigwin" | "lose" | "tick" | "flip" | "dragon" | "tiger" | "explode" | "step" | "cashout" | "gem" | "takeoff";

function ac() {
  try {
    const prefs = JSON.parse(localStorage.getItem("sz_prefs") || "{}");
    if (prefs.sound === false) return null;
    ctx = ctx || new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(c: AudioContext, f: number, start: number, dur: number, type: OscillatorType = "sine", vol = 0.08, endF?: number) {
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, c.currentTime + start);
  if (endF) o.frequency.exponentialRampToValueAtTime(endF, c.currentTime + start + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination); o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + 0.05);
}

function noise(c: AudioContext, start: number, dur: number, freq: number, q: number, vol = 0.2, endFreq?: number) {
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = "bandpass"; f.Q.value = q;
  f.frequency.setValueAtTime(freq, c.currentTime + start);
  if (endFreq) f.frequency.exponentialRampToValueAtTime(endFreq, c.currentTime + start + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + start + dur * 0.15);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  src.connect(f).connect(g).connect(c.destination); src.start(c.currentTime + start);
}

/** Growl: low sawtooth with tremolo + filtered noise breath. */
function growl(c: AudioContext, base: number, dur: number, vol: number) {
  const o = c.createOscillator(); o.type = "sawtooth";
  o.frequency.setValueAtTime(base * 1.3, c.currentTime);
  o.frequency.linearRampToValueAtTime(base * 0.75, c.currentTime + dur);
  const lfo = c.createOscillator(); lfo.frequency.value = 28; const lg = c.createGain(); lg.gain.value = vol * 0.6;
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  lfo.connect(lg).connect(g.gain);
  const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = base * 6;
  o.connect(f).connect(g).connect(c.destination);
  o.start(); lfo.start(); o.stop(c.currentTime + dur + 0.05); lfo.stop(c.currentTime + dur + 0.05);
  noise(c, 0, dur, base * 4, 1.2, vol * 1.4, base * 2);
}

export function beep(kind: Kind = "click") {
  const c = ac(); if (!c) return;
  switch (kind) {
    case "click": tone(c, 600, 0, 0.05, "triangle", 0.06); break;
    case "tick": tone(c, 1000, 0, 0.04, "square", 0.035); break;
    case "chip": noise(c, 0, 0.06, 3500, 4, 0.25); tone(c, 2200, 0, 0.05, "triangle", 0.04); break;
    case "bet": noise(c, 0, 0.05, 3000, 4, 0.25); noise(c, 0.06, 0.05, 3400, 4, 0.2); tone(c, 880, 0.02, 0.12, "triangle", 0.05, 1320); break;
    case "flip": noise(c, 0, 0.12, 2500, 1.5, 0.25, 800); break;
    case "step": tone(c, 420, 0, 0.08, "triangle", 0.07, 640); break;
    case "gem": tone(c, 1320, 0, 0.12, "sine", 0.07); tone(c, 1760, 0.06, 0.18, "sine", 0.06); break;
    case "cashout": [784, 988, 1175].forEach((f, i) => tone(c, f, i * 0.07, 0.18, "triangle", 0.07)); noise(c, 0, 0.3, 6000, 2, 0.08); break;
    case "win": [523, 659, 784, 1047].forEach((f, i) => tone(c, f, i * 0.09, 0.25, "triangle", 0.08)); break;
    case "bigwin": [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(c, f, i * 0.08, 0.35, "triangle", 0.08)); for (let i = 0; i < 8; i++) noise(c, 0.5 + i * 0.06, 0.08, 5000 + i * 300, 6, 0.12); break;
    case "lose": tone(c, 392, 0, 0.2, "sawtooth", 0.05, 330); tone(c, 330, 0.18, 0.22, "sawtooth", 0.05, 262); tone(c, 262, 0.38, 0.4, "sawtooth", 0.05, 180); break;
    case "explode": noise(c, 0, 0.7, 400, 0.6, 0.5, 60); tone(c, 120, 0, 0.5, "sine", 0.15, 40); break;
    case "takeoff": noise(c, 0, 1.2, 300, 0.8, 0.12, 1400); tone(c, 90, 0, 1.2, "sawtooth", 0.03, 220); break;
    case "dragon": growl(c, 70, 1.4, 0.18); tone(c, 55, 0, 1.4, "sine", 0.2, 40); break;
    case "tiger": growl(c, 140, 0.9, 0.16); break;
  }
}

export const CURRENCY = "PKR";
export const CURRENCY_SYMBOL = "₨";

export const fmt = (n: number | null | undefined) =>
  `₨${(Number(n) || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
