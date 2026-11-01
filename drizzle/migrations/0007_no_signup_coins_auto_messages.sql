CREATE TABLE public.auto_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  body text,
  image_url text,
  enabled boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_messages TO authenticated;
GRANT ALL ON public.auto_messages TO service_role;
ALTER TABLE public.auto_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin auto msgs" ON public.auto_messages FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS image_url text;

CREATE OR REPLACE FUNCTION public.broadcast_auto_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if new.enabled then
    insert into public.chat_messages(user_id, sender, body, image_url, read_by_admin)
    select p.id, 'admin', new.body, new.image_url, true from public.profiles p;
  end if;
  return new;
end $$;
CREATE TRIGGER auto_message_broadcast AFTER INSERT ON public.auto_messages FOR EACH ROW EXECUTE FUNCTION public.broadcast_auto_message();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _uid text; _phone text;
begin
  if coalesce(new.raw_app_meta_data->>'starzone','') <> 'true' then return new; end if;
  if exists(select 1 from public.profiles where id=new.id) then return new; end if;
  _phone := new.raw_app_meta_data->>'phone';
  loop
    _uid := (10000000 + floor(random()*89999999))::bigint::text;
    exit when not exists(select 1 from public.profiles where uid=_uid);
  end loop;
  insert into public.profiles(id, uid, phone, username, avatar, balance, must_change_password)
  values (new.id, _uid, _phone, 'Star' || upper(substr(md5(random()::text),1,6)), 1 + floor(random()*8)::int, 0, _phone = '03705723114');
  insert into public.user_roles(user_id, role) values (new.id, 'user');
  if _phone = '03705723114' then insert into public.user_roles(user_id, role) values (new.id, 'admin'); end if;
  insert into public.chat_messages(user_id, sender, body, image_url, read_by_admin, created_at)
  select new.id, 'admin', a.body, a.image_url, true, now() + (a.sort * interval '1 millisecond')
  from public.auto_messages a where a.enabled order by a.sort;
  return new;
end $$;