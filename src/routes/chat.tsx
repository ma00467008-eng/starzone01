import { createFileRoute } from "@tanstack/react-router";
import { Headphones } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { AppShell, RequireLogin } from "@/components/sz/shell";
import { ChatThread } from "@/components/sz/chat-thread";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [
    { title: "Support Chat — STAR ZONE" },
    { name: "description", content: "Private chat with the STAR ZONE support team." },
    { property: "og:title", content: "Support Chat — STAR ZONE" },
    { property: "og:description", content: "Private chat with the STAR ZONE support team." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ChatPage,
});

function ChatPage() {
  const { session, t } = useApp();
  return (
    <AppShell>
      <RequireLogin>
        <div className="flex h-[calc(100dvh-10.5rem)] flex-col overflow-hidden rounded-2xl bg-secondary/40 shadow-card">
          <div className="flex items-center gap-3 bg-gradient-primary px-4 py-3 text-primary-foreground">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-primary-foreground/20"><Headphones className="h-5 w-5" /></span>
            <div><div className="font-display font-bold">{t("chat.title")}</div><div className="text-xs opacity-85">{t("chat.subtitle")}</div></div>
          </div>
          {session && <ChatThread userId={session.user.id} as="user" />}
        </div>
      </RequireLogin>
    </AppShell>
  );
}
