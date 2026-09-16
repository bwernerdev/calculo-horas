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

Importação Forponto: selecione um XLSX, escolha o bloco correto e confira a prévia. Jornadas com quatro marcações usam o intervalo real; com duas marcações válidas, os horários são registrados como entrada e saída, com intervalo de 0 minuto, desde que a planilha informe o saldo final. Esse saldo é usado tanto quando positivo quanto negativo; sem ele, o dia fica para revisão. O dia identificado como “COMPENSA DIA” é salvo como compensação, sem horários. As marcações originais e o saldo oficial de cada dia são preservados; onde o relatório não informa saldo em uma jornada completa, o aplicativo calcula normalmente. Linhas ambíguas continuam pendentes de revisão. Datas já cadastradas são preservadas por padrão; para atualizar importações anteriores, marque a opção correspondente na prévia e confirme a substituição. Fotos existentes são mantidas.

Antes de publicar esta versão, aplique [a migração Forponto](supabase/migrations/20260916000000_forponto_import.sql) no Supabase. Ela acrescenta os dados de origem aos registros e aceita o tipo compensação.

O botão “Apagar todos os registros” remove os registros de todos os meses e as fotos vinculadas à conta após confirmação digitada. Configurações, tema e saldos manuais não são apagados. Recomenda-se baixar um backup antes.

No histórico, os campos editáveis “De” e “Até” permitem pesquisar um período inclusivo, mesmo entre meses diferentes (por exemplo, 16/08 a 15/09). A tabela, as fotos, os arquivos CSV/PDF, os cartões de resumo e o saldo dos registros usado na simulação seguem o período pesquisado. Os ajustes manuais da simulação continuam vinculados ao mês selecionado. “Limpar período” volta à visualização e aos cálculos mensais.

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
