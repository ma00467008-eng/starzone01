import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bomb, Flame, Footprints, Gem, Plane } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp, errMsg } from "@/lib/app-context";
import { beep, fmt } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { Card, PrimaryButton, StakeInput, useAfterPlay } from "@/components/sz/shell";
import type { GameRow } from "./types";

/* ---------------- Sky Crash / Aviator ---------------- */
export function CrashGame({ game }: { game: GameRow }) {
  const { t } = useApp();
  const after = useAfterPlay(game.slug);
  const [stake, setStake] = useState(game.min_stake);
  const [auto, setAuto] = useState("");
  const [, setSid] = useState<string | null>(null);
  const [mult, setMult] = useState(1);
  const [state, setState] = useState<"idle" | "flying" | "crashed" | "cashed">("idle");
  const [busy, setBusy] = useState(false);
  const [past, setPast] = useState<number[]>([]);
  const start = useRef(0);
  const sidRef = useRef<string | null>(null);

  useEffect(() => {
    if (state !== "flying") return;
    const anim = setInterval(() => {
      setMult(Math.floor(Math.exp((0.1 * (Date.now() - start.current)) / 1000) * 100) / 100);
    }, 50);
    const poll = setInterval(() => {
      check(false);
    }, 400);
    return () => {
      clearInterval(anim);
      clearInterval(poll);
    };
  }, [state]);

  const check = async (manual: boolean) => {
    if (!sidRef.current) return;
    try {
      const { data, error } = await (supabase.rpc as any)("crash_check", {
        _session: sidRef.current,
        _cashout: manual,
      });
      if (error) {
        sidRef.current = null;
        setSid(null);
        setState("idle");
        return;
      }
      const res = data as any;
      if (res?.crashed) {
        sidRef.current = null;
        setSid(null);
        if (res.cashout != null || manual) {
          setState("cashed");
          const finalM = Number(res.cashout || res.multiplier) || 1;
          setMult(finalM);
          beep("win");
          toast.success(`${t("game.cashed_out")} ${fmt(Number(res.payout))}`);
          setPast((p) => [finalM, ...p].slice(0, 10));
        } else {
          setState("crashed");
          const finalM = Number(res.crash) || 1;
          setMult(finalM);
          beep("lose");
          toast.error(t("game.crashed"));
          setPast((p) => [finalM, ...p].slice(0, 10));
        }
        after(res.balance);
      } else if (res?.multiplier) {
        setMult(Number(res.multiplier));
      }
    } catch {
      sidRef.current = null;
      setSid(null);
      setState("idle");
    }
  };

  const play = async () => {
    setBusy(true);
    try {
      const autoNum = auto ? parseFloat(auto) : null;
      const { data, error } = await (supabase.rpc as any)("crash_start", {
        _stake: stake,
        _auto: autoNum,
      });
      if (error) throw error;
      const session = (data as any)?.session;
      sidRef.current = session;
      setSid(session);
      start.current = Date.now();
      setState("flying");
      setMult(1);
      beep("bet");
      after((data as any)?.balance);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const cash = async () => {
    if (!sidRef.current || busy) return;
    setBusy(true);
    try {
      await check(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden p-6 text-center">
        <div className="flex h-44 flex-col items-center justify-center">
          <Plane
            className={cn(
              "h-12 w-12 text-primary-deep transition-transform duration-300",
              state === "flying" && "animate-pulse -rotate-12",
              state === "crashed" && "rotate-45 text-destructive"
            )}
          />
          <div
            className={cn(
              "mt-4 font-display text-4xl font-extrabold tabular-nums",
              state === "crashed" ? "text-destructive" : "text-foreground"
            )}
          >
            {mult.toFixed(2)}×
          </div>
          <div className="text-xs text-muted-foreground">
            {state === "flying"
              ? t("game.flying")
              : state === "crashed"
              ? t("game.crashed")
              : state === "cashed"
              ? t("game.cashed_out")
              : t("game.ready")}
          </div>
        </div>
      </Card>

      {past.length > 0 && (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {past.map((p, i) => (
            <span
              key={i}
              className={cn(
                "rounded-full px-2.5 py-0.5 font-mono text-xs font-bold",
                p >= 2 ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
              )}
            >
              {p.toFixed(2)}×
            </span>
          ))}
        </div>
      )}

      <Card className="space-y-3 p-4">
        <StakeInput
          value={stake}
          onChange={setStake}
          min={game.min_stake}
          max={game.max_stake}
          disabled={state === "flying"}
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">{t("game.auto_cash")}</label>
          <input
            type="number"
            step="0.1"
            min="1.01"
            value={auto}
            onChange={(e) => setAuto(e.target.value)}
            placeholder="2.00×"
            disabled={state === "flying"}
            className="h-9 w-28 rounded-lg border border-input bg-background px-2 text-sm"
          />
        </div>
        {state === "flying" ? (
          <PrimaryButton onClick={cash} disabled={busy} variant="gold">
            {t("game.cash_out")} ({(stake * mult).toFixed(0)})
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={play} disabled={busy}>
            {t("game.bet")}
          </PrimaryButton>
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
  const [mineTiles, setMineTiles] = useState<number[]>([]);
  const [hit, setHit] = useState<number | null>(null);
  const [payout, setPayout] = useState(0);
  const [mult, setMult] = useState(1);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)("mines_start", {
        _stake: stake,
        _mines: mines,
      });
      if (error) throw error;
      const session = (data as any)?.session;
      setSid(session);
      setActive(true);
      setRevealed([]);
      setMineTiles([]);
      setHit(null);
      setPayout(0);
      setMult(1);
      beep("bet");
      after((data as any)?.balance);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const pick = async (tile: number) => {
    if (!sid || !active || revealed.includes(tile) || busy) return;
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)("mines_reveal", {
        _session: sid,
        _tile: tile,
      });
      if (error) throw error;
      const res = data as any;
      if (res?.mine) {
        setHit(tile);
        setActive(false);
        setMineTiles(Array.isArray(res.mines) ? res.mines : []);
        beep("lose");
        toast.error(t("game.boom"));
        after(res.balance);
      } else if (res?.payout !== undefined) {
        // all safe tiles cleared and auto-cashed
        setRevealed((r) => [...r, tile]);
        setPayout(Number(res.payout));
        setMult(Number(res.multiplier) || 1);
        setActive(false);
        setMineTiles(Array.isArray(res.mines) ? res.mines : []);
        beep("win");
        toast.success(t("game.all_cleared"));
        after(res.balance);
      } else {
        setRevealed((r) => [...r, tile]);
        const m = Number(res?.multiplier) || 1;
        setMult(m);
        setPayout(Math.floor(stake * m));
        beep("flip");
      }
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const cash = async () => {
    if (!sid || !active || busy) return;
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)("mines_cashout", {
        _session: sid,
      });
      if (error) throw error;
      const res = data as any;
      setActive(false);
      setMineTiles(Array.isArray(res.mines) ? res.mines : []);
      beep("win");
      toast.success(`${t("game.cashed_out")} ${fmt(Number(res.payout))}`);
      after(res.balance);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {active && (
        <div className="flex items-center justify-between rounded-xl bg-card px-4 py-2">
          <span className="text-xs text-muted-foreground">Current Multiplier</span>
          <span className="font-display text-lg font-bold text-gold">{mult.toFixed(2)}×</span>
        </div>
      )}

      <Card className="grid grid-cols-5 gap-2 p-4">
        {Array.from({ length: 25 }, (_, i) => {
          const rev = revealed.includes(i);
          const isHit = hit === i;
          const isMine = mineTiles.includes(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => pick(i)}
              disabled={!active || rev || busy}
              className={cn(
                "flex aspect-square items-center justify-center rounded-xl border border-border/60 font-bold transition active:scale-95 disabled:cursor-not-allowed",
                rev
                  ? isHit
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-success/20 text-success"
                  : isMine
                  ? "bg-destructive/30 text-destructive"
                  : "bg-secondary hover:bg-secondary/80"
              )}
            >
              {rev ? (
                isHit ? <Bomb className="h-5 w-5" /> : <Gem className="h-5 w-5" />
              ) : isMine ? (
                <Bomb className="h-5 w-5 opacity-70" />
              ) : null}
            </button>
          );
        })}
      </Card>

      <Card className="space-y-3 p-4">
        <StakeInput
          value={stake}
          onChange={setStake}
          min={game.min_stake}
          max={game.max_stake}
          disabled={active}
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Mines count</label>
          <select
            value={mines}
            onChange={(e) => setMines(Number(e.target.value))}
            disabled={active}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm font-bold"
          >
            {[1, 2, 3, 5, 10, 15, 20, 24].map((m) => (
              <option key={m} value={m}>
                {m} {m === 1 ? "mine" : "mines"}
              </option>
            ))}
          </select>
        </div>

        {active ? (
          <PrimaryButton onClick={cash} disabled={busy || revealed.length === 0} variant="gold">
            {t("game.cash_out")} {payout > 0 && `(${fmt(payout)})`}
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={start} disabled={busy}>
            {t("game.bet")}
          </PrimaryButton>
        )}
      </Card>
    </div>
  );
}

/* ---------------- Chicken Road ---------------- */
const CHICKEN_DIFFS = [
  { id: "easy", label: "Easy", color: "text-success" },
  { id: "medium", label: "Medium", color: "text-primary" },
  { id: "hard", label: "Hard", color: "text-orange" },
  { id: "hardcore", label: "Daredevil", color: "text-destructive" },
] as const;

export function ChickenGame({ game }: { game: GameRow }) {
  const { t } = useApp();
  const after = useAfterPlay(game.slug);
  const [stake, setStake] = useState(game.min_stake);
  const [diff, setDiff] = useState<"easy" | "medium" | "hard" | "hardcore">("easy");
  const [sid, setSid] = useState<string | null>(null);
  const [lane, setLane] = useState(0);
  const [hazard, setHazard] = useState<number | null>(null);
  const [mult, setMult] = useState(1);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)("chicken_start", {
        _stake: stake,
        _difficulty: diff,
      });
      if (error) throw error;
      const session = (data as any)?.session;
      setSid(session);
      setActive(true);
      setLane(0);
      setHazard(null);
      setMult(1);
      beep("bet");
      after((data as any)?.balance);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const step = async () => {
    if (!sid || !active || busy) return;
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)("chicken_step", {
        _session: sid,
      });
      if (error) throw error;
      const res = data as any;
      if (res?.hit) {
        setLane(Number(res.lane));
        setHazard(Number(res.lane));
        setActive(false);
        beep("lose");
        toast.error("The chicken hit a hazard!");
        after(res.balance);
      } else if (res?.payout !== undefined) {
        // completed all 20 lanes!
        setLane(20);
        setMult(Number(res.multiplier) || 1);
        setActive(false);
        beep("win");
        toast.success(`${t("game.cashed_out")} ${fmt(Number(res.payout))}`);
        after(res.balance);
      } else {
        setLane(Number(res?.lane) || lane + 1);
        setMult(Number(res?.multiplier) || 1);
        beep("flip");
      }
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const cash = async () => {
    if (!sid || !active || busy || lane === 0) return;
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)("chicken_cashout", {
        _session: sid,
      });
      if (error) throw error;
      const res = data as any;
      setActive(false);
      setHazard(Number(res?.hazard) || null);
      beep("win");
      toast.success(`${t("game.cashed_out")} ${fmt(Number(res?.payout))}`);
      after(res.balance);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const currentPayout = Math.floor(stake * mult);

  return (
    <div className="space-y-4">
      {/* Chicken Road strip */}
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Lane {lane}/20</span>
          <span className="font-display text-base font-bold text-gold">{mult.toFixed(2)}×</span>
        </div>

        {/* Visual road */}
        <div className="relative overflow-x-auto rounded-2xl bg-secondary/60 p-3">
          <div className="flex min-w-[500px] items-center gap-1.5">
            {Array.from({ length: 20 }, (_, idx) => {
              const l = idx + 1;
              const isCurrent = lane === l;
              const isPassed = lane > l;
              const isHazard = hazard === l;
              return (
                <div
                  key={l}
                  className={cn(
                    "flex flex-1 flex-col items-center justify-center rounded-xl border py-2 text-center text-xs font-bold transition",
                    isHazard
                      ? "border-destructive bg-destructive text-destructive-foreground animate-shake"
                      : isCurrent
                      ? "border-gold bg-gold/20 text-gold scale-105 shadow-glow"
                      : isPassed
                      ? "border-success/40 bg-success/15 text-success"
                      : "border-border/40 bg-card text-muted-foreground opacity-60"
                  )}
                >
                  <div className="h-6">
                    {isHazard ? (
                      <Flame className="h-5 w-5 text-destructive" />
                    ) : isCurrent ? (
                      <span className="text-xl leading-none">🐔</span>
                    ) : isPassed ? (
                      <Footprints className="h-4 w-4" />
                    ) : (
                      <span className="text-[10px] opacity-60">{l}</span>
                    )}
                  </div>
                  <span className="mt-1 text-[10px] font-mono font-normal">L{l}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <StakeInput
          value={stake}
          onChange={setStake}
          min={game.min_stake}
          max={game.max_stake}
          disabled={active}
        />

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Difficulty</label>
          <div className="grid grid-cols-4 gap-1.5">
            {CHICKEN_DIFFS.map((d) => (
              <button
                key={d.id}
                type="button"
                disabled={active}
                onClick={() => setDiff(d.id)}
                className={cn(
                  "rounded-lg py-2 text-xs font-bold transition",
                  diff === d.id
                    ? "bg-primary text-primary-foreground shadow"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {active ? (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <PrimaryButton onClick={step} disabled={busy} variant="primary">
              Step Forward 🐔
            </PrimaryButton>
            <PrimaryButton
              onClick={cash}
              disabled={busy || lane === 0}
              variant="gold"
            >
              Cash Out ({fmt(currentPayout)})
            </PrimaryButton>
          </div>
        ) : (
          <PrimaryButton onClick={start} disabled={busy}>
            {t("game.bet")}
          </PrimaryButton>
        )}
      </Card>
    </div>
  );
}
