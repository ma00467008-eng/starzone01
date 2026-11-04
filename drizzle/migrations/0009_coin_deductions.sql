create table public.coin_deductions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  amount integer not null,
  note text not null,
  status text not null default 'pending',
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
grant select on public.coin_deductions to authenticated;
grant all on public.coin_deductions to service_role;
alter table public.coin_deductions enable row level security;
create policy "own deductions" on public.coin_deductions for select to authenticated using (user_id = auth.uid() or public.is_admin());

create or replace function public.submit_coin_request(_amount int, _note text) returns jsonb language plpgsql security definer set search_path=public as $$
declare cfg jsonb; cnt int; id uuid;
begin
  if auth.uid() is null then raise exception 'Please log in'; end if;
  if coalesce(length(trim(_note)),0) < 3 then raise exception 'Please write instructions for your request'; end if;
  select value into cfg from public.site_settings where key='coins';
  if _amount < coalesce((cfg->>'min')::int,300) or _amount > coalesce((cfg->>'max')::int,10000) then raise exception 'Amount must be between % and %', cfg->>'min', cfg->>'max'; end if;
  if exists(select 1 from public.coin_requests where user_id=auth.uid() and status='pending') then raise exception 'You already have a pending request'; end if;
  select count(*) into cnt from public.coin_requests where user_id=auth.uid() and created_at > now() - interval '1 day';
  if cnt >= coalesce((cfg->>'daily_limit')::int, 3) then raise exception 'Daily request limit reached'; end if;
  insert into public.coin_requests(user_id,amount,note) values(auth.uid(),_amount,left(trim(_note),300)) returning coin_requests.id into id;
  return jsonb_build_object('id', id);
end $$;

create or replace function public.submit_coin_deduction(_amount int, _note text) returns jsonb language plpgsql security definer set search_path=public as $$
declare bal bigint; id uuid;
begin
  if auth.uid() is null then raise exception 'Please log in'; end if;
  if coalesce(length(trim(_note)),0) < 3 then raise exception 'Please write instructions for your request'; end if;
  if _amount is null or _amount < 1 then raise exception 'Enter a valid amount'; end if;
  select balance into bal from public.profiles where id=auth.uid();
  if _amount > bal then raise exception 'Amount is more than your balance'; end if;
  if exists(select 1 from public.coin_deductions where user_id=auth.uid() and status='pending') then raise exception 'You already have a pending deduction request'; end if;
  insert into public.coin_deductions(user_id,amount,note) values(auth.uid(),_amount,left(trim(_note),300)) returning coin_deductions.id into id;
  return jsonb_build_object('id', id);
end $$;
revoke execute on function public.submit_coin_deduction from public, anon;
grant execute on function public.submit_coin_deduction to authenticated;

create or replace function public.admin_review_deduction(_id uuid, _approve boolean, _note text) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.coin_deductions; bal bigint;
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  select * into r from public.coin_deductions where id=_id for update;
  if r is null then raise exception 'Not found'; end if;
  if r.status <> 'pending' then raise exception 'Request already %', r.status; end if;
  if _approve then
    select balance into bal from public.profiles where id=r.user_id for update;
    if bal < r.amount then raise exception 'User balance is lower than the requested amount'; end if;
    perform public.adjust_balance(r.user_id, -r.amount, 'coin_deduction', r.id::text, 'Approved deduction request');
    perform public.notify(r.user_id, 'Deduction approved', r.amount || ' virtual coins were deducted from your balance.', 'coins');
  else
    perform public.notify(r.user_id, 'Deduction rejected', coalesce(nullif(_note,''),'Your deduction request was not approved.'), 'coins');
  end if;
  update public.coin_deductions set status = case when _approve then 'approved' else 'rejected' end, admin_note=_note, reviewed_by=auth.uid(), reviewed_at=now() where id=_id;
  insert into public.admin_logs(admin_id,action,details) values(auth.uid(), case when _approve then 'approve_deduction' else 'reject_deduction' end, jsonb_build_object('request',_id,'amount',r.amount));
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.admin_review_deduction from public, anon;
grant execute on function public.admin_review_deduction to authenticated;