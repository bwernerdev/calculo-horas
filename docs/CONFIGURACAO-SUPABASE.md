# Configuração do Supabase

Este guia reúne a configuração de banco, Storage e autenticação. Execute a migração antes de publicar uma versão que dependa de alterações no esquema ou nas políticas.

## 1. Backup e migração

1. Exporte um backup JSON pelo aplicativo.
2. No projeto do Supabase, abra o **SQL Editor** e crie uma consulta.
3. Copie todo o conteúdo de [`supabase/security-and-storage.sql`](../supabase/security-and-storage.sql).
4. Execute a consulta e confirme a mensagem `Success. No rows returned`.

O script usa uma transação. Se encontrar registros sem usuário, datas duplicadas ou outros dados incompatíveis, ele interrompe a execução sem aplicar parcialmente as mudanças.

A migração configura:

- validações e índices das tabelas `records` e `settings`;
- relacionamentos com `auth.users` e exclusão em cascata;
- políticas RLS para cada usuário acessar apenas os próprios dados;
- o campo `settings.balance_adjustments`, usado pelos saldos manuais mensais;
- o bucket privado `point-photos`, para JPEGs de até 2 MB;
- a função `restore_user_backup`, que restaura dados e preferências em uma transação.

## 2. Verificações após a migração

No painel do Supabase:

1. Em **Storage**, confirme que `point-photos` está privado e aceita apenas JPEGs de até 2 MB.
2. No editor de políticas, confirme que `records`, `settings` e `storage.objects` possuem somente as políticas por usuário criadas pela migração.
3. Em **Table Editor > settings**, confirme a existência de `balance_adjustments`.
4. Faça login no site e valide a criação, edição e exclusão de um registro com foto.

O caminho de cada foto começa com o ID do usuário autenticado. As políticas do bucket validam essa primeira pasta.

## 3. URLs de autenticação

Em **Authentication > URL Configuration**, configure:

- **Site URL:** `https://banco-horas-controladoria.pages.dev`
- **Redirect URL:** `https://banco-horas-controladoria.pages.dev/**`

Essas URLs são usadas na confirmação de e-mail e na recuperação de senha.

## 4. E-mail e senhas

Em **Authentication > Providers > Email**:

- habilite o provedor de e-mail e novos cadastros;
- mantenha a confirmação de e-mail habilitada para contas públicas.

Em **Authentication > Settings > Password security**:

- defina o mínimo de 8 caracteres;
- exija ao menos uma letra maiúscula e um número, quando disponível;
- ative a proteção contra senhas vazadas, quando disponível.

O aplicativo aplica localmente os mesmos requisitos no cadastro e na definição de uma nova senha.

## 5. CAPTCHA e limites

Em **Authentication > Attack Protection** — ou **Bot and Abuse Protection**, conforme a versão do painel — mantenha **Enable CAPTCHA protection** desativado. O aplicativo não envia tokens CAPTCHA.

Mantenha ativos os limites de requisições para cadastro, login e envio de e-mails. O widget antigo do Cloudflare Turnstile pode ser removido, pois não é usado pelo site.

## 6. Chave utilizada pelo navegador

O arquivo [`assets/js/supabase-config.js`](../assets/js/supabase-config.js) deve conter apenas a URL e uma chave publicável (`publishable` ou `anon`). Nunca exponha a chave `service_role`: ela ignora RLS e deve permanecer somente em ambientes seguros de servidor.

## Checklist

- [ ] Backup JSON exportado
- [ ] Migração executada sem erro
- [ ] RLS e políticas conferidas
- [ ] Bucket `point-photos` privado
- [ ] URLs de autenticação configuradas
- [ ] Cadastro, login, recuperação e fotos testados
- [ ] Deploy realizado conforme o [guia do Cloudflare Pages](DEPLOY-CLOUDFLARE.md)
