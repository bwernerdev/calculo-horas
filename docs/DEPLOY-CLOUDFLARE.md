# Deploy no Cloudflare Pages

O projeto usa a integração Git entre GitHub e Cloudflare Pages. Um `push` na branch `main` deve iniciar automaticamente o build e atualizar a produção.

## Configuração esperada

- **Projeto Pages:** `banco-horas-controladoria`
- **Repositório:** `bwernerdev/calculo-horas`
- **Branch de produção:** `main`
- **Framework:** nenhum
- **Diretório raiz:** raiz do repositório
- **Comando de build:** vazio ou `exit 0`
- **Diretório de saída:** raiz do repositório (`.`)

O `index.html` precisa permanecer na raiz do diretório publicado.

## Fluxo de publicação

1. Execute `npm test`.
2. Se houver alteração no banco ou nas políticas, aplique primeiro o [guia do Supabase](CONFIGURACAO-SUPABASE.md).
3. Faça commit das alterações e envie a branch `main` ao GitHub.
4. No GitHub, abra o commit e confirme que o check **Cloudflare Pages** terminou com sucesso.
5. No Cloudflare, abra **Workers & Pages > banco-horas-controladoria > Deployments** e confira o mesmo commit.
6. Acesse [a URL de produção](https://banco-horas-controladoria.pages.dev/) e faça uma atualização forçada com `Ctrl + F5`. No PWA instalado, feche e abra o aplicativo novamente.

## Quando o deploy automático não iniciar

Confira, nesta ordem:

1. em **Settings > Builds > Branch control**, se os deploys automáticos da branch de produção estão habilitados;
2. se a branch de produção configurada é `main`;
3. em **Settings > Builds**, se o repositório conectado é `bwernerdev/calculo-horas`;
4. nas configurações do GitHub, se o aplicativo **Cloudflare Workers & Pages** ainda tem acesso ao repositório;
5. se a mensagem do commit não começa com um marcador de omissão, como `[CI Skip]` ou `[CF-Pages-Skip]`;
6. nos logs do deployment, se o diretório de saída ou o comando de build estão incorretos.

Se a integração perder acesso ao repositório, remova e instale novamente o aplicativo do Cloudflare no GitHub e reconecte o projeto.

## Empacotamento manual de contingência

O utilitário abaixo gera `banco-horas-deploy.zip` com os arquivos públicos:

```powershell
.\scripts\build-deploy.ps1
```

O ZIP é apenas um artefato de contingência e não faz parte do fluxo normal da integração Git. Ele fica ignorado pelo Git.

## Referências

- [Integração Git do Cloudflare Pages](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [Configuração de build](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Controle de branches](https://developers.cloudflare.com/pages/configuration/branch-build-controls/)
