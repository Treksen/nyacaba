-- =========================================================================
-- Nyacaba Welfare Management System - Profile Photos
-- =========================================================================
-- 1. Adds avatar_url to profiles (if missing).
-- 2. Creates the 'avatars' Supabase Storage bucket (public read).
-- 3. RLS policies so authenticated users can manage only their own avatar
--    (path: {user_id}/avatar.jpg).
--
-- After running, the frontend can upload an image to:
--   bucket: avatars
--   path:   {auth.uid()}/avatar.jpg
-- and the resulting public URL goes into profiles.avatar_url.
--
-- Run AFTER 016_cron_reminders.sql. Idempotent.
-- =========================================================================

-- 1. Column on profiles
alter table public.profiles
  add column if not exists avatar_url text;

-- 2. Storage bucket — public read so the <img> tag works without signed URLs
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 3. RLS policies for storage.objects scoped to the avatars bucket
--    Pattern: path looks like "{user_id}/avatar.jpg" → first folder must
--    match the caller's auth.uid().
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects
  for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =========================================================================
-- END
-- =========================================================================
