-- ============================================================================
-- Migration 0013: Register Javelin & New Games + Javelin Server Settlement RPC
-- ============================================================================

-- 1. Insert new games into public.games
INSERT INTO public.games(slug, name, image_url, badge, featured, sort, rules, min_stake, max_stake)
VALUES 
(
  'javelin',
  'Javelin Crash',
  '/games/javelin.jpg',
  'HOT',
  true,
  5,
  'An Olympic athlete launches the javelin stick high into the stadium arena. The multiplier rises continuously in flight. Hit Cash Out before the javelin lands and hits the turf!',
  10,
  10000
),
(
  'moto-racing',
  'Moto Racing',
  '/games/moto-racing.jpg',
  'HOT',
  true,
  6,
  '8 racers speed down the track! Bet on the winning bike (#1–#8), Top 2, or race traits (Big/Small, Odd/Even). Betting closes 5s before each race starts.',
  10,
  10000
),
(
  'double-fortune',
  'Double Fortune',
  '/games/double-fortune.jpg',
  'NEW',
  true,
  7,
  'Traditional Chinese wedding slot machine. Match 囍 Double Happiness Wilds, Grooms, Brides, and festive gifts across 5 paylines. Dual-reel free spins trigger multiplied wins!',
  10,
  10000
),
(
  'royal-fishing',
  'Royal Fishing',
  '/games/royal-fishing.jpg',
  'HOT',
  true,
  8,
  'Arcade fish shooting action! Aim the cannon and tap to fire at schools of sea creatures. Different species offer 2x up to 300x multipliers. Golden Dragon and King Bosses award huge coin payouts!',
  10,
  10000
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  rules = EXCLUDED.rules,
  badge = EXCLUDED.badge,
  featured = EXCLUDED.featured,
  sort = EXCLUDED.sort,
  enabled = true,
  maintenance = false;

-- 2. Settlement helper for Javelin
CREATE OR REPLACE FUNCTION public._javelin_settle(s public.game_sessions, _cash numeric) 
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE 
  payout bigint := 0; 
  b bigint; 
  c numeric := (s.secret->>'crash')::numeric;
BEGIN
  IF _cash IS NOT NULL THEN 
    payout := floor(s.stake * _cash); 
  END IF;
  
  UPDATE public.game_sessions SET active = false WHERE id = s.id;
  
  b := public._finish(
    s.user_id,
    'javelin',
    s.state->>'code',
    s.stake,
    payout,
    jsonb_build_object('auto', s.state->'auto'),
    jsonb_build_object('crash', c, 'cashout', _cash, 'win', _cash IS NOT NULL)
  );
  
  RETURN jsonb_build_object(
    'crashed', true, 
    'crash', c, 
    'cashout', _cash, 
    'payout', payout, 
    'balance', b
  );
END $$;

REVOKE EXECUTE ON FUNCTION public._javelin_settle FROM public, anon, authenticated;

-- 3. Javelin start RPC
CREATE OR REPLACE FUNCTION public.javelin_start(_stake bigint, _auto numeric) 
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE 
  u uuid; 
  c numeric; 
  sid uuid; 
  code text;
BEGIN
  u := public._check_play('javelin', _stake);
  
  IF _auto IS NOT NULL AND _auto < 1.01 THEN 
    RAISE EXCEPTION 'Auto cash-out must be at least 1.01'; 
  END IF;
  
  UPDATE public.game_sessions 
  SET active = false 
  WHERE user_id = u AND game = 'javelin' AND active AND created_at < now() - interval '10 minutes';
  
  IF EXISTS(SELECT 1 FROM public.game_sessions WHERE user_id = u AND game = 'javelin' AND active) THEN 
    RAISE EXCEPTION 'Finish your current throw first'; 
  END IF;
  
  c := public._crash_point(u);
  code := public._round_code('javelin');
  
  PERFORM public.adjust_balance(u, -_stake, 'game_stake', code, 'javelin');
  
  INSERT INTO public.game_sessions(user_id, game, stake, secret, state) 
  VALUES(
    u,
    'javelin',
    _stake,
    jsonb_build_object('crash', c),
    jsonb_build_object('auto', _auto, 'code', code, 'start', extract(epoch from clock_timestamp()))
  ) 
  RETURNING id INTO sid;
  
  RETURN jsonb_build_object(
    'session', sid, 
    'round_code', code, 
    'balance', (SELECT balance FROM public.profiles WHERE id = u)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.javelin_start TO authenticated;

-- 4. Javelin check / cashout RPC
CREATE OR REPLACE FUNCTION public.javelin_check(_session uuid, _cashout boolean) 
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE 
  s public.game_sessions; 
  el numeric; 
  m numeric; 
  c numeric; 
  a numeric;
BEGIN
  SELECT * INTO s 
  FROM public.game_sessions 
  WHERE id = _session AND user_id = auth.uid() AND active 
  FOR UPDATE;
  
  IF s IS NULL THEN 
    RAISE EXCEPTION 'No active throw'; 
  END IF;
  
  el := extract(epoch from clock_timestamp()) - (s.state->>'start')::numeric;
  m := floor(exp(0.09 * greatest(el, 0)) * 100) / 100.0;
  c := (s.secret->>'crash')::numeric; 
  a := (s.state->>'auto')::numeric;
  
  IF a IS NOT NULL AND a <= c AND m >= a THEN 
    RETURN public._javelin_settle(s, a); 
  END IF;
  
  IF m >= c THEN 
    RETURN public._javelin_settle(s, NULL); 
  END IF;
  
  IF _cashout THEN 
    RETURN public._javelin_settle(s, m); 
  END IF;
  
  RETURN jsonb_build_object('crashed', false, 'multiplier', m);
END $$;

GRANT EXECUTE ON FUNCTION public.javelin_check TO authenticated;

-- 5. Javelin reset stuck session helper
CREATE OR REPLACE FUNCTION public.javelin_reset_stuck() 
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.game_sessions 
  SET active = false 
  WHERE user_id = auth.uid() AND game = 'javelin' AND active;
  
  RETURN jsonb_build_object('success', true);
END $$;

GRANT EXECUTE ON FUNCTION public.javelin_reset_stuck TO authenticated;
