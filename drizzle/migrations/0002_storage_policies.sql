
create policy "user upload own" on storage.objects for insert to authenticated with check (bucket_id='private' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "user read own" on storage.objects for select to authenticated using (bucket_id='private' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "admin manage" on storage.objects for delete to authenticated using (bucket_id='private' and public.is_admin());
