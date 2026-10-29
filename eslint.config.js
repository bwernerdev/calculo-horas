const js = require("@eslint/js");
const globals = require("globals");

// Scripts clássicos do navegador compartilham estes globais (ver ordem em index.html).
const appGlobals = {
  HoursCalculator: "readonly", HoursCycle: "readonly", HoursRepository: "readonly", HoursUseCases: "readonly",
  HoursTimeInput: "readonly", HoursInsights: "readonly", HoursXlsx: "readonly", ForpontoImport: "readonly", AppMonitor: "readonly", AppStorage: "readonly",
  SUPABASE_URL: "readonly", SUPABASE_PUBLISHABLE_KEY: "readonly", supabase: "readonly", fflate: "readonly",
};

module.exports = [
  { ignores: ["node_modules/**", ".npm-cache/**", "assets/js/vendor/**", "test-results/**", "playwright-report/**"] },
  js.configs.recommended,
  {
    files: ["assets/js/**/*.js", "service-worker.js"],
    languageOptions: { sourceType: "script", globals: { ...globals.browser, ...globals.serviceworker, ...globals.commonjs, ...appGlobals } },
    rules: { "no-unused-vars": ["warn", { vars: "local", args: "none", caughtErrors: "none" }], "no-empty": ["error", { allowEmptyCatch: true }] },
  },
  {
    // Estes scripts dividem declarações de topo ($, showToast, supabaseClient...), então no-undef não se aplica entre eles.
    files: ["assets/js/app-*.js"],
    rules: { "no-undef": "off" },
  },
  {
    // Gerado por scripts/generate-runtime-config.mjs; as constantes são lidas pelos outros scripts.
    files: ["assets/js/runtime-config.js"],
    rules: { "no-redeclare": "off", "no-unused-vars": "off" },
  },
  {
    files: ["tests/**/*.js", "e2e/**/*.js", "playwright.config.js", "eslint.config.js"],
    languageOptions: { sourceType: "commonjs", globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: { sourceType: "module", globals: globals.node },
  },
];
