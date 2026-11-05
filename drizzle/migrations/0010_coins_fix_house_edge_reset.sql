alter table public.coin_requests add column if not exists screenshot_path text;

create or replace function public.submit_coin_deduction(_amount int, _note text) returns jsonb language plpgsql security definer set search_path=public as $$
declare bal bigint; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Please log in'; end if;
  if coalesce(length(trim(_note)),0) < 3 then raise exception 'Please write instructions for your request'; end if;
  if _amount is null or _amount < 1 then raise exception 'Enter a valid amount'; end if;
  select p.balance into bal from public.profiles p where p.id=auth.uid();
  if _amount > bal then raise exception 'Amount is more than your balance'; end if;
  if exists(select 1 from public.coin_deductions d where d.user_id=auth.uid() and d.status='pending') then raise exception 'You already have a pending withdrawal request'; end if;
  insert into public.coin_deductions(user_id,amount,note) values(auth.uid(),_amount,left(trim(_note),300)) returning coin_deductions.id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

drop function if exists public.submit_coin_request(int, text);
create or replace function public.submit_coin_request(_amount int, _note text, _screenshot text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare cfg jsonb; cnt int; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Please log in'; end if;
  if coalesce(length(trim(_note)),0) < 3 then raise exception 'Please write instructions for your request'; end if;
  if _screenshot is not null and _screenshot not like auth.uid()::text || '/%' then raise exception 'Invalid screenshot'; end if;
  select value into cfg from public.site_settings where key='coins';
  if _amount < coalesce((cfg->>'min')::int,300) or _amount > coalesce((cfg->>'max')::int,10000) then raise exception 'Amount must be between % and %', coalesce(cfg->>'min','300'), coalesce(cfg->>'max','10000'); end if;
  if exists(select 1 from public.coin_requests c where c.user_id=auth.uid() and c.status='pending') then raise exception 'You already have a pending request'; end if;
  select count(*) into cnt from public.coin_requests c where c.user_id=auth.uid() and c.created_at > now() - interval '1 day';
  if cnt >= coalesce((cfg->>'daily_limit')::int, 3) then raise exception 'Daily request limit reached'; end if;
  insert into public.coin_requests(user_id,amount,note,screenshot_path) values(auth.uid(),_amount,left(trim(_note),300),_screenshot) returning coin_requests.id into v_id;
  return jsonb_build_object('id', v_id);
end $$;
revoke execute on function public.submit_coin_request(int,text,text) from public, anon;
grant execute on function public.submit_coin_request(int,text,text) to authenticated;

-- WinGo: 2% service fee on every contract (published rule), results stored globally
create table if not exists public.wingo_results (
  game text not null, duration int not null, period bigint not null, number int not null,
  primary key (game, duration, period)
);
grant all on public.wingo_results to service_role;
alter table public.wingo_results enable row level security;

create or replace function public._wingo_mult(_kind text, _value text, _n integer) returns numeric language plpgsql immutable as $$
begin
  if _kind = 'number' then return case when _value::int = _n then 8.82 else 0 end; end if;
  if _kind = 'size' then return case when (_value='big' and _n>=5) or (_value='small' and _n<5) then 1.96 else 0 end; end if;
  if _kind = 'color' then
    if _value = 'violet' then return case when _n in (0,5) then 4.41 else 0 end; end if;
    if _value = 'green' then return case when _n = 5 then 1.47 when _n % 2 = 1 then 1.96 else 0 end; end if;
    if _value = 'red' then return case when _n = 0 then 1.47 when _n % 2 = 0 then 1.96 else 0 end; end if;
  end if;
  return 0;
end $$;

-- Result for a finished period: decided once, same for every player.
-- 65% of rounds the platform picks the number with the lowest total payout across ALL players' bets (house rounds);
-- other rounds use the random seed. Never targets an individual player.
create or replace function public._wingo_number(_game text, _duration integer, _period bigint) returns integer
language plpgsql security definer set search_path to 'public' as $$
declare n int; h text; best int; bestp numeric; i int; p numeric;
begin
  select number into n from public.wingo_results where game=_game and duration=_duration and period=_period;
  if n is not null then return n; end if;
  h := md5((select seed from public.game_seed where id=1) || _game || _duration || _period);
  n := (('x' || substr(h,1,8))::bit(32)::bigint % 10)::int;
  if (_period+1)*_duration > extract(epoch from now()) then return n; end if;
  if exists(select 1 from public.wingo_bets b where b.game=_game and b.duration=_duration and b.period=_period)
     and (('x' || substr(h,9,8))::bit(32)::bigint % 100) < 65 then
    bestp := null;
    for i in 0..9 loop
      select coalesce(sum(b.stake * public._wingo_mult(b.kind,b.value,i)),0) into p from public.wingo_bets b where b.game=_game and b.duration=_duration and b.period=_period;
      if bestp is null or p < bestp then bestp := p; best := i; end if;
    end loop;
    n := best;
  end if;
  insert into public.wingo_results(game,duration,period,number) values(_game,_duration,_period,n) on conflict do nothing;
  select number into n from public.wingo_results where game=_game and duration=_duration and period=_period;
  return n;
end $$;

create or replace function public.wingo_history(_game text, _duration integer, _n integer) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare cur bigint; res jsonb := '[]'; i int; n int; h text;
begin
  if _game not in ('wingo','trx','color') or _duration not in (30,60,180,300) then raise exception 'Invalid mode'; end if;
  cur := floor(extract(epoch from now()) / _duration)::bigint;
  for i in 1..least(greatest(_n,1),100) loop
    n := public._wingo_number(_game,_duration,cur-i);
    h := md5('blk' || (cur-i) || _game);
    res := res || jsonb_build_object('period', to_char(to_timestamp((cur-i)*_duration),'YYYYMMDD') || lpad(((cur-i) % 100000)::text,5,'0'), 'raw', cur-i, 'number', n, 'hash', substr(h,1,6) || '...' || substr(h,27,5) || n);
  end loop;
  return res;
end $$;

create or replace function public._chicken_p(_d text) returns numeric language sql immutable as $$
  select case _d when 'easy' then 0.08 when 'medium' then 0.18 when 'hard' then 0.28 when 'hardcore' then 0.4 else null end::numeric
$$;

create or replace function public._mines_mult(_m integer, _k integer) returns numeric language plpgsql immutable as $$
declare r numeric := 0.92; i int;
begin
  if _k = 0 then return 1; end if;
  for i in 0.._k-1 loop r := r * (25 - i)::numeric / (25 - _m - i); end loop;
  return round(r, 2);
end $$;

create or replace function public._crash_point(_u uuid) returns numeric language plpgsql security definer set search_path to 'public' as $$
declare r double precision := public.rand01(); c numeric;
begin
  if r < 0.25 then return 1.00; end if;
  c := 0.92 / (1 - public.rand01());
  return greatest(1.01, least(floor(c*100)/100.0, 200));
end $$;

create or replace function public.play_instant(_game text, _stake bigint, _params jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare u uuid; code text; payout bigint := 0; res jsonb; r double precision; t numeric; m numeric;
  path int[] := '{}'; slot int := 0; i int; mults numeric[] := array[22,8,3,1.4,0.7,0.4,0.2,0.4,0.7,1.4,3,8,22];
  d int; tg int; pick text; winner text; b bigint;
begin
  u := public._check_play(_game, _stake);
  code := public._round_code(_game);
  perform public.adjust_balance(u, -_stake, 'game_stake', code, _game);
  if _game = 'dice' then
    t := (_params->>'target')::numeric;
    if t is null or t < 2 or t > 95 then raise exception 'Target must be 2-95'; end if;
    r := floor(public.rand01()*10000)/100.0;
    m := round(92.0/t, 4);
    if r < t then payout := floor(_stake*m); end if;
    res := jsonb_build_object('roll', r, 'target', t, 'multiplier', m, 'win', r < t);
  elsif _game = 'limbo' then
    t := (_params->>'target')::numeric;
    if t is null or t < 1.01 or t > 1000 then raise exception 'Target must be 1.01-1000'; end if;
    r := public.rand01();
    m := greatest(1.00, floor((0.92/(1-r))*100)/100.0);
    if m >= t then payout := floor(_stake*t); end if;
    res := jsonb_build_object('result', m, 'target', t, 'win', m >= t);
  elsif _game = 'plinko' then
    for i in 1..12 loop
      if public.rand01() < 0.5 then path := path || 0; else path := path || 1; slot := slot + 1; end if;
    end loop;
    m := mults[slot+1];
    payout := floor(_stake*m);
    res := jsonb_build_object('path', to_jsonb(path), 'slot', slot, 'multiplier', m, 'win', m >= 1);
  elsif _game = 'dragon-tiger' then
    pick := _params->>'pick';
    if pick not in ('dragon','tiger','tie') then raise exception 'Pick dragon, tiger or tie'; end if;
    d := 1 + floor(public.rand01()*13); tg := 1 + floor(public.rand01()*13);
    winner := case when d > tg then 'dragon' when tg > d then 'tiger' else 'tie' end;
    if pick = winner then payout := case when pick='tie' then _stake*9 else floor(_stake*1.95) end;
    elsif winner='tie' then payout := floor(_stake/2.0); end if;
    res := jsonb_build_object('dragon', d, 'tiger', tg, 'dragon_suit', floor(public.rand01()*4), 'tiger_suit', floor(public.rand01()*4), 'winner', winner, 'win', pick=winner);
  else
    raise exception 'Unknown game';
  end if;
  b := public._finish(u, _game, code, _stake, payout, _params, res);
  return res || jsonb_build_object('payout', payout, 'round_code', code, 'balance', b);
end $$;

-- Admin: fresh-start reset of all play/coin statistics
create or replace function public.admin_reset_stats() returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  delete from public.game_rounds where id is not null;
  delete from public.wingo_bets where id is not null;
  delete from public.game_sessions where id is not null;
  delete from public.transactions where id is not null;
  delete from public.coin_requests where id is not null;
  delete from public.coin_deductions where id is not null;
  delete from public.gift_redemptions where id is not null;
  update public.gift_codes set used_count = 0 where id is not null;
  delete from public.crash_cycle where user_id is not null;
  update public.profiles set balance = 0, commission_claimed = 0 where id is not null;
  insert into public.admin_logs(admin_id,action,details) values(auth.uid(),'reset_stats','{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.admin_reset_stats from public, anon;
grant execute on function public.admin_reset_stats to authenticated;