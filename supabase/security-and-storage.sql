-- Execute no Supabase SQL Editor uma única vez.
-- Protege registros/configurações por usuário e cria o bucket privado de fotos.

alter table public.records enable row level security;
alter table public.settings enable row level security;

drop policy if exists "records_select_own" on public.records;
drop policy if exists "records_insert_own" on public.records;
drop policy if exists "records_update_own" on public.records;
drop policy if exists "records_delete_own" on public.records;

create policy "records_select_own" on public.records for select to authenticated using ((select auth.uid()) = user_id);
create policy "records_insert_own" on public.records for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "records_update_own" on public.records for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "records_delete_own" on public.records for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "settings_select_own" on public.settings;
drop policy if exists "settings_insert_own" on public.settings;
drop policy if exists "settings_update_own" on public.settings;
drop policy if exists "settings_delete_own" on public.settings;

create policy "settings_select_own" on public.settings for select to authenticated using ((select auth.uid()) = user_id);
create policy "settings_insert_own" on public.settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "settings_update_own" on public.settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "settings_delete_own" on public.settings for delete to authenticated using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public)
values ('point-photos', 'point-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "point_photos_select_own" on storage.objects;
drop policy if exists "point_photos_insert_own" on storage.objects;
drop policy if exists "point_photos_update_own" on storage.objects;
drop policy if exists "point_photos_delete_own" on storage.objects;

create policy "point_photos_select_own" on storage.objects for select to authenticated
using (bucket_id = 'point-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "point_photos_insert_own" on storage.objects for insert to authenticated
with check (bucket_id = 'point-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "point_photos_update_own" on storage.objects for update to authenticated
using (bucket_id = 'point-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'point-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "point_photos_delete_own" on storage.objects for delete to authenticated
using (bucket_id = 'point-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
