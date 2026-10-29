-- Cópias automáticas (sem fotos) dos registros e configurações, criadas pelo aplicativo no máximo uma vez por dia.
-- O aplicativo mantém as 7 mais recentes por usuário; o formato do payload é o mesmo do backup JSON (versao 1).
begin;

create table if not exists public.backup_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  record_count integer not null,
  payload jsonb not null,
  constraint backup_snapshots_record_count_check check (record_count between 1 and 5000),
  constraint backup_snapshots_payload_check check (
    jsonb_typeof(payload) = 'object'
    and payload->>'versao' = '1'
    and jsonb_typeof(payload->'registros') = 'array'
    and pg_column_size(payload) <= 4000000
  )
);

create index if not exists backup_snapshots_user_created_idx on public.backup_snapshots (user_id, created_at desc);

alter table public.backup_snapshots enable row level security;

drop policy if exists "backup_snapshots_select_own" on public.backup_snapshots;
create policy "backup_snapshots_select_own" on public.backup_snapshots
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "backup_snapshots_insert_own" on public.backup_snapshots;
create policy "backup_snapshots_insert_own" on public.backup_snapshots
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "backup_snapshots_delete_own" on public.backup_snapshots;
create policy "backup_snapshots_delete_own" on public.backup_snapshots
  for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.backup_snapshots from anon;
revoke all on table public.backup_snapshots from authenticated;
grant select, insert, delete on table public.backup_snapshots to authenticated;

commit;
