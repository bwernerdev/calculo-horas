-- Baseline idempotente do banco, RLS e Storage.
-- A transação é cancelada sem alterações se houver dados antigos incompatíveis.

begin;

create table if not exists public.records (
  id text,
  user_id uuid,
  date date,
  type text,
  start_time text,
  end_time text,
  break_minutes integer default 0,
  photos jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists public.settings (
  user_id uuid,
  target_minutes integer default 528,
  theme text default 'light',
  updated_at timestamptz default now()
);

alter table public.settings
  add column if not exists balance_adjustments jsonb not null default '{}'::jsonb;

create or replace function public.is_valid_balance_adjustments(value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(value) <> 'object' then false
    else (
      select count(*) <= 240 and coalesce(bool_and(
        case
          when entry.month !~ '^\d{4}-(0[1-9]|1[0-2])$' or jsonb_typeof(entry.balance) <> 'object' then false
          when not (entry.balance ? 'positive' and entry.balance ? 'negative') then false
          when (entry.balance->>'positive') !~ '^\d+$' or (entry.balance->>'negative') !~ '^\d+$' then false
          else (entry.balance->>'positive')::numeric between 0 and 599999
            and (entry.balance->>'negative')::numeric between 0 and 599999
        end
      ), true)
      from jsonb_each(value) as entry(month, balance)
    )
  end;
$$;

do $$
begin
  if exists (select 1 from public.records where user_id is null) then
    raise exception 'Existem registros sem user_id. Corrija-os antes de aplicar a segurança.';
  end if;
  if exists (select 1 from public.settings where user_id is null) then
    raise exception 'Existem configurações sem user_id. Corrija-as antes de aplicar a segurança.';
  end if;
  if exists (
    select 1 from public.records group by user_id, date having count(*) > 1
  ) then
    raise exception 'Existem datas duplicadas para o mesmo usuário em records.';
  end if;
  if exists (
    select 1 from public.records group by id having count(*) > 1
  ) then
    raise exception 'Existem identificadores duplicados em records.';
  end if;
  if exists (
    select 1 from public.settings group by user_id having count(*) > 1
  ) then
    raise exception 'Existem configurações duplicadas para o mesmo usuário.';
  end if;
  if exists (
    select 1 from public.records r left join auth.users u on u.id = r.user_id where u.id is null
  ) or exists (
    select 1 from public.settings s left join auth.users u on u.id = s.user_id where u.id is null
  ) then
    raise exception 'Existem dados vinculados a usuários que não existem mais.';
  end if;
end
$$;

alter table public.records
  alter column id set not null,
  alter column user_id set not null,
  alter column date set not null,
  alter column type set not null,
  alter column break_minutes set not null,
  alter column break_minutes set default 0,
  alter column photos set not null,
  alter column photos set default '{}'::jsonb;

alter table public.settings
  alter column user_id set not null,
  alter column target_minutes set not null,
  alter column theme set not null,
  alter column theme set default 'light';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'records_user_id_fkey' and conrelid = 'public.records'::regclass) then
    alter table public.records add constraint records_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'settings_user_id_fkey' and conrelid = 'public.settings'::regclass) then
    alter table public.settings add constraint settings_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'records_type_check' and conrelid = 'public.records'::regclass) then
    alter table public.records add constraint records_type_check
      check (type in ('trabalho', 'folga', 'feriado', 'ferias', 'falta')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'records_break_minutes_check' and conrelid = 'public.records'::regclass) then
    alter table public.records add constraint records_break_minutes_check
      check (break_minutes between 0 and 600) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'records_photos_object_check' and conrelid = 'public.records'::regclass) then
    alter table public.records add constraint records_photos_object_check
      check (jsonb_typeof(photos) = 'object') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'records_work_times_check' and conrelid = 'public.records'::regclass) then
    alter table public.records add constraint records_work_times_check
      check (
        type <> 'trabalho' or (
          start_time is not null and end_time is not null and
          start_time::text ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' and
          end_time::text ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
        )
      ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'settings_target_minutes_check' and conrelid = 'public.settings'::regclass) then
    alter table public.settings add constraint settings_target_minutes_check
      check (target_minutes between 1 and 600) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'settings_theme_check' and conrelid = 'public.settings'::regclass) then
    alter table public.settings add constraint settings_theme_check
      check (theme in ('light', 'dark')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'settings_balance_adjustments_check' and conrelid = 'public.settings'::regclass) then
    alter table public.settings add constraint settings_balance_adjustments_check
      check (public.is_valid_balance_adjustments(balance_adjustments)) not valid;
  end if;
end
$$;

alter table public.records validate constraint records_type_check;
alter table public.records validate constraint records_break_minutes_check;
alter table public.records validate constraint records_photos_object_check;
alter table public.records validate constraint records_work_times_check;
alter table public.settings validate constraint settings_target_minutes_check;
alter table public.settings validate constraint settings_theme_check;
alter table public.settings validate constraint settings_balance_adjustments_check;

create unique index if not exists records_id_uidx on public.records (id);
create unique index if not exists records_user_date_uidx on public.records (user_id, date);
create index if not exists records_user_updated_idx on public.records (user_id, updated_at desc);
create unique index if not exists settings_user_uidx on public.settings (user_id);

alter table public.records enable row level security;
alter table public.settings enable row level security;

revoke all on table public.records from anon;
revoke all on table public.settings from anon;
grant select, insert, update, delete on table public.records to authenticated;
grant select, insert, update, delete on table public.settings to authenticated;

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('point-photos', 'point-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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

-- Substitui registros e configurações em uma única transação durante a restauração.
drop function if exists public.restore_user_backup(jsonb, integer, text);
create or replace function public.restore_user_backup(
  p_records jsonb,
  p_target_minutes integer,
  p_theme text,
  p_balance_adjustments jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sessão autenticada obrigatória.';
  end if;
  if p_records is null or jsonb_typeof(p_records) <> 'array' then
    raise exception 'Lista de registros inválida.';
  end if;
  if jsonb_array_length(p_records) > 5000 then
    raise exception 'O backup excede 5000 registros.';
  end if;
  if p_target_minutes not between 1 and 600 or p_theme not in ('light', 'dark') then
    raise exception 'Configurações inválidas.';
  end if;
  if not public.is_valid_balance_adjustments(p_balance_adjustments) then
    raise exception 'Saldos manuais inválidos.';
  end if;

  delete from public.records where user_id = (select auth.uid());

  insert into public.records (
    id, user_id, date, type, start_time, end_time,
    break_minutes, photos, updated_at
  )
  select
    parsed.id,
    (select auth.uid()),
    parsed.date,
    parsed.type,
    parsed.start_time,
    parsed.end_time,
    parsed.break_minutes,
    parsed.photos,
    now()
  from jsonb_array_elements(p_records) as source(item)
  cross join lateral jsonb_populate_record(null::public.records, source.item) as parsed;

  insert into public.settings (user_id, target_minutes, theme, balance_adjustments, updated_at)
  values ((select auth.uid()), p_target_minutes, p_theme, p_balance_adjustments, now())
  on conflict (user_id) do update set
    target_minutes = excluded.target_minutes,
    theme = excluded.theme,
    balance_adjustments = excluded.balance_adjustments,
    updated_at = excluded.updated_at;
end
$$;

revoke all on function public.restore_user_backup(jsonb, integer, text, jsonb) from public;
grant execute on function public.restore_user_backup(jsonb, integer, text, jsonb) to authenticated;

commit;
