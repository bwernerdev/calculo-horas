# e2e
Playwright (config em `../playwright.config.js`, Chromium).
- `app.spec.js` — fluxos desktop. `mobile.spec.js` — layout/uso mobile.
- `supabase-mock.js` — mock do backend Supabase para os testes (sem rede real).
Rodar: `npm run test:e2e` (requer `npx playwright install chromium`).
- `ui.spec.js` — calendário, gráfico, variação/meta nos cartões, estado vazio, formulário recolhível, menus e botão flutuante. `helpers.js` — `openMenu(page, nome)` (itens de Exportar/Importar/Mais ficam dentro de menus).
- `visual.spec.js` — comparação de capturas (opt-in: `npm run test:visual:update` cria as referências locais, `npm run test:visual` compara; ignoradas pelo git e fora do CI).
- `a11y.spec.js` — axe (WCAG 2 A/AA) na tela de entrada e no painel, temas claro/escuro.
