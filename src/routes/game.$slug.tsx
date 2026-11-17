import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { AppShell, Card, RequireLogin, RoundHistory, Spinner } from "@/components/sz/shell";
import { Balance, Empty } from "@/components/sz/bits";
import { WingoGame } from "@/components/games/wingo";
import { FortuneTigerGame } from "@/components/games/fortune-tiger";
import { CrashGame, MinesGame, ChickenGame } from "@/components/games/session-games";
import { DiceGame, LimboGame, PlinkoGame, DragonTigerGame } from "@/components/games/instant-games";
import { FortuneGemsGame } from "@/components/games/fortune-gems";
import { JavelinGame } from "@/components/games/javelin";
import type { GameRow } from "@/components/games/types";

export const Route = createFileRoute("/game/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Play ${params.slug} — STAR ZONE` },
      { name: "description", content: "Free-to-play game with virtual coins on STAR ZONE." },
      { property: "og:title", content: `Play ${params.slug} — STAR ZONE` },
      { property: "og:description", content: "Free-to-play game with virtual coins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GamePage,
});

const MAP: Record<string, (p: { game: GameRow }) => React.ReactNode> = {
  "fortune-tiger": FortuneTigerGame,
  wingo: WingoGame, trx: WingoGame, color: WingoGame,
  aviator: CrashGame, mines: MinesGame, chicken: ChickenGame,
  javelin: JavelinGame,
  "fortune-gems": FortuneGemsGame,
  dice: DiceGame, limbo: LimboGame, plinko: PlinkoGame, "dragon-tiger": DragonTigerGame,
};

function GamePage() {
  const { slug } = Route.useParams();
  const { t } = useApp();
  const { data: game, isLoading } = useQuery({
    queryKey: ["game", slug],
    queryFn: async () => (await supabase.from("games").select("*").eq("slug", slug).maybeSingle()).data,
  });
  const Comp = MAP[slug];
  return (
    <AppShell title={game?.name ?? "…"} back="/" nav={false}>
      {isLoading ? <Spinner /> : !game || !Comp ? <Empty text="Game not found" /> : (
        <RequireLogin>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-card px-4 py-2 shadow-card"><span className="text-sm text-muted-foreground">{t("acc.balance")}</span><Balance /></div>
            {game.announcement && <div className="rounded-xl bg-secondary px-4 py-2 text-sm text-secondary-foreground">{game.announcement}</div>}
            {!game.enabled || game.maintenance ? <Empty text={t("game.unavailable")} /> : <Comp game={game} />}
            <Card>
              <h3 className="mb-2 font-display text-sm font-bold">{t("common.rules")}</h3>
              <p className="whitespace-pre-line text-sm text-muted-foreground">{game.rules || "—"}</p>
            </Card>
            <RoundHistory game={slug} />
          </div>
        </RequireLogin>
      )}
    </AppShell>
  );
}
