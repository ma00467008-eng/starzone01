
create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('admin','user');

-- PROFILES / WALLET
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  uid text not null unique,
  phone text not null unique,
  username text not null,
  avatar int not null default 1,
  balance bigint not null default 0 check (balance >= 0),
  status text not null default 'active',
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
grant select on public.profiles to authenticated;
grant update (username, avatar, last_seen) on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role=_role)
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select public.has_role(auth.uid(),'admin')
$$;

create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- private secrets (no client access)
create table public.user_secrets (user_id uuid primary key, recovery_hash text not null);
grant all on public.user_secrets to service_role;
alter table public.user_secrets enable row level security;

create table public.captcha_challenges (
  id uuid primary key default gen_random_uuid(),
  target_x int not null, target_y int not null, image int not null,
  created_at timestamptz not null default now(),
  passed_at timestamptz, consumed boolean not null default false, attempts int not null default 0
);
grant all on public.captcha_challenges to service_role;
alter table public.captcha_challenges enable row level security;

create table public.login_attempts (id bigserial primary key, phone text not null, success boolean not null, created_at timestamptz not null default now());
create index on public.login_attempts(phone, created_at);
grant all on public.login_attempts to service_role;
alter table public.login_attempts enable row level security;

create table public.game_seed (id int primary key, seed text not null);
insert into public.game_seed values (1, encode(extensions.gen_random_bytes(32),'hex'));
grant all on public.game_seed to service_role;
alter table public.game_seed enable row level security;

-- TRANSACTIONS
create table public.transactions (
  id bigserial primary key, user_id uuid not null, amount bigint not null, balance_after bigint not null,
  kind text not null, ref text, note text, created_at timestamptz not null default now()
);
create index on public.transactions(user_id, created_at desc);
grant select on public.transactions to authenticated; grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
create policy "own tx" on public.transactions for select to authenticated using (user_id = auth.uid() or public.is_admin());

create or replace function public.adjust_balance(_user uuid, _amount bigint, _kind text, _ref text, _note text)
returns bigint language plpgsql security definer set search_path=public as $$
declare b bigint;
begin
  select balance into b from public.profiles where id=_user for update;
  if b is null then raise exception 'User not found'; end if;
  if b + _amount < 0 then raise exception 'Insufficient coins'; end if;
  update public.profiles set balance = b + _amount where id=_user;
  insert into public.transactions(user_id,amount,balance_after,kind,ref,note) values(_user,_amount,b+_amount,_kind,_ref,_note);
  return b + _amount;
end $$;
revoke execute on function public.adjust_balance from public, anon, authenticated;

-- SETTINGS / CMS
create table public.site_settings (key text primary key, value jsonb not null, updated_at timestamptz default now());
grant select on public.site_settings to anon, authenticated; grant insert, update, delete on public.site_settings to authenticated; grant all on public.site_settings to service_role;
alter table public.site_settings enable row level security;
create policy "read settings" on public.site_settings for select using (true);
create policy "admin settings" on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.content (key text primary key, en text not null, ur text not null default '', updated_at timestamptz default now());
grant select on public.content to anon, authenticated; grant insert, update, delete on public.content to authenticated; grant all on public.content to service_role;
alter table public.content enable row level security;
create policy "read content" on public.content for select using (true);
create policy "admin content" on public.content for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- MEDIA (slider, popup, promo)
create table public.media_items (
  id uuid primary key default gen_random_uuid(), kind text not null check (kind in ('slider','popup','promo')),
  image_url text not null, link text, title text, sort int not null default 0, enabled boolean not null default true,
  starts_at timestamptz, ends_at timestamptz, created_at timestamptz default now()
);
grant select on public.media_items to anon, authenticated; grant insert, update, delete on public.media_items to authenticated; grant all on public.media_items to service_role;
alter table public.media_items enable row level security;
create policy "read media" on public.media_items for select using (enabled or public.is_admin());
create policy "admin media" on public.media_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- GAMES
create table public.games (
  slug text primary key, name text not null, image_url text not null, badge text, enabled boolean not null default true,
  maintenance boolean not null default false, featured boolean not null default false,
  min_stake int not null default 10, max_stake int not null default 10000, sort int not null default 0, rules text, announcement text
);
grant select on public.games to anon, authenticated; grant update, insert, delete on public.games to authenticated; grant all on public.games to service_role;
alter table public.games enable row level security;
create policy "read games" on public.games for select using (true);
create policy "admin games" on public.games for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.games(slug,name,image_url,badge,featured,sort,rules) values
('wingo','WinGo','/games/wingo.jpg','HOT',true,1,'Pick a number (0-9) pays 9x, a color pays 2x (1.5x when result is 0 or 5), Violet pays 4.5x, Big (5-9) / Small (0-4) pay 2x. Betting closes 5 seconds before each round ends.'),
('trx','TRX WinGo','/games/trx.jpg','NEW',true,2,'Same rules as WinGo, with results derived from a simulated block hash. Fully virtual - no cryptocurrency involved.'),
('chicken','Chicken Road 2','/games/chicken.jpg','HOT',true,3,'Move the chicken lane by lane. Each safe lane raises the multiplier. Cash out any time; hitting a hazard loses the stake. Difficulty changes hazard chance.'),
('aviator','Sky Crash','/games/aviator.jpg','HOT',true,4,'The multiplier rises until the plane flies away at a random point. Cash out before it leaves to win stake x multiplier. 3% house edge.'),
('mines','Mines','/games/mines.jpg',null,false,5,'25 tiles hide gems and mines. Each gem raises the multiplier; a mine ends the round. Cash out any time.'),
('plinko','Plinko','/games/plinko.jpg',null,false,6,'Drop a ball through 12 rows of pegs. It lands in a slot with a published multiplier.'),
('dice','Dice','/games/dice.jpg',null,false,7,'Choose a target. Roll under it to win. Payout = 99 / target.'),
('limbo','Limbo','/games/limbo.jpg','NEW',false,8,'Set a target multiplier. If the result is equal or higher, you win stake x target. Win chance = 99% / target.'),
('dragon-tiger','Dragon Tiger','/games/dragon-tiger.jpg',null,false,9,'One card each to Dragon and Tiger. Higher card wins (A low, K high). Dragon/Tiger pay 2x, Tie pays 9x. On a tie, Dragon/Tiger bets return half.'),
('color','Color Prediction','/games/color.jpg',null,false,10,'Predict Red, Green or Violet for the 1-minute round. Same payouts as WinGo colors.');

-- GAME ROUNDS (finished rounds/history)
create table public.game_rounds (
  id bigserial primary key, user_id uuid not null, game text not null, round_code text not null,
  stake bigint not null, payout bigint not null default 0, status text not null default 'settled',
  selection jsonb, result jsonb, created_at timestamptz not null default now()
);
create index on public.game_rounds(user_id, created_at desc);
grant select on public.game_rounds to authenticated; grant all on public.game_rounds to service_role;
alter table public.game_rounds enable row level security;
create policy "own rounds" on public.game_rounds for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- live sessions for stateful games (hidden state)
create table public.game_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, game text not null, stake bigint not null,
  secret jsonb not null, state jsonb not null default '{}', active boolean not null default true, created_at timestamptz not null default now()
);
grant all on public.game_sessions to service_role;
alter table public.game_sessions enable row level security;

-- COIN REQUESTS
create table public.coin_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, amount int not null, note text,
  status text not null default 'pending', admin_note text, reviewed_by uuid, reviewed_at timestamptz, created_at timestamptz not null default now()
);
grant select on public.coin_requests to authenticated; grant all on public.coin_requests to service_role;
alter table public.coin_requests enable row level security;
create policy "own requests" on public.coin_requests for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- NOTIFICATIONS
create table public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid, title text not null, body text not null, kind text not null default 'announcement',
  created_at timestamptz not null default now()
);
create index on public.notifications(user_id, created_at desc);
grant select on public.notifications to authenticated; grant insert, delete on public.notifications to authenticated; grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "read notif" on public.notifications for select to authenticated using (user_id is null or user_id = auth.uid() or public.is_admin());
create policy "admin notif" on public.notifications for insert to authenticated with check (public.is_admin());
create policy "admin del notif" on public.notifications for delete to authenticated using (public.is_admin());

create table public.notification_reads (user_id uuid not null, notification_id uuid not null references public.notifications(id) on delete cascade, primary key(user_id, notification_id));
grant select, insert on public.notification_reads to authenticated; grant all on public.notification_reads to service_role;
alter table public.notification_reads enable row level security;
create policy "own reads" on public.notification_reads for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.notify(_user uuid, _title text, _body text, _kind text) returns void language sql security definer set search_path=public as $$
  insert into public.notifications(user_id,title,body,kind) values(_user,_title,_body,_kind);
$$;
revoke execute on function public.notify from public, anon, authenticated;

-- GIFT CODES
create table public.gift_codes (
  id uuid primary key default gen_random_uuid(), code text not null unique, reward int not null, usage_limit int not null default 100,
  used_count int not null default 0, expires_at timestamptz, active boolean not null default true, is_public boolean not null default false,
  description text, created_at timestamptz default now()
);
grant select, insert, update, delete on public.gift_codes to authenticated; grant all on public.gift_codes to service_role;
alter table public.gift_codes enable row level security;
create policy "public codes" on public.gift_codes for select to authenticated using ((is_public and active) or public.is_admin());
create policy "admin codes" on public.gift_codes for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.gift_redemptions (id bigserial primary key, code_id uuid not null references public.gift_codes(id) on delete cascade, user_id uuid not null, created_at timestamptz default now(), unique(code_id,user_id));
grant select on public.gift_redemptions to authenticated; grant all on public.gift_redemptions to service_role;
alter table public.gift_redemptions enable row level security;
create policy "own redemptions" on public.gift_redemptions for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- FAQ & TICKETS
create table public.faqs (id uuid primary key default gen_random_uuid(), question_en text not null, answer_en text not null, question_ur text default '', answer_ur text default '', sort int default 0);
grant select on public.faqs to anon, authenticated; grant insert, update, delete on public.faqs to authenticated; grant all on public.faqs to service_role;
alter table public.faqs enable row level security;
create policy "read faq" on public.faqs for select using (true);
create policy "admin faq" on public.faqs for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.tickets (id uuid primary key default gen_random_uuid(), user_id uuid not null, subject text not null, description text not null, image_path text, status text not null default 'pending', created_at timestamptz default now(), updated_at timestamptz default now());
grant select, insert on public.tickets to authenticated; grant update on public.tickets to authenticated; grant all on public.tickets to service_role;
alter table public.tickets enable row level security;
create policy "own tickets" on public.tickets for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "create ticket" on public.tickets for insert to authenticated with check (user_id = auth.uid() and status='pending');
create policy "admin ticket" on public.tickets for update to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.ticket_replies (id bigserial primary key, ticket_id uuid not null references public.tickets(id) on delete cascade, sender text not null, body text not null, created_at timestamptz default now());
grant select, insert on public.ticket_replies to authenticated; grant all on public.ticket_replies to service_role;
alter table public.ticket_replies enable row level security;
create policy "read replies" on public.ticket_replies for select to authenticated using (exists(select 1 from public.tickets t where t.id=ticket_id and (t.user_id=auth.uid() or public.is_admin())));
create policy "write replies" on public.ticket_replies for insert to authenticated with check (
  (sender='admin' and public.is_admin()) or (sender='user' and exists(select 1 from public.tickets t where t.id=ticket_id and t.user_id=auth.uid() and t.status<>'closed')));

-- CHAT
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, sender text not null check (sender in ('user','admin')),
  body text, image_path text, read_by_user boolean not null default false, read_by_admin boolean not null default false, created_at timestamptz not null default now()
);
create index on public.chat_messages(user_id, created_at);
grant select, insert, update on public.chat_messages to authenticated; grant all on public.chat_messages to service_role;
alter table public.chat_messages enable row level security;
create policy "read chat" on public.chat_messages for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "send chat" on public.chat_messages for insert to authenticated with check (
  (sender='user' and user_id=auth.uid()) or (sender='admin' and public.is_admin()));
create policy "mark chat" on public.chat_messages for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
alter publication supabase_realtime add table public.chat_messages;

-- ADMIN LOGS
create table public.admin_logs (id bigserial primary key, admin_id uuid, action text not null, details jsonb, created_at timestamptz default now());
grant select on public.admin_logs to authenticated; grant all on public.admin_logs to service_role;
alter table public.admin_logs enable row level security;
create policy "admin logs" on public.admin_logs for select to authenticated using (public.is_admin());

-- NEW USER TRIGGER
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare _uid text; _phone text;
begin
  _phone := coalesce(new.raw_user_meta_data->>'phone', split_part(new.email,'@',1));
  loop
    _uid := (10000000 + floor(random()*89999999))::bigint::text;
    exit when not exists(select 1 from public.profiles where uid=_uid);
  end loop;
  insert into public.profiles(id, uid, phone, username, avatar, balance, must_change_password)
  values (new.id, _uid, _phone, 'Star' || upper(substr(md5(random()::text),1,6)), 1 + floor(random()*8)::int,
          coalesce((select (value->>'amount')::int from public.site_settings where key='signup_bonus'),0),
          _phone = '03705723114');
  insert into public.user_roles(user_id, role) values (new.id, 'user');
  if _phone = '03705723114' then insert into public.user_roles(user_id, role) values (new.id, 'admin'); end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- seed settings & content
insert into public.site_settings(key,value) values
('site', '{"name":"STAR ZONE","maintenance":false,"registration_open":true,"footer":"STAR ZONE is a free-to-play entertainment platform. Coins are virtual and have no cash value."}'),
('signup_bonus', '{"amount":1000}'),
('social', '{"whatsapp_support":"","telegram_support":"","whatsapp_channel":"","telegram_channel":""}'),
('coins', '{"amounts":[300,500,1000,2000,5000,10000],"min":300,"max":10000,"daily_limit":3,"instructions":"Choose the amount of virtual coins you would like and submit your request. An admin will review it shortly. Virtual coins are free and have no cash value.","image_url":""}'),
('announcement', '{"text":"Welcome to STAR ZONE! Play 10 games free with virtual coins."}');

insert into public.media_items(kind,image_url,sort,title) values
('slider','/banners/b1.jpg',1,'Welcome bonus'),('slider','/banners/b2.jpg',2,'10 games'),
('popup','/banners/b1.jpg',1,'Welcome'),('promo','/banners/b1.jpg',1,'Daily rewards'),('promo','/banners/b2.jpg',2,'New games');

insert into public.faqs(question_en,answer_en,question_ur,answer_ur,sort) values
('Are coins real money?','No. All STAR ZONE coins are virtual, free and have no cash value. They cannot be withdrawn or exchanged.','کیا کوائنز اصلی رقم ہیں؟','نہیں۔ تمام کوائنز ورچوئل اور مفت ہیں، ان کی کوئی نقد قیمت نہیں۔',1),
('How do I get more coins?','Open Account > Add Coins and submit a free request, or redeem a gift code.','مزید کوائنز کیسے حاصل کریں؟','اکاؤنٹ > کوائنز شامل کریں سے مفت درخواست بھیجیں یا گفٹ کوڈ استعمال کریں۔',2),
('Are game results fair?','Every result is generated on our server using published rules. Nobody can change individual results.','کیا نتائج منصفانہ ہیں؟','ہر نتیجہ سرور پر شائع شدہ قواعد کے مطابق بنتا ہے۔',3);

insert into public.gift_codes(code,reward,usage_limit,is_public,description) values ('WELCOME500',500,10000,true,'Welcome gift');
