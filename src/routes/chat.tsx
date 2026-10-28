import { createFileRoute } from "@tanstack/react-router";
import { AppShell, Card } from "@/components/sz/shell";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [
    { title: "Chat — STAR ZONE" },
    { name: "description", content: "STAR ZONE chat section." },
    { property: "og:title", content: "Chat — STAR ZONE" },
    { property: "og:description", content: "STAR ZONE chat section." },
  ] }),
  component: () => <AppShell><Card className="text-center text-sm text-muted-foreground">This section is coming soon.</Card></AppShell>,
});
