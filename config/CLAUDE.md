# config
`production.json` — fonte única de URL do site e do Supabase de produção (a chave é *publishable*, pública por design). Lido por `scripts/generate-runtime-config.mjs` e `scripts/healthcheck.mjs`. `assets/js/runtime-config.js` (estático, usado em localhost/produção) deve espelhar estes valores e a versão do `package.json`; `tests/config.test.js` garante a sincronia.
