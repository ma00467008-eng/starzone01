CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  values (new.id, _uid, _phone, 'Star' || upper(substr(md5(random()::text),1,6)), 1 + floor(random()*8)::int,
          coalesce((select (value->>'amount')::int from public.site_settings where key='signup_bonus'),0),
          _phone = '03705723114');
  insert into public.user_roles(user_id, role) values (new.id, 'user');
  if _phone = '03705723114' then insert into public.user_roles(user_id, role) values (new.id, 'admin'); end if;
  if (select balance from public.profiles where id=new.id) > 0 then
    insert into public.transactions(user_id,amount,balance_after,kind,note) select new.id, balance, balance, 'signup_bonus', 'Welcome bonus' from public.profiles where id=new.id;
  end if;
  return new;
end $$;
DROP TRIGGER IF EXISTS on_auth_user_updated_sz ON auth.users;
CREATE TRIGGER on_auth_user_updated_sz AFTER UPDATE OF raw_app_meta_data ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE POLICY "admin update media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='private' AND public.is_admin());