
create or replace function public.rand01() returns double precision language sql volatile as $$
  select ('x' || encode(extensions.gen_random_bytes(6),'hex'))::bit(48)::bigint / 281474976710656.0
$$;

create or replace function public._check_play(_game text, _stake bigint) returns uuid language plpgsql security definer set search_path=public as $$
declare g public.games; p public.profiles;
begin
  if auth.uid() is null then raise exception 'Please log in'; end if;
  select * into p from public.profiles where id = auth.uid();
  if p.status <> 'active' then raise exception 'Account suspended'; end if;
  select * into g from public.games where slug=_game;
  if g is null or not g.enabled then raise exception 'Game unavailable'; end if;
  if g.maintenance then raise exception 'Game under maintenance'; end if;
  if _stake < g.min_stake or _stake > g.max_stake then raise exception 'Stake must be between % and %', g.min_stake, g.max_stake; end if;
  return auth.uid();
end $$;
revoke execute on function public._check_play from public, anon, authenticated;

create or replace function public._round_code(_game text) returns text language sql volatile as $$
  select upper(substr(_game,1,2)) || to_char(now(),'YYMMDDHH24MISS') || lpad((floor(random()*1000))::text,3,'0')
$$;

create or replace function public._finish(_u uuid, _game text, _code text, _stake bigint, _payout bigint, _sel jsonb, _res jsonb) returns bigint language plpgsql security definer set search_path=public as $$
declare b bigint;
begin
  insert into public.game_rounds(user_id,game,round_code,stake,payout,selection,result) values(_u,_game,_code,_stake,_payout,_sel,_res);
  if _payout > 0 then b := public.adjust_balance(_u,_payout,'game_win',_code,_game);
  else select balance into b from public.profiles where id=_u; end if;
  return b;
end $$;
revoke execute on function public._finish from public, anon, authenticated;

-- INSTANT GAMES: dice, limbo, plinko, dragon-tiger
create or replace function public.play_instant(_game text, _stake bigint, _params jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid; code text; payout bigint := 0; res jsonb; r double precision; t numeric; m numeric;
  path int[] := '{}'; slot int := 0; i int; mults numeric[] := array[33,11,4,2,1.1,0.6,0.3,0.6,1.1,2,4,11,33];
  d int; tg int; pick text; winner text; b bigint;
begin
  u := public._check_play(_game, _stake);
  code := public._round_code(_game);
  perform public.adjust_balance(u, -_stake, 'game_stake', code, _game);
  if _game = 'dice' then
    t := (_params->>'target')::numeric;
    if t is null or t < 2 or t > 95 then raise exception 'Target must be 2-95'; end if;
    r := floor(public.rand01()*10000)/100.0;
    m := round(99.0/t, 4);
    if r < t then payout := floor(_stake*m); end if;
    res := jsonb_build_object('roll', r, 'target', t, 'multiplier', m, 'win', r < t);
  elsif _game = 'limbo' then
    t := (_params->>'target')::numeric;
    if t is null or t < 1.01 or t > 1000 then raise exception 'Target must be 1.01-1000'; end if;
    r := public.rand01();
    m := greatest(1.00, floor((0.99/(1-r))*100)/100.0);
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
    if pick = winner then payout := case when pick='tie' then _stake*9 else _stake*2 end;
    elsif winner='tie' then payout := floor(_stake/2.0); end if;
    res := jsonb_build_object('dragon', d, 'tiger', tg, 'dragon_suit', floor(public.rand01()*4), 'tiger_suit', floor(public.rand01()*4), 'winner', winner, 'win', pick=winner);
  else
    raise exception 'Unknown game';
  end if;
  b := public._finish(u, _game, code, _stake, payout, _params, res);
  return res || jsonb_build_object('payout', payout, 'round_code', code, 'balance', b);
end $$;
grant execute on function public.play_instant to authenticated;

-- MINES
create or replace function public.mines_start(_stake bigint, _mines int) returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid; tiles int[] := '{}'; x int; sid uuid; code text;
begin
  if _mines < 1 or _mines > 24 then raise exception 'Mines must be 1-24'; end if;
  u := public._check_play('mines', _stake);
  if exists(select 1 from public.game_sessions where user_id=u and game='mines' and active) then raise exception 'Finish your current round first'; end if;
  while coalesce(array_length(tiles,1),0) < _mines loop
    x := floor(public.rand01()*25);
    if not x = any(tiles) then tiles := tiles || x; end if;
  end loop;
  code := public._round_code('mines');
  perform public.adjust_balance(u, -_stake, 'game_stake', code, 'mines');
  insert into public.game_sessions(user_id,game,stake,secret,state) values(u,'mines',_stake,jsonb_build_object('mines',to_jsonb(tiles)),jsonb_build_object('revealed','[]'::jsonb,'count',_mines,'code',code,'multiplier',1)) returning id into sid;
  return jsonb_build_object('session', sid, 'round_code', code, 'balance', (select balance from public.profiles where id=u));
end $$;
grant execute on function public.mines_start to authenticated;

create or replace function public._mines_mult(_m int, _k int) returns numeric language plpgsql immutable as $$
declare r numeric := 0.97; i int;
begin
  if _k = 0 then return 1; end if;
  for i in 0.._k-1 loop r := r * (25 - i)::numeric / (25 - _m - i); end loop;
  return round(r, 2);
end $$;

create or replace function public.mines_reveal(_session uuid, _tile int) returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.game_sessions; mines jsonb; rev jsonb; k int; m numeric; b bigint;
begin
  select * into s from public.game_sessions where id=_session and user_id=auth.uid() and active for update;
  if s is null then raise exception 'No active round'; end if;
  if _tile < 0 or _tile > 24 then raise exception 'Invalid tile'; end if;
  rev := s.state->'revealed';
  if rev @> to_jsonb(_tile) then raise exception 'Already revealed'; end if;
  mines := s.secret->'mines';
  if mines @> to_jsonb(_tile) then
    update public.game_sessions set active=false, state=state||jsonb_build_object('lost',true) where id=s.id;
    b := public._finish(s.user_id,'mines',s.state->>'code',s.stake,0,jsonb_build_object('mines',(s.state->>'count')::int),jsonb_build_object('mines',mines,'revealed',rev,'hit',_tile,'win',false));
    return jsonb_build_object('mine', true, 'mines', mines, 'balance', b);
  end if;
  rev := rev || to_jsonb(_tile);
  k := jsonb_array_length(rev);
  m := public._mines_mult((s.state->>'count')::int, k);
  update public.game_sessions set state = state || jsonb_build_object('revealed', rev, 'multiplier', m) where id=s.id;
  if k = 25 - (s.state->>'count')::int then return public.mines_cashout(_session); end if;
  return jsonb_build_object('mine', false, 'multiplier', m, 'next', public._mines_mult((s.state->>'count')::int, k+1), 'revealed', rev);
end $$;

create or replace function public.mines_cashout(_session uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.game_sessions; m numeric; payout bigint; b bigint;
begin
  select * into s from public.game_sessions where id=_session and user_id=auth.uid() and active for update;
  if s is null then raise exception 'No active round'; end if;
  if jsonb_array_length(s.state->'revealed') = 0 then raise exception 'Reveal at least one tile'; end if;
  m := (s.state->>'multiplier')::numeric; payout := floor(s.stake*m);
  update public.game_sessions set active=false where id=s.id;
  b := public._finish(s.user_id,'mines',s.state->>'code',s.stake,payout,jsonb_build_object('mines',(s.state->>'count')::int),jsonb_build_object('mines',s.secret->'mines','revealed',s.state->'revealed','multiplier',m,'win',true));
  return jsonb_build_object('payout', payout, 'multiplier', m, 'mines', s.secret->'mines', 'balance', b);
end $$;
grant execute on function public.mines_reveal to authenticated;
grant execute on function public.mines_cashout to authenticated;

-- CHICKEN ROAD
create or replace function public._chicken_p(_d text) returns numeric language sql immutable as $$
  select case _d when 'easy' then 0.04 when 'medium' then 0.12 when 'hard' then 0.2 when 'hardcore' then 0.3 else null end::numeric
$$;

create or replace function public.chicken_start(_stake bigint, _difficulty text) returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid; p numeric; hz int := 1; sid uuid; code text;
begin
  p := public._chicken_p(_difficulty);
  if p is null then raise exception 'Invalid difficulty'; end if;
  u := public._check_play('chicken', _stake);
  if exists(select 1 from public.game_sessions where user_id=u and game='chicken' and active) then raise exception 'Finish your current round first'; end if;
  while hz <= 20 and public.rand01() >= p loop hz := hz + 1; end loop;
  code := public._round_code('chicken');
  perform public.adjust_balance(u, -_stake, 'game_stake', code, 'chicken');
  insert into public.game_sessions(user_id,game,stake,secret,state) values(u,'chicken',_stake,jsonb_build_object('hazard',hz),jsonb_build_object('lane',0,'p',p,'difficulty',_difficulty,'code',code)) returning id into sid;
  return jsonb_build_object('session', sid, 'round_code', code, 'balance', (select balance from public.profiles where id=u));
end $$;

create or replace function public.chicken_step(_session uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.game_sessions; lane int; p numeric; m numeric; b bigint;
begin
  select * into s from public.game_sessions where id=_session and user_id=auth.uid() and active for update;
  if s is null then raise exception 'No active round'; end if;
  lane := (s.state->>'lane')::int + 1; p := (s.state->>'p')::numeric;
  if lane >= (s.secret->>'hazard')::int then
    update public.game_sessions set active=false where id=s.id;
    b := public._finish(s.user_id,'chicken',s.state->>'code',s.stake,0,jsonb_build_object('difficulty',s.state->>'difficulty'),jsonb_build_object('lane',lane,'hazard',(s.secret->>'hazard')::int,'win',false));
    return jsonb_build_object('hit', true, 'lane', lane, 'balance', b);
  end if;
  m := round(0.97 / power(1-p, lane), 2);
  update public.game_sessions set state = state || jsonb_build_object('lane',lane,'multiplier',m) where id=s.id;
  if lane = 20 then return public.chicken_cashout(_session); end if;
  return jsonb_build_object('hit', false, 'lane', lane, 'multiplier', m);
end $$;

create or replace function public.chicken_cashout(_session uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.game_sessions; m numeric; payout bigint; b bigint;
begin
  select * into s from public.game_sessions where id=_session and user_id=auth.uid() and active for update;
  if s is null then raise exception 'No active round'; end if;
  if (s.state->>'lane')::int = 0 then raise exception 'Move at least one lane'; end if;
  m := (s.state->>'multiplier')::numeric; payout := floor(s.stake*m);
  update public.game_sessions set active=false where id=s.id;
  b := public._finish(s.user_id,'chicken',s.state->>'code',s.stake,payout,jsonb_build_object('difficulty',s.state->>'difficulty'),jsonb_build_object('lane',(s.state->>'lane')::int,'hazard',(s.secret->>'hazard')::int,'multiplier',m,'win',true));
  return jsonb_build_object('payout', payout, 'multiplier', m, 'hazard', (s.secret->>'hazard')::int, 'balance', b);
end $$;
grant execute on function public.chicken_start to authenticated;
grant execute on function public.chicken_step to authenticated;
grant execute on function public.chicken_cashout to authenticated;

-- CRASH (multiplier m(t) = e^(0.1 t))
create or replace function public.crash_start(_stake bigint, _auto numeric) returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid; c numeric; sid uuid; code text; r double precision;
begin
  u := public._check_play('aviator', _stake);
  if _auto is not null and _auto < 1.01 then raise exception 'Auto cash-out must be at least 1.01'; end if;
  update public.game_sessions set active=false where user_id=u and game='aviator' and active and created_at < now() - interval '10 minutes';
  if exists(select 1 from public.game_sessions where user_id=u and game='aviator' and active) then raise exception 'Finish your current flight first'; end if;
  r := public.rand01();
  c := greatest(1.00, floor((0.97/(1-r))*100)/100.0);
  code := public._round_code('aviator');
  perform public.adjust_balance(u, -_stake, 'game_stake', code, 'aviator');
  insert into public.game_sessions(user_id,game,stake,secret,state) values(u,'aviator',_stake,jsonb_build_object('crash',c),jsonb_build_object('auto',_auto,'code',code,'start',extract(epoch from clock_timestamp()))) returning id into sid;
  return jsonb_build_object('session', sid, 'round_code', code, 'balance', (select balance from public.profiles where id=u));
end $$;

create or replace function public._crash_settle(s public.game_sessions, _cash numeric) returns jsonb language plpgsql security definer set search_path=public as $$
declare payout bigint := 0; b bigint; c numeric := (s.secret->>'crash')::numeric;
begin
  if _cash is not null then payout := floor(s.stake * _cash); end if;
  update public.game_sessions set active=false where id=s.id;
  b := public._finish(s.user_id,'aviator',s.state->>'code',s.stake,payout,jsonb_build_object('auto',s.state->'auto'),jsonb_build_object('crash',c,'cashout',_cash,'win',_cash is not null));
  insert into public.transactions(user_id,amount,balance_after,kind,ref,note) select s.user_id,0,b,'crash_point',s.state->>'code',c::text where false;
  return jsonb_build_object('crashed', true, 'crash', c, 'cashout', _cash, 'payout', payout, 'balance', b);
end $$;
revoke execute on function public._crash_settle from public, anon, authenticated;

create or replace function public.crash_check(_session uuid, _cashout boolean) returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.game_sessions; el numeric; m numeric; c numeric; a numeric;
begin
  select * into s from public.game_sessions where id=_session and user_id=auth.uid() and active for update;
  if s is null then raise exception 'No active flight'; end if;
  el := extract(epoch from clock_timestamp()) - (s.state->>'start')::numeric;
  m := floor(exp(0.1 * greatest(el,0)) * 100) / 100.0;
  c := (s.secret->>'crash')::numeric; a := (s.state->>'auto')::numeric;
  if a is not null and a <= c and m >= a then return public._crash_settle(s, a); end if;
  if m >= c then return public._crash_settle(s, null); end if;
  if _cashout then return public._crash_settle(s, m); end if;
  return jsonb_build_object('crashed', false, 'multiplier', m);
end $$;
grant execute on function public.crash_start to authenticated;
grant execute on function public.crash_check to authenticated;

-- WINGO family (wingo, trx, color)
create table public.wingo_bets (
  id bigserial primary key, user_id uuid not null, game text not null, duration int not null, period bigint not null,
  kind text not null, value text not null, stake bigint not null, settled boolean not null default false, created_at timestamptz default now()
);
create index on public.wingo_bets(user_id, settled);
grant select on public.wingo_bets to authenticated; grant all on public.wingo_bets to service_role;
alter table public.wingo_bets enable row level security;
create policy "own bets" on public.wingo_bets for select to authenticated using (user_id = auth.uid() or public.is_admin());

create or replace function public._wingo_number(_game text, _duration int, _period bigint) returns int language sql stable security definer set search_path=public as $$
  select (('x' || substr(md5((select seed from public.game_seed where id=1) || _game || _duration || _period),1,8))::bit(32)::bigint % 10)::int
$$;
revoke execute on function public._wingo_number from public, anon, authenticated;

create or replace function public.wingo_history(_game text, _duration int, _n int) returns jsonb language plpgsql stable security definer set search_path=public as $$
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
grant execute on function public.wingo_history to authenticated, anon;

create or replace function public._wingo_mult(_kind text, _value text, _n int) returns numeric language plpgsql immutable as $$
begin
  if _kind = 'number' then return case when _value::int = _n then 9 else 0 end; end if;
  if _kind = 'size' then return case when (_value='big' and _n>=5) or (_value='small' and _n<5) then 2 else 0 end; end if;
  if _kind = 'color' then
    if _value = 'violet' then return case when _n in (0,5) then 4.5 else 0 end; end if;
    if _value = 'green' then return case when _n = 5 then 1.5 when _n % 2 = 1 then 2 else 0 end; end if;
    if _value = 'red' then return case when _n = 0 then 1.5 when _n % 2 = 0 then 2 else 0 end; end if;
  end if;
  return 0;
end $$;

create or replace function public.wingo_bet(_game text, _duration int, _kind text, _value text, _stake bigint) returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid; cur bigint; remain numeric; b bigint;
begin
  if _game not in ('wingo','trx','color') or _duration not in (30,60,180,300) then raise exception 'Invalid mode'; end if;
  if not ((_kind='number' and _value in ('0','1','2','3','4','5','6','7','8','9')) or (_kind='size' and _value in ('big','small')) or (_kind='color' and _value in ('red','green','violet'))) then raise exception 'Invalid selection'; end if;
  u := public._check_play(_game, _stake);
  cur := floor(extract(epoch from now()) / _duration)::bigint;
  remain := (cur+1)*_duration - extract(epoch from now());
  if remain < 5 then raise exception 'Betting is closed for this round'; end if;
  b := public.adjust_balance(u, -_stake, 'game_stake', _game || '-' || cur, _game);
  insert into public.wingo_bets(user_id,game,duration,period,kind,value,stake) values(u,_game,_duration,cur,_kind,_value,_stake);
  return jsonb_build_object('balance', b, 'period', cur);
end $$;
grant execute on function public.wingo_bet to authenticated;

create or replace function public.wingo_settle() returns jsonb language plpgsql security definer set search_path=public as $$
declare r record; n int; m numeric; payout bigint; cnt int := 0; won bigint := 0;
begin
  for r in select * from public.wingo_bets where user_id=auth.uid() and not settled and (period+1)*duration <= extract(epoch from now()) for update loop
    n := public._wingo_number(r.game, r.duration, r.period);
    m := public._wingo_mult(r.kind, r.value, n);
    payout := floor(r.stake*m);
    update public.wingo_bets set settled=true where id=r.id;
    perform public._finish(r.user_id, r.game, r.game || '-' || r.duration || '-' || r.period, r.stake, payout,
      jsonb_build_object('kind',r.kind,'value',r.value,'duration',r.duration), jsonb_build_object('number',n,'multiplier',m,'win',payout>0));
    cnt := cnt + 1; won := won + payout;
  end loop;
  return jsonb_build_object('settled', cnt, 'won', won, 'balance', (select balance from public.profiles where id=auth.uid()));
end $$;
grant execute on function public.wingo_settle to authenticated;

-- COINS / GIFTS
create or replace function public.submit_coin_request(_amount int, _note text) returns jsonb language plpgsql security definer set search_path=public as $$
declare cfg jsonb; cnt int; id uuid;
begin
  if auth.uid() is null then raise exception 'Please log in'; end if;
  select value into cfg from public.site_settings where key='coins';
  if _amount < (cfg->>'min')::int or _amount > (cfg->>'max')::int then raise exception 'Amount must be between % and %', cfg->>'min', cfg->>'max'; end if;
  if exists(select 1 from public.coin_requests where user_id=auth.uid() and status='pending') then raise exception 'You already have a pending request'; end if;
  select count(*) into cnt from public.coin_requests where user_id=auth.uid() and created_at > now() - interval '1 day';
  if cnt >= coalesce((cfg->>'daily_limit')::int, 3) then raise exception 'Daily request limit reached'; end if;
  insert into public.coin_requests(user_id,amount,note) values(auth.uid(),_amount,left(_note,300)) returning coin_requests.id into id;
  return jsonb_build_object('id', id);
end $$;
grant execute on function public.submit_coin_request to authenticated;

create or replace function public.redeem_gift(_code text) returns jsonb language plpgsql security definer set search_path=public as $$
declare g public.gift_codes; b bigint;
begin
  if auth.uid() is null then raise exception 'Please log in'; end if;
  select * into g from public.gift_codes where upper(code)=upper(trim(_code)) for update;
  if g is null or not g.active then raise exception 'Invalid gift code'; end if;
  if g.expires_at is not null and g.expires_at < now() then raise exception 'This gift code has expired'; end if;
  if g.used_count >= g.usage_limit then raise exception 'This gift code is fully redeemed'; end if;
  if exists(select 1 from public.gift_redemptions where code_id=g.id and user_id=auth.uid()) then raise exception 'You already redeemed this code'; end if;
  insert into public.gift_redemptions(code_id,user_id) values(g.id,auth.uid());
  update public.gift_codes set used_count=used_count+1 where id=g.id;
  b := public.adjust_balance(auth.uid(), g.reward, 'gift', g.code, 'Gift code');
  perform public.notify(auth.uid(), 'Gift redeemed', 'You received ' || g.reward || ' coins from code ' || g.code, 'gift');
  return jsonb_build_object('reward', g.reward, 'balance', b);
end $$;
grant execute on function public.redeem_gift to authenticated;

create or replace function public.clear_must_change() returns void language sql security definer set search_path=public as $$
  update public.profiles set must_change_password=false where id=auth.uid();
$$;
grant execute on function public.clear_must_change to authenticated;

-- ADMIN RPCs
create or replace function public.admin_review_coin(_id uuid, _approve boolean, _note text) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.coin_requests;
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  select * into r from public.coin_requests where id=_id for update;
  if r is null then raise exception 'Not found'; end if;
  if r.status <> 'pending' then raise exception 'Request already %', r.status; end if;
  update public.coin_requests set status = case when _approve then 'approved' else 'rejected' end, admin_note=_note, reviewed_by=auth.uid(), reviewed_at=now() where id=_id;
  if _approve then
    perform public.adjust_balance(r.user_id, r.amount, 'coin_request', r.id::text, 'Approved coin request');
    perform public.notify(r.user_id, 'Coin request approved', r.amount || ' virtual coins were added to your balance.', 'coins');
  else
    perform public.notify(r.user_id, 'Coin request rejected', coalesce(_note,'Your coin request was not approved.'), 'coins');
  end if;
  insert into public.admin_logs(admin_id,action,details) values(auth.uid(), case when _approve then 'approve_coins' else 'reject_coins' end, jsonb_build_object('request',_id,'amount',r.amount));
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.admin_review_coin to authenticated;

create or replace function public.admin_adjust_balance(_user uuid, _amount bigint, _reason text) returns bigint language plpgsql security definer set search_path=public as $$
declare b bigint;
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  if coalesce(trim(_reason),'') = '' then raise exception 'Reason required'; end if;
  b := public.adjust_balance(_user, _amount, case when _amount>=0 then 'admin_credit' else 'admin_debit' end, null, _reason);
  perform public.notify(_user, case when _amount>=0 then 'Coins credited' else 'Coins deducted' end, abs(_amount) || ' coins. Reason: ' || _reason, 'coins');
  insert into public.admin_logs(admin_id,action,details) values(auth.uid(),'adjust_balance',jsonb_build_object('user',_user,'amount',_amount,'reason',_reason));
  return b;
end $$;
grant execute on function public.admin_adjust_balance to authenticated;

create or replace function public.admin_set_status(_user uuid, _status text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  if _status not in ('active','suspended') then raise exception 'Invalid status'; end if;
  update public.profiles set status=_status where id=_user;
  insert into public.admin_logs(admin_id,action,details) values(auth.uid(),'set_status',jsonb_build_object('user',_user,'status',_status));
end $$;
grant execute on function public.admin_set_status to authenticated;

create or replace function public.admin_stats() returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'active', (select count(*) from public.profiles where last_seen > now() - interval '1 day'),
    'new_today', (select count(*) from public.profiles where created_at > now() - interval '1 day'),
    'coins', (select coalesce(sum(balance),0) from public.profiles),
    'pending_coins', (select count(*) from public.coin_requests where status='pending'),
    'games_played', (select count(*) from public.game_rounds),
    'games_today', (select count(*) from public.game_rounds where created_at > now() - interval '1 day'),
    'pending_tickets', (select count(*) from public.tickets where status <> 'closed'),
    'unread_messages', (select count(*) from public.chat_messages where sender='user' and not read_by_admin),
    'by_game', (select coalesce(jsonb_object_agg(game, c),'{}') from (select game, count(*) c from public.game_rounds group by game) x)
  );
end $$;
grant execute on function public.admin_stats to authenticated;

create or replace function public.admin_conversations() returns table(user_id uuid, uid text, username text, phone text, last_at timestamptz, last_body text, unread bigint) language sql stable security definer set search_path=public as $$
  select p.id, p.uid, p.username, p.phone, m.created_at, coalesce(m.body,'[image]'),
    (select count(*) from public.chat_messages c where c.user_id=p.id and c.sender='user' and not c.read_by_admin)
  from public.profiles p
  join lateral (select * from public.chat_messages c where c.user_id=p.id order by created_at desc limit 1) m on true
  where public.is_admin()
  order by m.created_at desc
$$;
grant execute on function public.admin_conversations to authenticated;
