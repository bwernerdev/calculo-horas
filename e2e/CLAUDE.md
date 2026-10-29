# e2e
Playwright (config em `../playwright.config.js`, Chromium).
- `app.spec.js` — fluxos desktop. `mobile.spec.js` — layout/uso mobile.
- `supabase-mock.js` — mock do backend Supabase para os testes (sem rede real).
Rodar: `npm run test:e2e` (requer `npx playwright install chromium`).
