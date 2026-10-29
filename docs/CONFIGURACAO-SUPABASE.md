# Configuração do Supabase

O banco agora é controlado por migrações numeradas em [`supabase/migrations`](../supabase/migrations/). Novas mudanças devem ser adicionadas em outro arquivo com timestamp; não altere uma migração que já foi aplicada.

## Migrações atuais

1. [`20260915000000_initial_schema.sql`](../supabase/migrations/20260915000000_initial_schema.sql): tabelas, validações, índices, RLS, Storage e restauração de backup.
2. [`20260915000100_client_error_monitoring.sql`](../supabase/migrations/20260915000100_client_error_monitoring.sql): armazenamento privado de erros sanitizados do navegador.
3. [`20260916000000_forponto_import.sql`](../supabase/migrations/20260916000000_forponto_import.sql): marcações e saldo oficial do Forponto.
4. [`20260916010000_atomic_forponto_import.sql`](../supabase/migrations/20260916010000_atomic_forponto_import.sql): importação de blocos Forponto em uma única transação.
5. [`20261029000000_auto_backup_snapshots.sql`](../supabase/migrations/20261029000000_auto_backup_snapshots.sql): tabela `backup_snapshots` (RLS por usuário) para os backups automáticos diários. Opcional: sem ela o aplicativo funciona normalmente e apenas avisa que o recurso está desativado.
6. [`20261029000100_user_preferences.sql`](../supabase/migrations/20261029000100_user_preferences.sql): coluna `settings.preferences` (intervalo padrão e metas por dia da semana). Opcional: sem ela o aplicativo usa o intervalo e a meta únicos e avisa ao tentar salvar valores personalizados.

## Banco de produção já existente — passo a passo

A primeira migração corresponde ao SQL de segurança que já foi executado manualmente. Para aplicar o que estiver pendente:

1. **Faça um backup.** No aplicativo, use **Exportar › Baixar backup** e guarde o arquivo JSON.
2. **Descubra o que já foi aplicado.** No painel do Supabase abra **SQL Editor › New query**, cole o conteúdo de [`supabase/checks/status-migracoes.sql`](../supabase/checks/status-migracoes.sql) e clique em **Run**. A consulta só lê dados; a coluna `aplicada` mostra `true` ou `false` para cada migração.
3. **Aplique somente as que estão `false`, na ordem da coluna `ordem`.** Para cada uma: abra o arquivo em `supabase/migrations/`, copie **todo** o conteúdo, cole em uma nova query do SQL Editor e clique em **Run**. Cada arquivo roda dentro de `begin; ... commit;` e é idempotente (`if not exists`, `drop ... if exists`): se falhar, nada fica pela metade e você pode rodar de novo depois de corrigir o erro.
4. **Confirme.** O resultado esperado é `Success. No rows returned`. Rode outra vez a consulta do passo 2: tudo o que você aplicou deve aparecer como `true`.
5. **Só então publique a nova versão do aplicativo** (o merge em `main` dispara o deploy). As migrações 5 e 6 são opcionais: sem elas o aplicativo funciona, apenas sem backups automáticos e sem intervalo/metas por dia da semana (e avisa quando você tenta usar).

Aplique uma migração por vez e confira antes da próxima. Para validar antes de produção, rode o mesmo passo a passo em um projeto Supabase de teste (veja [Ambientes e monitoramento](AMBIENTES-E-MONITORAMENTO.md)). Nunca edite uma migração já aplicada; correções entram em um arquivo novo.

### Erros comuns

| Mensagem | Causa | O que fazer |
| --- | --- | --- |
| `relation "public.records" does not exist` | A migração 1 ainda não foi aplicada | Aplique a 1 primeiro |
| `permission denied` | Query executada com um papel sem permissão | No SQL Editor use o papel padrão (`postgres`) |
| `check constraint "settings_preferences_check" ... is violated` | Há linha em `settings.preferences` fora do formato esperado | Veja `select user_id, preferences from public.settings where preferences <> '{}'::jsonb;`, corrija ou limpe com `update` e rode de novo |
| `already exists` | A migração (ou parte dela) já estava aplicada | Pode ignorar; confirme pelo passo 2 |

### Como desfazer as migrações opcionais

Somente se necessário e depois de um backup:

- migração 5: `drop table if exists public.backup_snapshots;`
- migração 6: `alter table public.settings drop constraint if exists settings_preferences_check; alter table public.settings drop column if exists preferences; drop function if exists public.is_valid_user_preferences(jsonb);`

O aplicativo continua funcionando sem as duas.

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
5. se aplicou as migrações opcionais, confirme `backup_snapshots` (RLS ativo, sem política para `anon`) e a coluna `settings.preferences`;
6. teste login, criação e exclusão de registro, foto, saldo manual e restauração.

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
