-- Somente leitura: mostra quais migrações já estão aplicadas neste banco do Supabase.
-- Cole no SQL Editor e clique em Run. Não altera nada.
-- Coluna "aplicada": true = já existe; false = ainda falta aplicar (na ordem da coluna "ordem").
select * from (values
  (1, '20260915000000_initial_schema',
    to_regclass('public.records') is not null
    and to_regclass('public.settings') is not null
    and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'restore_user_backup')),
  (2, '20260915000100_client_error_monitoring',
    to_regclass('public.client_errors') is not null),
  (3, '20260916000000_forponto_import',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'records' and column_name = 'import_data')),
  (4, '20260916010000_atomic_forponto_import',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'import_forponto_records')),
  (5, '20261029000000_auto_backup_snapshots (opcional)',
    to_regclass('public.backup_snapshots') is not null),
  (6, '20261029000100_user_preferences (opcional)',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'settings' and column_name = 'preferences')
    and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'is_valid_user_preferences'))
) as migracoes(ordem, migracao, aplicada)
order by ordem;
