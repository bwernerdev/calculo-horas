# Meu Banco de Horas

Aplicação web para registrar jornadas de trabalho e acompanhar o banco de horas mensal.

## Funcionalidades

- Autenticação por e-mail com cadastro, confirmação, recuperação e troca de senha
- Registros e configurações privados por usuário com Supabase e Row Level Security
- Fotos privadas de entrada e saída no Supabase Storage
- Cálculo de saldo diário e mensal com meta configurável
- Sugestão de saída limitada preventivamente a 9h45 trabalhadas
- Registro de folgas, feriados, férias e faltas
- Exportação em CSV e PDF
- Backup e restauração transacional em JSON
- Instalação como PWA, tema claro/escuro e layout responsivo

## Publicação

O site está preparado para o Cloudflare Pages. Antes de publicar uma versão que altere banco ou segurança, siga [CONFIGURACAO-SUPABASE-CLOUDFLARE.md](CONFIGURACAO-SUPABASE-CLOUDFLARE.md).

A aplicação depende de conexão com o Supabase para autenticar e sincronizar dados. O Service Worker mantém os arquivos básicos da interface em cache, mas registros não podem ser alterados offline.

## Desenvolvimento

Os arquivos são HTML, CSS e JavaScript sem etapa de compilação. A biblioteca Supabase JS é carregada no navegador.

Com o Node.js instalado, execute:

```bash
npm test
```

Os testes cobrem cálculos, autenticação, backup, operações de repositório, segurança, PWA e comportamento mobile.
