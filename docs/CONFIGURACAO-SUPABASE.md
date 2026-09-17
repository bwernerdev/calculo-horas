# Configuração do Supabase

O banco agora é controlado por migrações numeradas em [`supabase/migrations`](../supabase/migrations/). Novas mudanças devem ser adicionadas em outro arquivo com timestamp; não altere uma migração que já foi aplicada.

## Migrações atuais

1. [`20260915000000_initial_schema.sql`](../supabase/migrations/20260915000000_initial_schema.sql): tabelas, validações, índices, RLS, Storage e restauração de backup.
2. [`20260915000100_client_error_monitoring.sql`](../supabase/migrations/20260915000100_client_error_monitoring.sql): armazenamento privado de erros sanitizados do navegador.
3. [`20260916000000_forponto_import.sql`](../supabase/migrations/20260916000000_forponto_import.sql): marcações e saldo oficial do Forponto.
4. [`20260916010000_atomic_forponto_import.sql`](../supabase/migrations/20260916010000_atomic_forponto_import.sql): importação de blocos Forponto em uma única transação.

## Banco de produção já existente

A primeira migração corresponde ao SQL de segurança que já foi executado manualmente. Em uma produção existente:

1. faça um backup JSON no aplicativo;
2. confira quais migrações da lista acima ainda não foram executadas; aplique somente as pendentes, na ordem, pelo **SQL Editor**;
3. confirme `Success. No rows returned`;
4. em **Table Editor**, confirme a tabela `client_errors` com RLS habilitado e, no **Database > Functions**, confirme `import_forponto_records` antes de publicar a nova interface.

Se você adotar o Supabase CLI para esse banco existente, vincule o projeto e marque a migração inicial como aplicada antes de usar `db push`. Confira o estado com `supabase migration list`; não execute `db reset --linked` em produção.

## Novo ambiente local ou de preview

Com Supabase CLI e Docker instalados:

```bash
supabase start
supabase db reset
```

O reset local recria o banco aplicando as migrações na ordem. Para um projeto remoto novo, vincule explicitamente o projeto, revise o plano e aplique com:

```bash
supabase link --project-ref ID_DO_PROJETO
supabase db push --dry-run
supabase db push
```

Nunca use `--include-seed` nem `db reset --linked` no banco de produção.

## Verificações de segurança

No painel do Supabase:

1. confirme que `point-photos` está privado e aceita apenas JPEGs de até 2 MB;
2. confirme as políticas por usuário de `records`, `settings` e `storage.objects`;
3. confirme que `client_errors` permite `INSERT` autenticado, mas não possui política pública de leitura;
4. confirme a coluna `settings.balance_adjustments`;
5. teste login, criação e exclusão de registro, foto, saldo manual e restauração.

## Autenticação

Em **Authentication > URL Configuration**:

- **Site URL:** `https://banco-horas-controladoria.pages.dev`
- **Redirect URL:** `https://banco-horas-controladoria.pages.dev/**`

No provedor de e-mail, habilite novos cadastros e confirmação de endereço. Configure senha mínima de 8 caracteres, com uma letra maiúscula e um número. Mantenha o CAPTCHA desativado, pois o aplicativo não envia tokens CAPTCHA, e preserve os limites de requisições do Supabase.

## Chaves do navegador

Use somente chaves `publishable` ou `anon`. Nunca exponha `service_role`. Consulte [Ambientes e monitoramento](AMBIENTES-E-MONITORAMENTO.md) para separar as credenciais de produção e preview.

## Checklist

- [ ] Backup JSON exportado
- [ ] Migrações pendentes revisadas e aplicadas
- [ ] RLS e políticas conferidas
- [ ] Bucket `point-photos` privado
- [ ] URLs de autenticação configuradas em cada ambiente
- [ ] Fluxos principais testados
