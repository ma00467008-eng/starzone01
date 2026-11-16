ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referrer_id uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS commission_claimed bigint NOT NULL DEFAULT 0;
UPDATE public.profiles SET referral_code = upper(substr(md5(id::text || random()::text),1,8)) WHERE referral_code IS NULL;
CREATE INDEX IF NOT EXISTS profiles_referrer_idx ON public.profiles(referrer_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _uid text; _phone text; _code text; _ref uuid;
begin
  if coalesce(new.raw_app_meta_data->>'starzone','') <> 'true' then return new; end if;
  if exists(select 1 from public.profiles where id=new.id) then return new; end if;
  _phone := new.raw_app_meta_data->>'phone';
  loop
    _uid := (10000000 + floor(random()*89999999))::bigint::text;
    exit when not exists(select 1 from public.profiles where uid=_uid);
  end loop;
  loop
    _code := upper(substr(md5(random()::text),1,8));
    exit when not exists(select 1 from public.profiles where referral_code=_code);
  end loop;
  select id into _ref from public.profiles where referral_code = upper(nullif(new.raw_app_meta_data->>'ref',''));
  insert into public.profiles(id, uid, phone, username, avatar, balance, must_change_password, referral_code, referrer_id)
  values (new.id, _uid, _phone, 'Star' || upper(substr(md5(random()::text),1,6)), 1 + floor(random()*8)::int, 0, false, _code, _ref);
  insert into public.user_roles(user_id, role) values (new.id, 'user');
  
  insert into public.chat_messages(user_id, sender, body, image_url, read_by_admin, created_at)
  select new.id, 'admin', a.body, a.image_url, true, now() + (a.sort * interval '1 millisecond')
  from public.auto_messages a where a.enabled order by a.sort;
  return new;
end $function$;

-- commission rate per level (fraction of subordinate bet turnover), editable via site_settings key 'referral'
CREATE OR REPLACE FUNCTION public._ref_rates() RETURNS numeric[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  select coalesce(
    (select array(select jsonb_array_elements_text(value->'rates')::numeric) from site_settings where key='referral'),
    array[0.006,0.0018,0.00054,0.00016,0.000048,0.000014]::numeric[])
$$;

CREATE OR REPLACE FUNCTION public._ref_tree(_u uuid) RETURNS TABLE(id uuid, lvl int) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  with recursive t as (
    select p.id, 1 as lvl from profiles p where p.referrer_id = _u
    union all
    select p.id, t.lvl+1 from profiles p join t on p.referrer_id = t.id where t.lvl < 6
  ) select id, lvl from t
$$;

CREATE OR REPLACE FUNCTION public._ref_commission(_u uuid, _since timestamptz) RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  select coalesce(floor(sum(g.stake * (public._ref_rates())[t.lvl])),0)::bigint
  from public._ref_tree(_u) t join game_rounds g on g.user_id = t.id
  where _since is null or g.created_at >= _since
$$;

CREATE OR REPLACE FUNCTION public.my_earn() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
declare _u uuid := auth.uid(); _today timestamptz := date_trunc('day', now()); _yday timestamptz := date_trunc('day', now()) - interval '1 day';
  _total bigint; _claimed bigint; _levels jsonb; _p record;
begin
  if _u is null then raise exception 'Login required'; end if;
  select * into _p from profiles where id=_u;
  _total := public._ref_commission(_u, null);
  select coalesce(jsonb_agg(x order by (x->>'level')::int), '[]'::jsonb) into _levels from (
    select jsonb_build_object(
      'level', l, 'rate', (public._ref_rates())[l],
      'members', (select count(*) from _ref_tree(_u) t where t.lvl=l),
      'new_today', (select count(*) from _ref_tree(_u) t join profiles p on p.id=t.id where t.lvl=l and p.created_at>=_today),
      'deposit_users', (select count(distinct c.user_id) from _ref_tree(_u) t join coin_requests c on c.user_id=t.id and c.status='approved' where t.lvl=l),
      'deposit_amount', (select coalesce(sum(c.amount),0) from _ref_tree(_u) t join coin_requests c on c.user_id=t.id and c.status='approved' where t.lvl=l),
      'bet_amount', (select coalesce(sum(g.stake),0) from _ref_tree(_u) t join game_rounds g on g.user_id=t.id where t.lvl=l),
      'bet_today', (select coalesce(sum(g.stake),0) from _ref_tree(_u) t join game_rounds g on g.user_id=t.id where t.lvl=l and g.created_at>=_today),
      'users', (select coalesce(jsonb_agg(jsonb_build_object(
          'uid', p.uid, 'joined', p.created_at,
          'deposit', (select coalesce(sum(c.amount),0) from coin_requests c where c.user_id=p.id and c.status='approved'),
          'bet', (select coalesce(sum(g.stake),0) from game_rounds g where g.user_id=p.id)) order by p.created_at desc),'[]'::jsonb)
        from _ref_tree(_u) t join profiles p on p.id=t.id where t.lvl=l)
    ) x from generate_series(1,6) l) s;
  return jsonb_build_object(
    'code', _p.referral_code,
    'total_commission', _total,
    'claimable', greatest(_total - _p.commission_claimed, 0),
    'claimed', _p.commission_claimed,
    'today_commission', public._ref_commission(_u, _today),
    'yesterday_commission', public._ref_commission(_u, _yday) - public._ref_commission(_u, _today),
    'levels', _levels);
end $$;

CREATE OR REPLACE FUNCTION public.claim_commission() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
declare _u uuid := auth.uid(); _total bigint; _claimed bigint; _amt bigint; _bal bigint;
begin
  if _u is null then raise exception 'Login required'; end if;
  select commission_claimed into _claimed from profiles where id=_u for update;
  _total := public._ref_commission(_u, null);
  _amt := _total - _claimed;
  if _amt <= 0 then raise exception 'No commission to claim'; end if;
  update profiles set commission_claimed = _total where id=_u;
  _bal := public.adjust_balance(_u, _amt, 'commission', null, 'Referral commission');
  return jsonb_build_object('amount', _amt, 'balance', _bal);
end $$;

CREATE OR REPLACE FUNCTION public.admin_referrals(_user uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  return (select jsonb_build_object(
    'referrer', (select r.uid from profiles p join profiles r on r.id=p.referrer_id where p.id=_user),
    'code', (select referral_code from profiles where id=_user),
    'commission', public._ref_commission(_user, null),
    'levels', (select coalesce(jsonb_agg(jsonb_build_object('level', l, 'uids', (select coalesce(jsonb_agg(p.uid),'[]'::jsonb) from _ref_tree(_user) t join profiles p on p.id=t.id where t.lvl=l))),'[]'::jsonb) from generate_series(1,6) l)));
end $$;

REVOKE EXECUTE ON FUNCTION public._ref_tree(uuid), public._ref_commission(uuid, timestamptz), public._ref_rates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_earn(), public.claim_commission(), public.admin_referrals(uuid) TO authenticated;
