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

Em **Authentication > Settings > Password security**:

- defina o mínimo de 8 caracteres;
- exija ao menos letras maiúsculas e números, se essa opção estiver disponível no seu plano;
- ative a proteção contra senhas vazadas, se estiver disponível no seu plano.

O site também valida localmente 8 caracteres, uma letra maiúscula e um número, tanto no cadastro quanto na definição de uma nova senha.

## 4. Proteção CAPTCHA desativada

Em **Authentication > Attack Protection** (ou **Bot and Abuse Protection**, conforme a versão do painel):

1. Localize a proteção CAPTCHA.
2. Desative **Enable CAPTCHA protection**.
3. Salve a alteração.

Isso é obrigatório porque o site não envia mais tokens CAPTCHA. Mantenha os limites de requisições do Supabase ativos para reduzir tentativas automatizadas.

Em **Authentication > Rate Limits**, mantenha limites para cadastro, login e envio de e-mails. Para um setor pequeno, os valores padrão normalmente são suficientes; reduza-os apenas se observar abuso para não bloquear usuários legítimos.

O widget antigo pode ser removido posteriormente no painel **Cloudflare > Turnstile**, pois não é mais utilizado pelo site.

## 5. Publicação

Publique `banco-horas-deploy.zip` no projeto Pages e force a atualização do navegador com `Ctrl + F5`. Em um PWA instalado, feche e abra o aplicativo novamente.
