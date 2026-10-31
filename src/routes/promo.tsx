import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { AppShell } from "@/components/sz/shell";
import { Empty } from "@/components/sz/bits";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/promo")({
  head: () => ({ meta: [
    { title: "Promotions — STAR ZONE" },
    { name: "description", content: "Latest STAR ZONE promotions, events and virtual coin rewards." },
    { property: "og:title", content: "Promotions — STAR ZONE" },
    { property: "og:description", content: "Latest STAR ZONE promotions, events and virtual coin rewards." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: PromoPage,
});

function PromoPage() {
  const { t } = useApp();
  const { data, isLoading } = useQuery({
    queryKey: ["media", "promo"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase.from("media_items").select("*").eq("kind", "promo").eq("enabled", true).order("sort");
      return (data ?? []).filter((m) => (!m.starts_at || m.starts_at <= now) && (!m.ends_at || m.ends_at >= now));
    },
  });
  return (
    <AppShell>
      <h1 className="mb-4 font-display text-xl font-bold">{t("promo.title")}</h1>
      {isLoading ? (
        <div className="space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="aspect-[16/7] w-full rounded-2xl" />)}</div>
      ) : !data?.length ? <Empty /> : (
        <div className="space-y-4">
          {data.map((m) => {
            const img = <img src={m.image_url} alt={m.title || "Promotion"} loading="lazy" className="aspect-[16/7] w-full rounded-2xl object-cover shadow-card transition hover:shadow-glow" />;
            return (
              <div key={m.id}>
                {m.link ? <a href={m.link} target="_blank" rel="noopener noreferrer">{img}</a> : img}
                {m.title && <p className="mt-2 px-1 text-sm font-semibold">{m.title}</p>}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
