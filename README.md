# Meu Banco de Horas

Aplicação web para registrar jornadas de trabalho e acompanhar o banco de horas mensal.

**Produção:** [banco-horas-controladoria.pages.dev](https://banco-horas-controladoria.pages.dev/)

## Funcionalidades

- autenticação por e-mail, confirmação de conta e recuperação de senha;
- login por nome de usuário (parte antes de `@`) quando `LOGIN_EMAIL_DOMAIN` está configurado; o e-mail completo continua aceito;
- dados privados por usuário com Supabase e Row Level Security (RLS);
- fotos privadas de entrada e saída no Supabase Storage;
- cálculo de saldo diário e mensal com jornada configurável;
- simulação pessoal com saldo manual, entrada, saída e horário sugerido;
- registro de folgas, feriados, férias e faltas;
- exportação em CSV e PDF e restauração transacional de backup JSON;
- instalação como PWA, tema claro/escuro persistente e layout responsivo.

Importação Forponto: selecione um XLSX ou PDF com texto selecionável (PDF digitalizado não é compatível), escolha o bloco correto e confira a prévia. Ambos os formatos usam as mesmas regras. O PDF precisa ter o layout de colunas esperado; caso contrário, é recusado antes da prévia. Jornadas com quatro marcações usam o intervalo real; com duas marcações válidas, os horários são registrados como entrada e saída, com intervalo de 0 minuto, desde que o relatório informe o saldo final. Esse saldo é usado tanto quando positivo quanto negativo; sem ele, o dia fica para revisão. O dia identificado como “COMPENSA DIA” é salvo como compensação, sem horários. As marcações originais e o saldo oficial de cada dia são preservados; onde o relatório não informa saldo em uma jornada completa, o aplicativo calcula normalmente. Linhas ambíguas continuam pendentes de revisão. Datas já cadastradas são preservadas por padrão; para atualizar importações anteriores, marque a opção correspondente na prévia e confirme a substituição. Fotos existentes são mantidas. O bloco é aplicado em uma única transação: se um dia falhar, nenhum dia é gravado. O PDF é lido no navegador e não é enviado ao servidor.

Antes de publicar esta versão, aplique [a migração Forponto](supabase/migrations/20260916000000_forponto_import.sql) e depois [a migração de importação atômica](supabase/migrations/20260916010000_atomic_forponto_import.sql) no Supabase. A segunda é obrigatória para importar XLSX ou PDF nesta versão.

O botão “Apagar todos os registros” remove os registros de todos os meses e as fotos vinculadas à conta após confirmação digitada. Configurações, tema e saldos manuais não são apagados. Recomenda-se baixar um backup antes.

Quando existem registros e não há backup JSON recente registrado no dispositivo, aparece um lembrete discreto. Após baixar o backup, ele desaparece por 30 dias; “Lembrar depois” adia por 7 dias. O navegador não informa se o usuário guardou o arquivo após iniciar o download.

As fotos são baixadas do Supabase Storage somente quando abertas, ao editar o registro ou ao preparar um backup; uma foto indisponível não impede o carregamento dos demais registros. Se o backup com fotos ultrapassar 50 MB (limite de restauração), o aplicativo oferece um JSON restaurável sem fotos e avisa antes do download. Nesse caso, as fotos já armazenadas continuam no Supabase, mas **não serão recuperadas por esse JSON**. Na simulação pessoal, o estado informa se o saldo manual foi sincronizado com a conta; em caso de falha, o valor pendente permanece neste dispositivo e pode ser reenviado pelo botão “Tentar sincronizar”. Em telas pequenas, o histórico é apresentado em cartões.

O painel usa por padrão ciclos de 16 a 15: o mês de fechamento `2026-09`, por exemplo, considera de 16/08/2026 a 15/09/2026. A partir do dia 16, abre automaticamente o ciclo seguinte. Os cartões, o histórico, a saída sugerida, a simulação e as exportações seguem esse período. Os campos editáveis “De” e “Até” permitem pesquisar outro período inclusivo, mesmo entre meses diferentes. Ao importar um XLSX/PDF Forponto ou restaurar um backup JSON, esse filtro personalizado é preenchido automaticamente com a primeira e a última data dos registros importados. “Limpar período” volta ao ciclo do mês de fechamento selecionado. Os ajustes manuais da simulação continuam vinculados a esse mês de fechamento.

## Desenvolvimento

O projeto usa HTML, CSS e JavaScript sem etapa de compilação. A biblioteca Supabase JS está fixada em `2.116.0` e é servida localmente em `assets/js/vendor/`, inclusive pelo cache do PWA. Após atualizar essa dependência, execute `npm run vendor:supabase` e publique também o arquivo gerado e sua licença.

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
Se o navegador bloquear o armazenamento local, a interface exibirá um aviso: a sessão e as preferências funcionarão apenas enquanto a página estiver aberta.

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
