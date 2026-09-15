# Meu Banco de Horas

Aplicação web para registrar jornadas de trabalho e acompanhar o banco de horas mensal.

**Produção:** [banco-horas-controladoria.pages.dev](https://banco-horas-controladoria.pages.dev/)

## Funcionalidades

- autenticação por e-mail, confirmação de conta e recuperação de senha;
- dados privados por usuário com Supabase e Row Level Security (RLS);
- fotos privadas de entrada e saída no Supabase Storage;
- cálculo de saldo diário e mensal com jornada configurável;
- simulação pessoal com saldo manual, entrada, saída e horário sugerido;
- registro de folgas, feriados, férias e faltas;
- exportação em CSV e PDF e restauração transacional de backup JSON;
- instalação como PWA, tema claro/escuro persistente e layout responsivo.

## Desenvolvimento

O projeto usa HTML, CSS e JavaScript sem etapa de compilação. A biblioteca Supabase JS é carregada pelo navegador.

Requisitos:

- Node.js 20 ou mais recente;
- um servidor HTTP local para testar recursos do navegador e o PWA.

Instale as dependências e execute toda a suíte:

```bash
npm install
npx playwright install chromium
npm run test:all
```

`npm test` executa apenas os testes unitários; `npm run test:e2e` executa os testes reais de navegador.

Abrir `index.html` diretamente permite uma inspeção básica, mas um servidor local representa melhor o ambiente publicado.

## Publicação e banco de dados

O deploy de produção é automático: cada `push` na branch `main` inicia uma publicação no Cloudflare Pages. Mudanças no esquema ou nas políticas do banco devem ser aplicadas no Supabase antes do deploy correspondente.

- [Configuração do Supabase](docs/CONFIGURACAO-SUPABASE.md)
- [Deploy no Cloudflare Pages](docs/DEPLOY-CLOUDFLARE.md)
- [Ambientes, CI e monitoramento](docs/AMBIENTES-E-MONITORAMENTO.md)
- [Migrações do Supabase](supabase/migrations/)

A aplicação precisa de conexão com o Supabase para autenticar e sincronizar dados. O Service Worker mantém a interface básica em cache, mas não permite alterar registros offline.

## Estrutura do projeto

```text
.
├── index.html                   Estrutura da interface
├── assets/
│   ├── css/                     Estilos
│   ├── images/                  Logo, favicon e ícones do PWA
│   └── js/                      Interface, regras e persistência
├── service-worker.js            Cache e funcionamento do PWA
├── manifest.webmanifest         Metadados de instalação do PWA
├── supabase/                    Migrações e políticas do banco
├── docs/                        Guias operacionais
├── scripts/                     Utilitários de empacotamento
└── tests/                       Testes automatizados
```

`assets/js/runtime-config.js` contém somente a URL, a chave publicável e os metadados do ambiente. A segurança dos dados depende das políticas RLS; nunca coloque uma chave `service_role` no código do navegador.
