import { MessageCircle, Send } from "lucide-react";
import { useApp } from "@/lib/app-context";

/** Telegram / WhatsApp buttons; any link left blank in Admin stays hidden. */
export function SocialLinks() {
  const { settings, t } = useApp();
  const s = (settings["social"] ?? {}) as Record<string, string>;
  const items = [
    { k: "whatsapp_support", label: t("social.wa_support"), wa: true },
    { k: "telegram_support", label: t("social.tg_support"), wa: false },
    { k: "whatsapp_channel", label: t("social.wa_channel"), wa: true },
    { k: "telegram_channel", label: t("social.tg_channel"), wa: false },
  ].filter((i) => s[i.k]);
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((i) => (
        <a key={i.k} href={s[i.k]} target="_blank" rel="noreferrer" className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-card ${i.wa ? "bg-success" : "bg-primary-deep"}`}>
          {i.wa ? <MessageCircle className="h-4 w-4" /> : <Send className="h-4 w-4" />}{i.label}
        </a>
      ))}
    </div>
  );
}
