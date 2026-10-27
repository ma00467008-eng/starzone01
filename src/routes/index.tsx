import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "@/components/sz/bits";
import { useApp } from "@/lib/app-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "STAR ZONE — Free-to-Play Game Lobby" },
      { name: "description", content: "WinGo, Sky Crash, Mines, Plinko, Dice and more — all with free virtual coins." },
      { property: "og:title", content: "STAR ZONE — Free-to-Play Game Lobby" },
      { property: "og:description", content: "10 free-to-play games with virtual coins." },
    ],
  }),
  component: Home,
});

function Home() {
  const { t } = useApp();
  const { data: games } = useQuery({
    queryKey: ["games"],
    queryFn: async () => (await supabase.from("games").select("*").eq("enabled", true).order("sort")).data ?? [],
  });
  const { data: slides } = useQuery({
    queryKey: ["slides"],
    queryFn: async () => (await supabase.from("media_items").select("*").eq("kind", "slider").order("sort")).data ?? [],
  });
  return (
    <div className="min-h-screen pb-10">
      <TopBar />
      <main className="mx-auto max-w-3xl space-y-6 px-4 pt-4">
        {slides?.[0] && <img src={slides[0].image_url} alt={slides[0].title ?? "Promotion"} className="aspect-[16/7] w-full rounded-2xl object-cover shadow-card" />}
        <section>
          <h2 className="mb-3 font-display text-lg font-bold">{t("home.all_games")}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(games ?? []).map((g) => (
              <div key={g.slug} className="overflow-hidden rounded-2xl bg-card shadow-card">
                <div className="relative">
                  <img src={g.image_url} alt={g.name} loading="lazy" className="aspect-[3/2] w-full object-cover" />
                  {g.badge && <span className="absolute left-2 top-2 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">{g.badge}</span>}
                </div>
                <div className="p-3 font-display text-sm font-bold">{g.name}</div>
              </div>
            ))}
          </div>
        </section>
        <p className="text-center text-xs text-muted-foreground">{t("virtual.note")}</p>
      </main>
    </div>
  );
}
