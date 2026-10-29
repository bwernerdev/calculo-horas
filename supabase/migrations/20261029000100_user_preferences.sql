-- Preferências por usuário: intervalo padrão e meta por dia da semana.
-- Formato de settings.preferences: {"break": 60, "weekdayTargets": {"1": 528, "5": 480}}
-- (chaves "0" a "6" = domingo a sábado; valores em minutos, de 1 a 600). Ambas as chaves são opcionais.
-- Opcional: sem esta migração o aplicativo continua funcionando com o intervalo e a meta únicos.
begin;

alter table public.settings
  add column if not exists preferences jsonb not null default '{}'::jsonb;

create or replace function public.is_valid_user_preferences(value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(value) is distinct from 'object' then false
    when exists (
      select 1 from jsonb_object_keys(value) as k(key) where k.key not in ('break', 'weekdayTargets')
    ) then false
    when value->'break' is not null and (
      jsonb_typeof(value->'break') is distinct from 'number'
      or (value->>'break') !~ '^[0-9]{1,3}$'
      or (value->>'break')::integer > 600
    ) then false
    when value->'weekdayTargets' is not null and (
      jsonb_typeof(value->'weekdayTargets') is distinct from 'object'
      or exists (
        select 1 from jsonb_each(value->'weekdayTargets') as e(key, val)
        where e.key !~ '^[0-6]$'
          or jsonb_typeof(e.val) is distinct from 'number'
          or e.val::text !~ '^[0-9]{1,3}$'
          or e.val::text::integer not between 1 and 600
      )
    ) then false
    else true
  end
$$;

alter table public.settings drop constraint if exists settings_preferences_check;
alter table public.settings add constraint settings_preferences_check
  check (public.is_valid_user_preferences(preferences)) not valid;
alter table public.settings validate constraint settings_preferences_check;

commit;
