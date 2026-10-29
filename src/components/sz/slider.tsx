import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Slide = { id: string; image_url: string; title: string | null; link: string | null };

export function Slider({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  const n = slides.length;
  const touch = useRef<number | null>(null);
  useEffect(() => {
    if (n < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 4500);
    return () => clearInterval(t);
  }, [n, i]);
  if (!n) return <div className="aspect-[16/7] w-full animate-pulse rounded-2xl bg-secondary" />;
  const go = (d: number) => setI((x) => (x + d + n) % n);
  return (
    <div
      className="relative overflow-hidden rounded-2xl shadow-card"
      onTouchStart={(e) => (touch.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => { const s = touch.current; const x = e.changedTouches[0]?.clientX; if (s != null && x != null && Math.abs(x - s) > 40) go(x < s ? 1 : -1); touch.current = null; }}
    >
      <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${i * 100}%)` }} dir="ltr">
        {slides.map((s) => {
          const img = <img src={s.image_url} alt={s.title ?? "Promotion"} className="aspect-[16/7] w-full shrink-0 object-cover" draggable={false} />;
          return <div key={s.id} className="w-full shrink-0">{s.link ? <a href={s.link} target="_blank" rel="noreferrer">{img}</a> : img}</div>;
        })}
      </div>
      {n > 1 && (
        <>
          <button onClick={() => go(-1)} aria-label="Previous" className="absolute left-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-card/80 text-foreground shadow"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => go(1)} aria-label="Next" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-card/80 text-foreground shadow"><ChevronRight className="h-4 w-4" /></button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
            {slides.map((s, k) => <button key={s.id} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} className={cn("h-1.5 rounded-full bg-card transition-all", k === i ? "w-5" : "w-1.5 opacity-60")} />)}
          </div>
        </>
      )}
    </div>
  );
}
