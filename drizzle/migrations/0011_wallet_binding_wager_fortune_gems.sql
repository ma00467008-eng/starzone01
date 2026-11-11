alter table public.profiles add column if not exists wager_required bigint not null default 0;
alter table public.profiles add column if not exists wager_done bigint not null default 0;
alter table public.coin_requests add column if not exists txn_id text;
alter table public.coin_requests add column if not exists source text;
alter table public.coin_deductions add column if not exists method text;
alter table public.coin_deductions add column if not exists account_name text;
alter table public.coin_deductions add column if not exists account_number text;

create table if not exists public.payout_accounts (
  user_id uuid primary key,
  method text not null,
  account_name text not null,
  account_number text not null,
  created_at timestamptz not null default now()
);
grant select on public.payout_accounts to authenticated;
grant all on public.payout_accounts to service_role;
alter table public.payout_accounts enable row level security;
create policy "own payout account" on public.payout_accounts for select to authenticated using (user_id = auth.uid() or public.is_admin());

create or replace function public.bind_payout_account(_method text, _name text, _number text) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Please log in'; end if;
  if _method not in ('easypaisa','jazzcash') then raise exception 'Choose Easypaisa or JazzCash'; end if;
  if coalesce(length(trim(_name)),0) < 3 then raise exception 'Enter account name'; end if;
  if trim(_number) !~ '^03[0-9]{9}$' then raise exception 'Enter a valid 11-digit account number (03XXXXXXXXX)'; end if;
  if exists(select 1 from public.payout_accounts where user_id=auth.uid()) then raise exception 'Account already bound'; end if;
  insert into public.payout_accounts(user_id,method,account_name,account_number) values(auth.uid(),_method,left(trim(_name),60),trim(_number));
  return jsonb_build_object('ok',true);
end $$;
revoke execute on function public.bind_payout_account from public, anon;
grant execute on function public.bind_payout_account to authenticated;

create or replace function public.admin_unbind_payout(_user uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  delete from public.payout_accounts where user_id=_user;
  insert into public.admin_logs(admin_id,action,details) values(auth.uid(),'unbind_payout',jsonb_build_object('user',_user));
end $$;
revoke execute on function public.admin_unbind_payout from public, anon;
grant execute on function public.admin_unbind_payout to authenticated;

drop function if exists public.submit_coin_request(int, text, text);
create or replace function public.submit_coin_request(_amount int, _note text, _screenshot text, _txn text, _source text) returns jsonb language plpgsql security definer set search_path=public as $$
declare cfg jsonb; cnt int; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Please log in'; end if;
  if _source not in ('easypaisa','jazzcash') then raise exception 'Choose sending source'; end if;
  if coalesce(length(trim(_txn)),0) < 4 then raise exception 'Enter transaction ID'; end if;
  if _screenshot is null or _screenshot not like auth.uid()::text || '/%' then raise exception 'Please upload a screenshot'; end if;
  if exists(select 1 from public.coin_requests c where upper(c.txn_id)=upper(trim(_txn))) then raise exception 'This transaction ID was already used'; end if;
  select value into cfg from public.site_settings where key='coins';
  if _amount < coalesce((cfg->>'min')::int,300) or _amount > coalesce((cfg->>'max')::int,10000) then raise exception 'Amount must be between % and %', coalesce(cfg->>'min','300'), coalesce(cfg->>'max','10000'); end if;
  if exists(select 1 from public.coin_requests c where c.user_id=auth.uid() and c.status='pending') then raise exception 'You already have a pending request'; end if;
  select count(*) into cnt from public.coin_requests c where c.user_id=auth.uid() and c.created_at > now() - interval '1 day';
  if cnt >= coalesce((cfg->>'daily_limit')::int, 3) then raise exception 'Daily request limit reached'; end if;
  insert into public.coin_requests(user_id,amount,note,screenshot_path,txn_id,source) values(auth.uid(),_amount,left(trim(coalesce(_note,'')),300),_screenshot,left(trim(_txn),60),_source) returning coin_requests.id into v_id;
  return jsonb_build_object('id', v_id);
end $$;
revoke execute on function public.submit_coin_request(int,text,text,text,text) from public, anon;
grant execute on function public.submit_coin_request(int,text,text,text,text) to authenticated;

drop function if exists public.submit_coin_deduction(int, text);
create or replace function public.submit_coin_deduction(_amount int, _note text) returns jsonb language plpgsql security definer set search_path=public as $$
declare pr public.profiles; acc public.payout_accounts; cfg jsonb; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Please log in'; end if;
  select * into acc from public.payout_accounts where user_id=auth.uid();
  if acc is null then raise exception 'Please bind your Easypaisa/JazzCash account first'; end if;
  select value into cfg from public.site_settings where key='coins';
  if _amount is null or _amount < coalesce((cfg->>'wd_min')::int,500) or _amount > coalesce((cfg->>'wd_max')::int,50000) then
    raise exception 'Withdrawal must be between % and %', coalesce(cfg->>'wd_min','500'), coalesce(cfg->>'wd_max','50000'); end if;
  select * into pr from public.profiles where id=auth.uid();
  if pr.wager_done < pr.wager_required then raise exception 'Complete betting requirement first: % of % done', pr.wager_done, pr.wager_required; end if;
  if _amount > pr.balance then raise exception 'Amount is more than your balance'; end if;
  if exists(select 1 from public.coin_deductions d where d.user_id=auth.uid() and d.status='pending') then raise exception 'You already have a pending withdrawal request'; end if;
  insert into public.coin_deductions(user_id,amount,note,method,account_name,account_number)
    values(auth.uid(),_amount,left(trim(coalesce(_note,'')),300),acc.method,acc.account_name,acc.account_number) returning coin_deductions.id into v_id;
  return jsonb_build_object('id', v_id);
end $$;
revoke execute on function public.submit_coin_deduction(int,text) from public, anon;
grant execute on function public.submit_coin_deduction(int,text) to authenticated;

create or replace function public.admin_review_coin(_id uuid, _approve boolean, _note text) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.coin_requests; prior int; cfg jsonb; mult numeric;
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  select * into r from public.coin_requests where id=_id for update;
  if r is null then raise exception 'Not found'; end if;
  if r.status <> 'pending' then raise exception 'Request already %', r.status; end if;
  select count(*) into prior from public.coin_requests c where c.user_id=r.user_id and c.status='approved';
  update public.coin_requests set status = case when _approve then 'approved' else 'rejected' end, admin_note=_note, reviewed_by=auth.uid(), reviewed_at=now() where id=_id;
  if _approve then
    select value into cfg from public.site_settings where key='coins';
    mult := case when prior = 0 then coalesce((cfg->>'wager_first')::numeric,3) else coalesce((cfg->>'wager_next')::numeric,2) end;
    update public.profiles set wager_required = wager_required + floor(r.amount*mult) where id=r.user_id;
    perform public.adjust_balance(r.user_id, r.amount, 'coin_request', r.id::text, 'Approved coin request');
    perform public.notify(r.user_id, 'Coin request approved', r.amount || ' virtual coins were added to your balance.', 'coins');
  else
    perform public.notify(r.user_id, 'Coin request rejected', coalesce(_note,'Your coin request was not approved.'), 'coins');
  end if;
  insert into public.admin_logs(admin_id,action,details) values(auth.uid(), case when _approve then 'approve_coins' else 'reject_coins' end, jsonb_build_object('request',_id,'amount',r.amount));
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.admin_review_coin to authenticated;

create or replace function public._count_wager() returns trigger language plpgsql security definer set search_path=public as $$
begin
  update public.profiles set wager_done = wager_done + new.stake where id=new.user_id;
  return new;
end $$;
drop trigger if exists trg_count_wager on public.game_rounds;
create trigger trg_count_wager after insert on public.game_rounds for each row execute function public._count_wager();

create or replace function public.fortune_gems_spin(_stake bigint) returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid; code text; grid int[] := '{}'; i int; r double precision; acc int; s int;
  w int[] := array[2,4,6,8,12,14,16,18]; pays numeric[] := array[25,15,10,5,2.5,1.5,1,0.5];
  mv int[] := array[1,2,3,5,10,15]; mw int[] := array[50,20,12,8,6,4];
  lines int[][] := array[[1,2,3],[4,5,6],[7,8,9],[1,5,9],[7,5,3]];
  m int; line_pay numeric; total numeric := 0; wins jsonb := '[]'::jsonb; a int; b int; c int; sym int; payout bigint; bal bigint;
begin
  u := public._check_play('fortune-gems', _stake);
  code := public._round_code('fortune-gems');
  perform public.adjust_balance(u, -_stake, 'game_stake', code, 'fortune-gems');
  -- grid stored row-major: index = row*3 + reel + 1 (rows top..bottom, reels 1..3)
  for i in 1..9 loop
    r := public.rand01()*80; acc := 0; s := 8;
    for k in 1..8 loop acc := acc + w[k]; if r < acc then s := k; exit; end if; end loop;
    grid := grid || (s-1);
  end loop;
  r := public.rand01()*100; acc := 0; m := 1;
  for k in 1..6 loop acc := acc + mw[k]; if r < acc then m := mv[k]; exit; end if; end loop;
  for i in 1..5 loop
    a := grid[lines[i][1]]; b := grid[lines[i][2]]; c := grid[lines[i][3]];
    sym := null;
    if a=0 and b=0 and c=0 then sym := 0;
    else
      sym := coalesce(nullif(a,0), nullif(b,0), nullif(c,0));
      if (a<>0 and a<>sym) or (b<>0 and b<>sym) or (c<>0 and c<>sym) then sym := null; end if;
    end if;
    if sym is not null then
      line_pay := _stake * pays[sym+1] / 5.0;
      total := total + line_pay;
      wins := wins || jsonb_build_object('line', i-1, 'symbol', sym, 'pay', floor(line_pay*m));
    end if;
  end loop;
  payout := floor(total * m);
  bal := public._finish(u, 'fortune-gems', code, _stake, payout, jsonb_build_object('stake',_stake), jsonb_build_object('grid', to_jsonb(grid), 'multiplier', m, 'wins', wins));
  return jsonb_build_object('grid', to_jsonb(grid), 'multiplier', m, 'wins', wins, 'payout', payout, 'round_code', code, 'balance', bal, 'win', payout > 0);
end $$;
revoke execute on function public.fortune_gems_spin from public, anon;
grant execute on function public.fortune_gems_spin to authenticated;

insert into public.games(slug,name,image_url,badge,enabled,min_stake,max_stake,sort,rules)
values('fortune-gems','Fortune Gems','/games/fortune-gems.jpg','NEW',true,10,10000,0,
'3 reels x 3 rows with 5 fixed paylines (3 rows + 2 diagonals). Stake is split equally over 5 lines. 3 matching symbols on a line win. Wild replaces any symbol. The 4th reel shows a multiplier (x1, x2, x3, x5, x10, x15) applied to the total win. Line pays (x line stake): Wild 25, Red gem 15, Green gem 10, Blue gem 5, A 2.5, K 1.5, Q 1, J 0.5. Return to player about 90%.')
on conflict (slug) do nothing;