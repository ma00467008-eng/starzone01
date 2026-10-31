REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (username, avatar, last_seen) ON public.profiles TO authenticated;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;