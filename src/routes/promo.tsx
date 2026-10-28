import { createFileRoute } from "@tanstack/react-router";
import { AppShell, Card } from "@/components/sz/shell";

export const Route = createFileRoute("/promo")({
  head: () => ({ meta: [
    { title: "Promo — STAR ZONE" },
    { name: "description", content: "STAR ZONE promo section." },
    { property: "og:title", content: "Promo — STAR ZONE" },
    { property: "og:description", content: "STAR ZONE promo section." },
  ] }),
  component: () => <AppShell><Card className="text-center text-sm text-muted-foreground">This section is coming soon.</Card></AppShell>,
});
