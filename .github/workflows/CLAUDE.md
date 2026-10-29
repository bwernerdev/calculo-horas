# .github/workflows
- `ci.yml` — em push/PR para `main`: Node 22, `npm ci`, instala Chromium, `npm run test:all`, envia `playwright-report/` como artefato.
- `healthcheck.yml` — cron a cada 6h (+ manual): `npm run healthcheck` (site + Supabase).
