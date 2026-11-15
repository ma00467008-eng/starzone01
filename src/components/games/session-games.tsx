import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bomb, Gem, Plane } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp, errMsg } from "@/lib/app-context";
import { beep, fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { Card, PrimaryButton, StakeInput, useAfterPlay } from "@/components/sz/shell";
import type { GameRow } from "./types";

/* ---------------- Sky Crash ---------------- */
export function CrashGame({ game }: { game: GameRow }) {
  const { t } = useApp();
  const after = useAfterPlay(game.slug);
  const [stake, setStake] = useState(game.min_stake);
  const [auto, setAuto] = useState("");
  const [sid, setSid] = useState<string | null>(null);
  const [mult, setMult] = useState(1);
  const [state, setState] = useState<"idle" | "flying" | "crashed" | "cashed">("idle");
  const [busy, setBusy] = useState(false);
  const [past, setPast] = useState<number[]>([]);
  const start = useRef(0);
  const sidRef = useRef<string | null>(null);

  useEffect(() => {
    if (state !== "flying") return;
    const anim = setInterval(() => setMult(Math.floor(Math.exp(0.1 * (Date.now() - start.current) / 1000) * 100) / 100), 50);
    const poll = setInterval(() => check(false), 400);
    return () => { clearInterval(anim); clearInterval(poll); };
  }, [state]);

  const check = async (manual: boolean) => {
    if (!sidRef.current) return;
    const { data } = await supabase.from("sessions").select("status, multiplier, payout").eq("id", sidRef.current).maybeSingle();
    if (!data) return;
    if (data.status === "crashed") {
      sidRef.current = null;
      setState("crashed");
      setMult(Number(data.multiplier) || 1);
      beep("lose");
      toast.error(t("game.crashed"));
      setPast((p) => [Number(data.multiplier) || 1, ...p].slice(0, 10));
    } else if (data.status === "cashed" || manual) {
      sidRef.current = null;
      setState("cashed");
      setMult(Number(data.multiplier) || 1);
      beep("win");
      toast.success(`${t("game.cashed_out")} ${fmt(Number(data.payout))}`);
      after.mutate();
    }
  };

  const play = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("play_crash_start", {
        p_stake: stake,
        p_auto: auto ? parseFloat(auto) : null,
      });
      if (error) throw error;
      sidRef.current = data.session_id;
      setSid(data.session_id);
      start.current = Date.now();
      setState("flying");
      setMult(1);
      beep("start");
      after.mutate();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const cash = async () => {
    if (!sid) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("play_crash_cash", { p_sid: sid });
      if (error) throw error;
      sidRef.current = null;
      setState("cashed");
      setMult(Number(data.multiplier));
      beep("win");
      toast.success(`${t("game.cashed_out")} ${fmt(Number(data.payout))}`);
      after.mutate();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden p-6 text-center">
        <div className="flex h-44 flex-col items-center justify-center">
          <Plane className={cn("h-12 w-12 transition-transform duration-300 text-primary-deep", state === "flying" && "animate-pulse -rotate-12", state === "crashed" && "rotate-45 text-destructive")} />
          <div className={cn("mt-4 font-display text-4xl font-extrabold tabular-nums", state === "crashed" ? "text-destructive" : "text-foreground")}>{mult.toFixed(2)}×</div>
          <div className="text-xs text-muted-foreground">{state === "flying" ? t("game.flying") : state === "crashed" ? t("game.crashed") : state === "cashed" ? t("game.cashed_out") : t("game.ready")}</div>
        </div>
      </Card>
      <Card className="space-y-3 p-4">
        <StakeInput value={stake} onChange={setStake} min={game.min_stake} max={game.max_stake} disabled={state === "flying"} />
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">{t("game.auto_cash")}</label>
          <input type="number" step="0.1" min="1.01" value={auto} onChange={(e) => setAuto(e.target.value)} placeholder="2.00×" disabled={state === "flying"} className="h-9 w-28 rounded-lg border border-input bg-background px-2 text-sm" />
        </div>
        {state === "flying" ? (
          <PrimaryButton onClick={cash} disabled={busy}>{t("game.cash_out")} ({(stake * mult).toFixed(0)})</PrimaryButton>
        ) : (
          <PrimaryButton onClick={play} disabled={busy}>{t("game.bet")}</PrimaryButton>
        )}
      </Card>
    </div>
  );
}

/* ---------------- Mines ---------------- */
export function MinesGame({ game }: { game: GameRow }) {
  const { t } = useApp();
  const after = useAfterPlay(game.slug);
  const [stake, setStake] = useState(game.min_stake);
  const [mines, setMines] = useState(3);
  const [sid, setSid] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [hit, setHit] = useState<number | null>(null);
  const [payout, setPayout] = useState(0);
  const [active, setActive] = useState(false);

  const start = async () => {
    try {
      const { data, error } = await supabase.rpc("play_mines_start", { p_stake: stake, p_mines: mines });
      if (error) throw error;
      setSid(data.session_id);
      setActive(true);
      setRevealed([]);
      setHit(null);
      setPayout(0);
      beep("start");
      after.mutate();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const pick = async (tile: number) => {
    if (!sid || !active || revealed.includes(tile)) return;
    try {
      const { data, error } = await supabase.rpc("play_mines_pick", { p_sid: sid, p_tile: tile });
      if (error) throw error;
      setRevealed((r) => [...r, tile]);
      if (data.status === "exploded") {
        setHit(tile);
        setActive(false);
        beep("lose");
        toast.error(t("game.boom"));
      } else {
        setPayout(Number(data.payout));
        beep("flip");
        if (data.status === "completed") {
          setActive(false);
          beep("win");
          toast.success(t("game.all_cleared"));
          after.mutate();
        }
      }
    } catch (e) { toast.error(errMsg(e)); }
  };

  const cash = async () => {
    if (!sid || !active) return;
    try {
      const { error } = await supabase.rpc("play_mines_cash", { p_sid: sid });
      if (error) throw error;
      setActive(false);
      beep("win");
      toast.success(`${t("game.cashed_out")} ${fmt(payout)}`);
      after.mutate();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="space-y-4">
      <Card className="grid grid-cols-5 gap-2 p-4">
        {Array.from({ length: 25 }, (_, i) => {
          const rev = revealed.includes(i);
          const isHit = hit === i;
          return (
            <button key={i} type="button" onClick={() => pick(i)} disabled={!active || rev} className={cn("aspect-square rounded-xl border border-border/60 transition active:scale-95 flex items-center justify-center font-bold", rev ? (isHit ? "bg-destructive text-destructive-foreground" : "bg-success/20 text-success") : "bg-secondary hover:bg-secondary/80")}>
              {rev ? (isHit ? <Bomb className="h-5 w-5" /> : <Gem className="h-5 w-5" />) : null}
            </button>
          );
        })}
      </Card>
      <Card className="space-y-3 p-4">
        <StakeInput value={stake} onChange={setStake} min={game.min_stake} max={game.max_stake} disabled={active} />
        {active ? (
          <PrimaryButton onClick={cash} disabled={!payout}>{t("game.cash_out")} {payout > 0 && `(${fmt(payout)})`}</PrimaryButton>
        ) : (
          <PrimaryButton onClick={start}>{t("game.bet")}</PrimaryButton>
        )}
      </Card>
    </div>
  );
}

/* ---------------- Chicken ---------------- */
export function ChickenGame({ game }: { game: GameRow }) {
  return <MinesGame game={game} />;
}
