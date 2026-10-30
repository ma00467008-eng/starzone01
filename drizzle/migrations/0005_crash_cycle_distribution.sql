CREATE TABLE IF NOT EXISTS public.crash_cycle (user_id uuid PRIMARY KEY, played int NOT NULL DEFAULT 0, big_at int NOT NULL DEFAULT 20);
GRANT ALL ON public.crash_cycle TO service_role;
ALTER TABLE public.crash_cycle ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public._crash_point(_u uuid) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
declare cy public.crash_cycle; r double precision := public.rand01(); c numeric;
begin
  insert into public.crash_cycle(user_id, played, big_at) values(_u, 0, 15 + floor(public.rand01()*16)::int) on conflict (user_id) do nothing;
  select * into cy from public.crash_cycle where user_id=_u for update;
  if cy.played + 1 >= cy.big_at then
    c := round((30 + public.rand01()*10)::numeric, 2);
    update public.crash_cycle set played=0, big_at=15 + floor(public.rand01()*16)::int where user_id=_u;
    return c;
  end if;
  update public.crash_cycle set played=played+1 where user_id=_u;
  if r < 0.12 then c := 1.00;
  elsif r < 0.55 then c := 1.01 + public.rand01()*0.99;
  elsif r < 0.88 then c := 2 + public.rand01()*3;
  else c := 5 + public.rand01()*10; end if;
  return floor(c*100)/100.0;
end $$;
REVOKE EXECUTE ON FUNCTION public._crash_point FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.crash_start(_stake bigint, _auto numeric) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
declare u uuid; c numeric; sid uuid; code text;
begin
  u := public._check_play('aviator', _stake);
  if _auto is not null and _auto < 1.01 then raise exception 'Auto cash-out must be at least 1.01'; end if;
  update public.game_sessions set active=false where user_id=u and game='aviator' and active and created_at < now() - interval '10 minutes';
  if exists(select 1 from public.game_sessions where user_id=u and game='aviator' and active) then raise exception 'Finish your current flight first'; end if;
  c := public._crash_point(u);
  code := public._round_code('aviator');
  perform public.adjust_balance(u, -_stake, 'game_stake', code, 'aviator');
  insert into public.game_sessions(user_id,game,stake,secret,state) values(u,'aviator',_stake,jsonb_build_object('crash',c),jsonb_build_object('auto',_auto,'code',code,'start',extract(epoch from clock_timestamp()))) returning id into sid;
  return jsonb_build_object('session', sid, 'round_code', code, 'balance', (select balance from public.profiles where id=u));
end $$;
GRANT EXECUTE ON FUNCTION public.crash_start TO authenticated;