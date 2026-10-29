# assets/js
Ordem de carga definida em `../../index.html`. Scripts clássicos (sem bundler).

## Lógica pura (UMD, testada em `tests/`)
- `calculations.js` → `HoursCalculator`: horas trabalhadas/saldo por registro (tipos: trabalho, folga, feriado, ferias, falta, compensacao; saldo oficial Forponto prevalece), saída sugerida.
- `cycle.js` → `HoursCycle`: `monthForDate`, `rangeForMonth` (ciclo 16→15).
- `time-input.js` → `HoursTimeInput`: `normalizeClock`, `parseDuration`, `formatDuration`.
- `repository.js` → `HoursRepository`: persistência (localStorage e Supabase: records, settings, fotos no Storage, RPC `import_forponto_records`).
- `use-cases.js` → `HoursUseCases`: `getSettings, saveRecord, importForpontoRecords, deleteRecord, deleteAllRecords, saveSettings` (valida e orquestra repository + calculator).
- `forponto-import.js` → `ForpontoImport`: lê XLSX (fflate) / PDF (pdf.js) do Forponto, limites 5 MB/50 págs, gera prévia com status por dia.

## Infra / UI
- `runtime-config.js` — `window.APP_CONFIG` (ambiente, versão, Supabase). Gerado em deploy por `scripts/generate-runtime-config.mjs`.
- `theme-init.js` — `window.AppStorage` (localStorage com fallback em memória) + tema inicial.
- `monitoring.js` — `AppMonitor`: fila local de erros, sanitiza e-mail/token, envia à tabela `client_errors`.
- `app-auth.js` — login, cadastro, recuperação, senha, carregamento da app por usuário.
- `app-pwa.js` — botão de instalar PWA / registro do service worker.
- `script.js` (~800 linhas) — UI principal: render, formulário, fotos/câmera, histórico, filtro de período, simulação/saldo manual, backup JSON, CSV/PDF, diálogos.
- `vendor/` — libs de terceiros (não editar).
