begin;

create table if not exists public.client_errors (
  event_id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  environment text not null,
  app_version text not null,
  source text not null,
  message text not null,
  stack text not null default '',
  context jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint client_errors_environment_check check (environment in ('production', 'preview', 'local', 'test', 'unknown')),
  constraint client_errors_context_object_check check (jsonb_typeof(context) = 'object'),
  constraint client_errors_text_limits_check check (
    length(event_id) between 1 and 100 and
    length(app_version) between 1 and 40 and
    length(source) between 1 and 120 and
    length(message) between 1 and 1200 and
    length(stack) <= 1200
  )
);

create index if not exists client_errors_created_idx on public.client_errors (created_at desc);
create index if not exists client_errors_user_created_idx on public.client_errors (user_id, created_at desc);

alter table public.client_errors enable row level security;

drop policy if exists "client_errors_insert_own" on public.client_errors;
create policy "client_errors_insert_own" on public.client_errors
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

revoke all on table public.client_errors from anon;
revoke all on table public.client_errors from authenticated;
grant insert on table public.client_errors to authenticated;

commit;
