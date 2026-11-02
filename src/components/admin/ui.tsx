import { useRef, useState, type ReactNode } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { errMsg } from "@/lib/app-context";
import { uploadPublicImage } from "@/lib/media";
import { cn } from "@/lib/utils";

export function Panel({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export const inputCls = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary";
export const areaCls = "min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary";

export function Btn({ children, onClick, variant = "primary", disabled, className, type = "button" }: { children: ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger" | "success"; disabled?: boolean; className?: string; type?: "button" | "submit" }) {
  const v = {
    primary: "bg-gradient-primary text-primary-foreground shadow-glow",
    ghost: "bg-secondary text-secondary-foreground",
    danger: "bg-destructive text-destructive-foreground",
    success: "bg-success text-primary-foreground",
  }[variant];
  return <button type={type} onClick={onClick} disabled={disabled} className={cn("inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition disabled:opacity-50", v, className)}>{children}</button>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1"><span className="text-xs font-semibold text-muted-foreground">{label}</span>{children}</label>;
}

/** Upload button that returns a public, long-lived image URL. */
export function ImageUpload({ onDone, label = "Upload image" }: { onDone: (url: string) => void; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input ref={ref} type="file" accept="image/*" hidden onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        setBusy(true);
        try { onDone(await uploadPublicImage(f)); toast.success("Image uploaded"); } catch (er) { toast.error(errMsg(er)); }
        setBusy(false); e.target.value = "";
      }} />
      <Btn variant="ghost" onClick={() => ref.current?.click()} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}{label}</Btn>
    </>
  );
}

export function confirmDo(msg: string) { return window.confirm(msg); }
