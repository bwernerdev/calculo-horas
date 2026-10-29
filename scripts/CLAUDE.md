# scripts
- `serve-static.mjs` — servidor estático local (`npm run serve`).
- `generate-runtime-config.mjs` — gera `runtime-config.js` a partir de env (`APP_ENVIRONMENT`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `ERROR_REPORTING`); detecta ambiente via `CF_PAGES_BRANCH` (`npm run build:config`).
- `healthcheck.mjs` — verifica site e Supabase (`npm run healthcheck`).
- `vendor-supabase.mjs` — copia supabase-js 2.116.0 de node_modules para `assets/js/vendor`.
- `visual.mjs` — roda `e2e/visual.spec.js` com `VISUAL=1` (`npm run test:visual[:update]`).
- `build-deploy.ps1` — monta `banco-horas-deploy.zip` (deploy manual de contingência).
