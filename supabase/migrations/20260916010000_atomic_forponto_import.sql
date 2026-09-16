-- Importa um bloco Forponto inteiro em uma transação; preserva fotos e IDs existentes.
begin;

create or replace function public.import_forponto_records(p_records jsonb, p_update_existing boolean default false)
returns setof public.records
language plpgsql
security invoker
set search_path = ''
as $$
declare
  applied_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Sessão autenticada obrigatória.';
  end if;
  if p_records is null or jsonb_typeof(p_records) <> 'array' or jsonb_array_length(p_records) > 5000 then
    raise exception 'Lista de registros Forponto inválida.';
  end if;
  if p_update_existing is null then
    raise exception 'Opção de atualização inválida.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_records) as source(item)
    where jsonb_typeof(source.item) <> 'object'
      or source.item->'import_data'->>'source' is distinct from 'forponto'
  ) then
    raise exception 'O lote contém um registro que não é do Forponto.';
  end if;

  return query
    insert into public.records (
      id, user_id, date, type, start_time, end_time,
      break_minutes, photos, import_data, updated_at
    )
    select
      parsed.id, (select auth.uid()), parsed.date, parsed.type,
      parsed.start_time, parsed.end_time, parsed.break_minutes,
      '{}'::jsonb, parsed.import_data, now()
    from jsonb_array_elements(p_records) as source(item)
    cross join lateral jsonb_populate_record(null::public.records, source.item) as parsed
    on conflict (user_id, date) do update set
      type = excluded.type,
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      break_minutes = excluded.break_minutes,
      import_data = excluded.import_data,
      updated_at = excluded.updated_at
    where p_update_existing
    returning public.records.*;

  get diagnostics applied_count = row_count;
  if applied_count <> jsonb_array_length(p_records) then
    raise exception 'Uma data foi incluída por outra sessão. Nenhum dia foi importado; confira a prévia novamente.';
  end if;
end
$$;

revoke all on function public.import_forponto_records(jsonb, boolean) from public;
grant execute on function public.import_forponto_records(jsonb, boolean) to authenticated;

commit;
