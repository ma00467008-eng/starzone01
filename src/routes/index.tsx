import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, Flame, Clock, Headphones, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { AppShell } from "@/components/sz/shell";
import { Slider } from "@/components/sz/slider";
import { SocialLinks } from "@/components/sz/social";
import { Balance } from "@/components/sz/bits";
import type { GameRow } from "@/components/games/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "STAR ZONE — Free-to-Play Game Lobby" },
      { name: "description", content: "WinGo, Aviator, Mines, Plinko, Dice and more — all with free virtual coins." },
      { property: "og:title", content: "STAR ZONE — Free-to-Play Game Lobby" },
      { property: "og:description", content: "10 free-to-play games with virtual coins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function GameCard({ g, wide }: { g: GameRow; wide?: boolean }) {
  const { t } = useApp();
  return (
    <Link to="/game/$slug" params={{ slug: g.slug }} className={`group block overflow-hidden rounded-2xl bg-card shadow-card transition hover:-translate-y-0.5 ${wide ? "w-40 shrink-0" : ""}`}>
      <div className="relative">
        <img src={g.image_url} alt={g.name} loading="lazy" className="aspect-[3/2] w-full object-cover transition group-hover:scale-105" />
        {g.badge && <span className="absolute left-2 top-2 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">{g.badge}</span>}
        {g.maintenance && <span className="absolute inset-0 grid place-items-center bg-foreground/60 text-xs font-bold text-background">Maintenance</span>}
      </div>
      <div className="flex items-center justify-between p-3">
        <span className="font-display text-sm font-bold">{g.name}</span>
        <span className="flex items-center gap-1 rounded-full bg-gradient-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground"><Play className="h-3 w-3 fill-current" />{t("common.play")}</span>
      </div>
    </Link>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Flame; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold"><Icon className="h-5 w-5 text-primary-deep" />{title}</h2>
      {children}
    </section>
  );
}

function Home() {
  const { t, session, settings } = useApp();
  const { data: games } = useQuery({
    queryKey: ["games"],
    queryFn: async () => (await supabase.from("games").select("*").eq("enabled", true).order("sort")).data ?? [],
  });
  const { data: slides } = useQuery({
    queryKey: ["slides"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase.from("media_items").select("*").eq("kind", "slider").eq("enabled", true).order("sort");
      return (data ?? []).filter((m) => (!m.starts_at || m.starts_at <= now) && (!m.ends_at || m.ends_at >= now));
    },
  });
  const { data: recent } = useQuery({
    queryKey: ["recent-games", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data } = await supabase.from("game_rounds").select("game").order("created_at", { ascending: false }).limit(50);
      return [...new Set((data ?? []).map((r) => r.game))];
    },
  });
  const all = games ?? [];
  const featured = all.filter((g) => g.featured);
  const popular = all.filter((g) => g.badge === "HOT");
  const recentGames = (recent ?? []).map((s) => all.find((g) => g.slug === s)).filter(Boolean) as GameRow[];
  const announce: string = settings["announcement"]?.text ?? "";

  return (
    <AppShell>
      <div className="space-y-6">
        <Slider slides={slides ?? []} />
        {announce && (
          <div className="flex items-center gap-2 overflow-hidden rounded-xl bg-card px-3 py-2 shadow-card">
            <Megaphone className="h-4 w-4 shrink-0 text-primary-deep" />
            <div className="overflow-hidden whitespace-nowrap"><span className="inline-block animate-[marquee_18s_linear_infinite] text-sm">{announce}</span></div>
          </div>
        )}
        {session && (
          <div className="flex items-center justify-between rounded-2xl bg-gradient-primary p-4 text-primary-foreground shadow-glow">
            <div><div className="text-xs opacity-80">{t("acc.balance")}</div><Balance className="text-2xl" /></div>
            <Link to="/add-coins" search={{ mode: "add" }} className="rounded-full bg-card px-4 py-2 text-sm font-bold text-primary-deep">{t("home.add_coins")}</Link>
          </div>
        )}
        {!!featured.length && <Section title={t("home.featured")} icon={Flame}><div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">{featured.map((g) => <GameCard key={g.slug} g={g} wide />)}</div></Section>}
        {!!recentGames.length && <Section title={t("home.recent")} icon={Clock}><div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">{recentGames.map((g) => <GameCard key={g.slug} g={g} wide />)}</div></Section>}
        {!!popular.length && <Section title={t("home.popular")} icon={Flame}><div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">{popular.map((g) => <GameCard key={g.slug} g={g} wide />)}</div></Section>}
        <Section title={t("home.all_games")} icon={Play}>
          {!games ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-secondary" />)}</div> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{all.map((g) => <GameCard key={g.slug} g={g} />)}</div>
          )}
        </Section>
        <Section title={t("home.community")} icon={Headphones}>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Link to="/chat" className="rounded-xl bg-card px-3 py-2.5 text-center text-sm font-semibold shadow-card">{t("chat.title")}</Link>
              <Link to="/chat" className="rounded-xl bg-card px-3 py-2.5 text-center text-sm font-semibold shadow-card">{t("home.support")}</Link>
            </div>
            <SocialLinks />
          </div>
        </Section>
        <p className="pb-2 text-center text-xs text-muted-foreground">{settings["site"]?.footer || t("footer.text")}</p>
      </div>
    </AppShell>
  );
}
