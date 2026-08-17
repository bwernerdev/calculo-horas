# Configuração de segurança e autenticação

Siga esta ordem antes de publicar a versão nova.

## 1. Banco, RLS e Storage

1. Abra o projeto no Supabase.
2. Entre em **SQL Editor** e crie uma nova consulta.
3. Copie todo o conteúdo de `supabase/security-and-storage.sql`.
4. Execute a consulta.
5. Em **Storage**, confirme que existe o bucket privado `point-photos`.
6. Em **Authentication > Policies**, confirme que `records` e `settings` não possuem políticas antigas ou públicas além das políticas por usuário criadas pelo script.

O caminho de cada foto começa com o ID do usuário. As políticas do bucket validam essa primeira pasta.

## 2. URLs de autenticação

Em **Authentication > URL Configuration**:

- Site URL: `https://banco-horas-controladoria.pages.dev`
- Redirect URL: `https://banco-horas-controladoria.pages.dev/**`

Essas URLs são usadas pela confirmação de e-mail e pela recuperação de senha.

## 3. E-mail

Em **Authentication > Providers > Email**:

- habilite o provedor de e-mail;
- habilite novos cadastros;
- mantenha a confirmação de e-mail habilitada para contas públicas.

## 4. Cloudflare Turnstile

1. No Cloudflare, abra **Turnstile** e crie um widget para `banco-horas-controladoria.pages.dev`.
2. Copie a **Site key** pública para `TURNSTILE_SITE_KEY` em `supabase-config.js`.
3. No Supabase, abra a proteção contra bots/CAPTCHA da autenticação.
4. Selecione Cloudflare Turnstile e informe a **Secret key** fornecida pelo Cloudflare.
5. Nunca coloque a Secret key em HTML, JavaScript, GitHub ou no ZIP do site.
6. Gere novamente o ZIP depois de preencher a Site key pública.

O Turnstile só é exibido quando `TURNSTILE_SITE_KEY` está preenchida. Não habilite a exigência de CAPTCHA no Supabase antes disso.

## 5. Publicação

Publique `banco-horas-deploy.zip` no projeto Pages e force a atualização do navegador com `Ctrl + F5`. Em um PWA instalado, feche e abra o aplicativo novamente.

