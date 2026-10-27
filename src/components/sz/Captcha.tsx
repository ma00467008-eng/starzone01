import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, ShieldCheck, ChevronsRight } from "lucide-react";
import { getCaptcha, verifyCaptcha } from "@/lib/auth.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useApp } from "@/lib/app-context";

const IMAGES = ["/banners/b1.jpg", "/banners/b2.jpg", "/games/aviator.jpg", "/games/mines.jpg", "/games/plinko.jpg", "/games/wingo.jpg"];
const W = 300, H = 150, P = 44;

function piecePath(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const r = 8;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + P / 2 - r, y);
  ctx.arc(x + P / 2, y - 2, r, Math.PI * 0.85, Math.PI * 0.15, false);
  ctx.lineTo(x + P, y);
  ctx.lineTo(x + P, y + P / 2 - r);
  ctx.arc(x + P + 2, y + P / 2, r, Math.PI * 1.35, Math.PI * 0.65, false);
  ctx.lineTo(x + P, y + P);
  ctx.lineTo(x, y + P);
  ctx.closePath();
}

export function CaptchaDialog({ open, onClose, onPassed }: { open: boolean; onClose: () => void; onPassed: (id: string) => void }) {
  const { t } = useApp();
  const get = useServerFn(getCaptcha);
  const verify = useServerFn(verifyCaptcha);
  const bg = useRef<HTMLCanvasElement>(null);
  const pc = useRef<HTMLCanvasElement>(null);
  const [ch, setCh] = useState<{ id: string; x: number; y: number; image: number } | null>(null);
  const [pos, setPos] = useState(0);
  const [state, setState] = useState<"idle" | "drag" | "check" | "ok" | "fail">("idle");
  const drag = useRef<{ startX: number; t0: number; trace: number[][] } | null>(null);

  const load = useCallback(async () => {
    setCh(null); setPos(0); setState("idle");
    const c = await get();
    setCh(c);
  }, [get]);

  useEffect(() => { if (open) load(); }, [open, load]);

  useEffect(() => {
    if (!ch || !bg.current || !pc.current) return;
    const img = new Image();
    img.src = IMAGES[ch.image % IMAGES.length];
    img.onload = () => {
      const b = bg.current!.getContext("2d")!; const p = pc.current!.getContext("2d")!;
      b.clearRect(0, 0, W, H); p.clearRect(0, 0, P + 12, H);
      b.drawImage(img, 0, 0, W, H);
      // piece
      p.save(); piecePath(p, 0, ch.y); p.clip(); p.drawImage(img, -ch.x, 0, W, H); p.restore();
      p.save(); piecePath(p, 0, ch.y); p.lineWidth = 2; p.strokeStyle = "rgba(255,255,255,0.95)"; p.stroke(); p.restore();
      // gap
      b.save(); piecePath(b, ch.x, ch.y); b.fillStyle = "rgba(10,25,50,0.55)"; b.fill(); b.strokeStyle = "rgba(255,255,255,0.7)"; b.lineWidth = 1.5; b.stroke(); b.restore();
    };
  }, [ch]);

  const max = W - P - 4;
  const onDown = (e: React.PointerEvent) => {
    if (state !== "idle" && state !== "fail") return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX - pos, t0: performance.now(), trace: [] };
    setState("drag");
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || state !== "drag") return;
    const x = Math.max(0, Math.min(max, e.clientX - drag.current.startX));
    setPos(x);
    drag.current.trace.push([Math.round(x), Math.round(e.clientY), Math.round(performance.now() - drag.current.t0)]);
  };
  const onUp = async () => {
    if (!drag.current || !ch) return;
    const d = drag.current; drag.current = null;
    setState("check");
    const scale = (bg.current?.width || W) / (bg.current?.getBoundingClientRect().width || W);
    try {
      const r = await verify({ data: { id: ch.id, x: Math.round(pos * scale), trace: d.trace, duration: performance.now() - d.t0 } });
      if (r.ok) { setState("ok"); setTimeout(() => onPassed(ch.id), 450); }
      else { setState("fail"); setTimeout(() => (r.expired ? load() : (setPos(0), setState("idle"))), 700); }
    } catch { setState("fail"); setTimeout(load, 700); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[360px] rounded-2xl p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display"><ShieldCheck className="h-5 w-5 text-primary-deep" />{t("captcha.title")}</DialogTitle>
          <DialogDescription>{t("captcha.hint")}</DialogDescription>
        </DialogHeader>
        <div className="relative mx-auto w-full max-w-[300px] select-none overflow-hidden rounded-xl bg-muted" style={{ aspectRatio: "2/1" }}>
          {!ch && <div className="absolute inset-0 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary-deep" /></div>}
          <canvas ref={bg} width={W} height={H} className="absolute inset-0 h-full w-full" />
          <canvas ref={pc} width={P + 12} height={H} className="absolute top-0 h-full" style={{ left: `${(pos / W) * 100}%`, width: `${((P + 12) / W) * 100}%` }} />
          <button type="button" onClick={load} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-card/80 text-foreground" aria-label="Refresh"><RefreshCw className="h-3.5 w-3.5" /></button>
          {state === "ok" && <div className="absolute inset-x-0 bottom-0 bg-success/90 py-1 text-center text-xs font-semibold text-success-foreground">✓</div>}
          {state === "fail" && <div className="absolute inset-x-0 bottom-0 bg-destructive/90 py-1 text-center text-xs font-semibold text-destructive-foreground">{t("captcha.fail")}</div>}
        </div>
        <div className="relative mx-auto mt-2 h-11 w-full max-w-[300px] rounded-full bg-secondary" dir="ltr">
          <div className="absolute inset-y-0 left-0 rounded-full bg-primary/25" style={{ width: `calc(${(pos / W) * 100}% + 44px)` }} />
          <span className="absolute inset-0 grid place-items-center text-xs font-medium text-muted-foreground">{t("captcha.hint")}</span>
          <div
            role="slider" aria-valuenow={pos} aria-valuemin={0} aria-valuemax={max} aria-label={t("captcha.hint")}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            className="absolute top-0 grid h-11 w-11 touch-none cursor-grab place-items-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow active:cursor-grabbing"
            style={{ left: `${(pos / W) * 100}%` }}
          >
            {state === "check" ? <Loader2 className="h-5 w-5 animate-spin" /> : <ChevronsRight className="h-5 w-5" />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
