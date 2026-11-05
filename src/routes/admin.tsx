import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { LayoutDashboard, Users, Coins, Gamepad2, Image, MessageCircle, Bot, LifeBuoy, Gift, Bell, Settings, Type, ArrowLeft, ShieldAlert } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { Spinner } from "@/components/sz/shell";
import { cn } from "@/lib/utils";
import { Dashboard, UsersMod, CoinsMod, GamesMod, MediaMod, ChatMod, AutoMsgMod, SupportMod, GiftsMod, NotifyMod, SettingsMod, ContentMod } from "@/components/admin/modules";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [
    { title: "Super Admin — STAR ZONE" },
    { name: "description", content: "STAR ZONE administration panel." },
    { property: "og:title", content: "Super Admin — STAR ZONE" },
    { property: "og:description", content: "STAR ZONE administration panel." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: AdminPage,
});

const TABS = [
  { k: "dash", label: "Dashboard", icon: LayoutDashboard, C: Dashboard },
  { k: "users", label: "Users", icon: Users, C: UsersMod },
  { k: "coins", label: "Coin Requests", icon: Coins, C: CoinsMod },
  { k: "games", label: "Games", icon: Gamepad2, C: GamesMod },
  { k: "media", label: "Banners & Pop-ups", icon: Image, C: MediaMod },
  { k: "support", label: "Live Support", icon: LifeBuoy, C: SupportMod },
  { k: "gifts", label: "Gift Codes", icon: Gift, C: GiftsMod },
  { k: "notify", label: "Notifications", icon: Bell, C: NotifyMod },
  { k: "settings", label: "Site & Links", icon: Settings, C: SettingsMod },
  { k: "content", label: "Text Editor", icon: Type, C: ContentMod },
] as const;

function AdminPage() {
  const { ready, session, isAdmin, profile } = useApp();
  const [tab, setTab] = useState<string>("dash");
  if (!ready || (session && !profile)) return <div className="grid min-h-screen place-items-center"><Spinner /></div>;
  if (!session || !isAdmin) return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div><ShieldAlert className="mx-auto h-10 w-10 text-destructive" /><p className="mt-3 font-semibold">Admins only</p><Link to="/auth" className="mt-4 inline-block text-sm text-primary underline">Log in</Link></div>
    </div>
  );
  const Cur = TABS.find((t) => t.k === tab)!.C;
  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="sticky top-0 z-30 border-b border-border bg-night text-night-foreground md:h-screen md:w-60 md:shrink-0 md:border-b-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="font-display text-lg font-extrabold tracking-wide">STAR ZONE <span className="text-xs font-semibold opacity-70">ADMIN</span></div>
          <Link to="/account" className="grid h-8 w-8 place-items-center rounded-full bg-night-foreground/10" aria-label="Back to site"><ArrowLeft className="h-4 w-4" /></Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible">
          {TABS.map(({ k, label, icon: Icon }) => (
            <button key={k} onClick={() => setTab(k)} className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition", tab === k ? "bg-primary text-primary-foreground" : "opacity-80 hover:bg-night-foreground/10")}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 p-4"><Cur /></main>
    </div>
  );
}
