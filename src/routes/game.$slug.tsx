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
import { MotoRacingGame } from "@/components/games/moto-racing";
import { DoubleFortuneGame } from "@/components/games/double-fortune";
import { RoyalFishingGame } from "@/components/games/royal-fishing";
import { TrxWingoGame } from "@/components/games/trx-wingo";
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
  wingo: WingoGame, trx: TrxWingoGame, color: WingoGame,
  aviator: CrashGame, mines: MinesGame, chicken: ChickenGame,
  javelin: JavelinGame,
  "moto-racing": MotoRacingGame,
  "double-fortune": DoubleFortuneGame,
  "royal-fishing": RoyalFishingGame,
  "fortune-gems": FortuneGemsGame,
  dice: DiceGame, limbo: LimboGame, plinko: PlinkoGame, "dragon-tiger": DragonTigerGame,
};

const FALLBACK_GAMES: Record<string, Partial<GameRow>> = {
  trx: { name: "TRX Win Go", min_stake: 10, max_stake: 100000, rules: "Tron public blockchain hash lottery. Bet on numbers, colors, or big/small." },
  javelin: { name: "Javelin", min_stake: 10, max_stake: 10000, rules: "Place your bet before launch. Cash out as the javelin soars before it lands!" },
  "moto-racing": { name: "Moto Racing", min_stake: 10, max_stake: 10000, rules: "Pick your bike (1-8), Big/Small, or Odd/Even. Watch the live race and win big!" },
  "double-fortune": { name: "Double Fortune", min_stake: 10, max_stake: 10000, rules: "5x3 Asian-themed slot with 243 ways to win. Match symbols from left to right." },
  "royal-fishing": { name: "Royal Fishing", min_stake: 10, max_stake: 10000, rules: "Aim and shoot various fish species. Catch rare sea creatures for up to 100x rewards!" },
};

function GamePage() {
  const { slug } = Route.useParams();
  const { t } = useApp();
  const { data: game, isLoading, error } = useQuery({
    queryKey: ["game", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("games").select("*").eq("slug", slug).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const Comp = MAP[slug];
  const fallback = FALLBACK_GAMES[slug];
  const activeGame: GameRow | undefined = game
    ? { ...fallback, ...game }
    : fallback && Comp
    ? ({
        id: slug,
        slug,
        name: fallback.name ?? slug,
        image_url: `/games/${slug}.jpg`,
        badge: "HOT",
        featured: true,
        sort: 99,
        min_stake: fallback.min_stake ?? 10,
        max_stake: fallback.max_stake ?? 10000,
        enabled: true,
        maintenance: false,
        rules: fallback.rules ?? "",
        announcement: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as GameRow)
    : undefined;

  return (
    <AppShell title={activeGame?.name ?? "…"} back="/" nav={false}>
      {isLoading ? <Spinner /> : error ? <Empty text={`Could not load game: ${error.message}`} /> : !activeGame || !Comp ? <Empty text="Game not found" /> : (
        <RequireLogin>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-card px-4 py-2 shadow-card"><span className="text-sm text-muted-foreground">{t("acc.balance")}</span><Balance /></div>
            {activeGame.announcement && <div className="rounded-xl bg-secondary px-4 py-2 text-sm text-secondary-foreground">{activeGame.announcement}</div>}
            {!activeGame.enabled || activeGame.maintenance ? <Empty text={t("game.unavailable")} /> : <Comp game={activeGame} />}
            <Card>
              <h3 className="mb-2 font-display text-sm font-bold">{t("common.rules")}</h3>
              <p className="whitespace-pre-line text-sm text-muted-foreground">{activeGame.rules || "—"}</p>
            </Card>
            <RoundHistory game={slug} />
          </div>
        </RequireLogin>
      )}
    </AppShell>
  );
}
