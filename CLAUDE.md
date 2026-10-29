# calculo-horas — "Meu Banco de Horas"
PWA em HTML/CSS/JS puro (sem build). Supabase (auth, RLS, Storage). Deploy: push em `main` → Cloudflare Pages. Idioma da UI e dos commits: pt-BR.

## Mapa (cada pasta tem seu CLAUDE.md)
- `index.html` — única página (diálogos, formulários, painel). `service-worker.js` — cache offline do PWA (atualizar lista ao criar/remover assets). `manifest.webmanifest`, `_headers` (CSP/segurança Cloudflare — mudar se adicionar origem externa).
- `assets/` — css, imagens, JS (lógica pura + UI). `tests/` unit (`node --test`), `e2e/` Playwright, `scripts/` utilitários, `supabase/migrations/` SQL, `docs/` guias, `.github/workflows/` CI.
- `README.md` — regras de negócio detalhadas (Forponto, ciclos 16→15, backup).

## Comandos
`npm run lint` · `npm run typecheck` · `npm run check` (tudo) · `npm test` (unit) · `npm run test:e2e` · `npm run test:all` · `npm run serve` · `npm run vendor:supabase`

## Regras
- Ciclo padrão: mês de fechamento `AAAA-MM` = dia 16 do mês anterior até 15.
- Módulos de lógica (`calculations`, `cycle`, `repository`, `use-cases`, `forponto-import`, `time-input`) são UMD: funcionam no navegador (global) e em Node (testes).
- Migrações já aplicadas nunca se editam; crie nova com timestamp.
- Config de produção (URL/chave Supabase) vive só em `config/production.json`; `types/globals.d.ts` + `tsconfig.json` tipam os módulos UMD (`// @ts-check`).
- CSP sem `unsafe-inline` em estilos: não use `style=` nem `<style>` inline; `scripts/serve-static.mjs` aplica `_headers` nos testes.
- Módulos novos de lógica pura (`insights`, `xlsx-export`, `offline`) seguem o padrão UMD e têm `// @ts-check`. Alterações em `settings` passam por `use-cases.saveSettings` e `repository` (colunas opcionais com fallback quando a migração não foi aplicada).
- Migrações 5 e 6 são opcionais; o app funciona sem elas. Guia de aplicação em `docs/CONFIGURACAO-SUPABASE.md`.
- Ignorar: `node_modules/`, `.npm-cache/`, `test-results/`, `debug.log`.
