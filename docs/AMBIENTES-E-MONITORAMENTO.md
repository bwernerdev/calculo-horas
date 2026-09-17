# Ambientes, CI e monitoramento

## Supabase separado por ambiente

Crie um segundo projeto Supabase para desenvolvimento e previews. Não reutilize o banco de produção em branches de teste.

No Cloudflare Pages, configure estas variáveis em **Settings > Environment variables**:

| Ambiente | Variável | Valor |
| --- | --- | --- |
| Production | `SUPABASE_URL` | URL do Supabase de produção |
| Production | `SUPABASE_PUBLISHABLE_KEY` | Chave publicável de produção |
| Preview | `SUPABASE_URL` | URL do Supabase de teste |
| Preview | `SUPABASE_PUBLISHABLE_KEY` | Chave publicável de teste |
| Ambos | `ERROR_REPORTING` | `true` para enviar erros sanitizados |

O comando `npm run build:config` gera `assets/js/runtime-config.js` durante o build. Em uma branch de preview, o build falha se as credenciais próprias não estiverem configuradas; isso impede acesso acidental ao banco de produção.

Para testes locais, copie [`.env.example`](../.env.example) para um arquivo não versionado e carregue as variáveis no terminal antes de executar o gerador. Não coloque chaves privadas nesse arquivo.

Aplique as mesmas migrações nos dois projetos e configure as URLs de autenticação do projeto de teste para os domínios de preview necessários.

## Integração contínua

O workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) executa testes unitários e Playwright em pushes e pull requests para `main`.

No GitHub, crie uma regra para a branch `main`:

1. exija pull request antes de merge;
2. exija o check `test` do workflow **CI**;
3. bloqueie merge enquanto a branch estiver desatualizada;
4. restrinja pushes diretos, inclusive para administradores se essa for a política desejada.

Essas opções são externas ao repositório e precisam ser ativadas em **Settings > Rules > Rulesets**.

## Testes de navegador

```bash
npm install
npx playwright install chromium
npm run test:e2e
```

Os testes usam um Supabase simulado e não escrevem em produção. Eles cobrem autenticação inicial, persistência de tema, carregamento da conta, simulador e exportação de backup.

## Erros do aplicativo

Falhas inesperadas e erros de sincronização são sanitizados no navegador. E-mails, tokens e parâmetros sensíveis são removidos; cada texto é limitado a 1.200 caracteres. Até 20 eventos ficam temporariamente no dispositivo e são enviados a `client_errors` quando houver sessão e conexão.

A tabela não oferece leitura pública. Consulte os eventos pelo painel administrativo do Supabase. Defina uma rotina de retenção compatível com sua política interna, por exemplo removendo registros antigos após 30 dias.

## Disponibilidade

O workflow [`.github/workflows/healthcheck.yml`](../.github/workflows/healthcheck.yml) verifica o site e o endpoint de saúde do Supabase Auth a cada seis horas. Falhas aparecem na aba **Actions** e podem gerar notificações do GitHub conforme as preferências da conta.

Execute manualmente com:

```bash
npm run healthcheck
```

Esse monitor apenas detecta indisponibilidade. Ele não substitui um plano com garantia de disponibilidade. Se o sistema for essencial, avalie um plano do Supabase que não pause por inatividade e configure alertas externos com o canal usado pela equipe.
