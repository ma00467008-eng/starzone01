import { createFileRoute } from "@tanstack/react-router";
import { AppShell, Card } from "@/components/sz/shell";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [
    { title: "Account — STAR ZONE" },
    { name: "description", content: "STAR ZONE account section." },
    { property: "og:title", content: "Account — STAR ZONE" },
    { property: "og:description", content: "STAR ZONE account section." },
  ] }),
  component: () => <AppShell><Card className="text-center text-sm text-muted-foreground">This section is coming soon.</Card></AppShell>,
});
