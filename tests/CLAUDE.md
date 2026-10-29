# tests
Runner nativo: `npm test` (`node --test`). Um arquivo por área:
calculations, cycle, time-input, use-cases, repository, forponto-import, backup-validation, auth-ui, monitoring, platform, deployment, documentation, storage-fallback, storage-security.
Os módulos UMD de `assets/js/` são importados via `require`. Testes de deployment/documentation checam arquivos de configuração e docs — alterar `_headers`, workflows, README ou docs pode quebrá-los.
`insights`, `xlsx-export`, `offline` e `preferences` testam os módulos puros novos; `css.test.js` guarda as regras do CSS. `config.test.js` valida a sincronia de `config/production.json` com `runtime-config.js`/`package.json`. `helpers/app-source.js` concatena os módulos `app-*.js` para testes que inspecionam o código da UI.
