-- Testes pgTAP (rodam com `supabase test db`): isolamento por usuário (RLS) e validação das preferências.
begin;
select plan(21);

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local', now(), now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.local', now(), now());

select ok((select relrowsecurity from pg_class where oid = 'public.records'::regclass), 'RLS ativa em records');
select ok((select relrowsecurity from pg_class where oid = 'public.settings'::regclass), 'RLS ativa em settings');
select ok((select relrowsecurity from pg_class where oid = 'public.client_errors'::regclass), 'RLS ativa em client_errors');
select ok((select relrowsecurity from pg_class where oid = 'public.backup_snapshots'::regclass), 'RLS ativa em backup_snapshots');

-- Usuário A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.records (id, user_id, date, type, start_time, end_time, break_minutes, photos)
    values ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-10-19', 'folga', '', '', 0, '{}')$$,
  'A grava o próprio registro');
select throws_ok(
  $$insert into public.records (id, user_id, date, type, start_time, end_time, break_minutes, photos)
    values ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2026-10-19', 'folga', '', '', 0, '{}')$$,
  '42501', null, 'A não grava registro em nome de B');
select lives_ok(
  $$insert into public.settings (user_id, target_minutes, theme, preferences)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 528, 'light', '{"break":45,"weekdayTargets":{"5":480}}')$$,
  'preferências válidas são aceitas');
select throws_ok(
  $$update public.settings set preferences = '{"weekdayTargets":{"7":480}}' where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '23514', null, 'dia da semana fora de 0-6 é recusado');
select throws_ok(
  $$update public.settings set preferences = '{"break":700}' where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '23514', null, 'intervalo acima de 600 minutos é recusado');
select throws_ok(
  $$update public.settings set preferences = '{"outra":1}' where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '23514', null, 'chaves desconhecidas são recusadas');
select lives_ok(
  $$insert into public.backup_snapshots (user_id, record_count, payload)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1, '{"versao":1,"registros":[]}')$$,
  'A cria uma cópia automática');
select throws_ok(
  $$insert into public.backup_snapshots (user_id, record_count, payload)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1, '{"versao":2,"registros":[]}')$$,
  '23514', null, 'payload de outra versão é recusado');
select is((select count(*)::int from public.records), 1, 'A enxerga apenas o próprio registro');

-- Usuário B
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);

select is((select count(*)::int from public.records), 0, 'B não enxerga registros de A');
select is((select count(*)::int from public.settings), 0, 'B não enxerga configurações de A');
select is((select count(*)::int from public.backup_snapshots), 0, 'B não enxerga cópias de A');
select lives_ok($$update public.records set break_minutes = 5$$, 'B tenta alterar registros (afeta 0 linhas)');
select lives_ok($$delete from public.backup_snapshots$$, 'B tenta apagar cópias (afeta 0 linhas)');

-- Conferência com papel administrativo: nada de A foi alterado
reset role;
select is((select break_minutes from public.records where id = '11111111-1111-4111-8111-111111111111'), 0, 'registro de A continua intacto');
select is((select count(*)::int from public.backup_snapshots where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1, 'cópia de A continua existindo');

-- Visitante sem login
set local role anon;
select throws_ok('select * from public.records', '42501', null, 'anon não lê registros');

select * from finish();
rollback;
