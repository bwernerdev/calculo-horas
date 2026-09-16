-- Preserva as marcações originais e o saldo oficial de cada dia importado.
-- Execute antes de publicar a interface que envia import_data.
begin;

alter table public.records
  add column if not exists import_data jsonb not null default '{}'::jsonb;

alter table public.records drop constraint if exists records_type_check;
alter table public.records add constraint records_type_check
  check (type in ('trabalho', 'folga', 'feriado', 'ferias', 'falta', 'compensacao')) not valid;
alter table public.records validate constraint records_type_check;

create or replace function public.is_valid_record_import_data(value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(value) <> 'object' then false
    when value = '{}'::jsonb then true
    when value->>'source' is distinct from 'forponto'
      or coalesce(jsonb_typeof(value->'label'), '') <> 'string'
      or length(value->>'label') > 100
      or coalesce(jsonb_typeof(value->'punches'), '') <> 'array'
      or coalesce(jsonb_typeof(value->'officialBalanceMinutes'), '') not in ('number', 'null')
      then false
    when jsonb_array_length(value->'punches') <> 4 then false
    when jsonb_typeof(value->'officialBalanceMinutes') = 'number'
      and (value->>'officialBalanceMinutes' !~ '^-?\d+$'
        or (value->>'officialBalanceMinutes')::numeric not between -1440 and 1440)
      then false
    else (
      select coalesce(bool_and(
        jsonb_typeof(punch) = 'string' and
        ((punch #>> '{}') ~ '^(|([01][0-9]|2[0-3]):[0-5][0-9])$'
          or upper(punch #>> '{}') = 'COMPENSA DIA')
      ), true)
      from jsonb_array_elements(value->'punches') as item(punch)
    )
  end;
$$;

alter table public.records drop constraint if exists records_import_data_check;
alter table public.records add constraint records_import_data_check
  check (public.is_valid_record_import_data(import_data)) not valid;
alter table public.records validate constraint records_import_data_check;

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
    break_minutes, photos, import_data, updated_at
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
    coalesce(parsed.import_data, '{}'::jsonb),
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
