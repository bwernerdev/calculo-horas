const DEFAULT_PRODUCTION_HOSTS = new Set([
  "banco-horas-controladoria.pages.dev",
  "localhost",
  "127.0.0.1",
  "",
]);
const USE_PRODUCTION_DEFAULT = DEFAULT_PRODUCTION_HOSTS.has(window.location.hostname);

window.APP_CONFIG = Object.freeze({
  environment: USE_PRODUCTION_DEFAULT ? "production" : "preview",
  version: "1.1.0",
  supabaseUrl: USE_PRODUCTION_DEFAULT ? "https://kainqngxsiawowbaslhi.supabase.co" : "",
  supabasePublishableKey: USE_PRODUCTION_DEFAULT ? "sb_publishable_8LklqHCaeOzWassgK9FV_A_2D0EoudO" : "",
  loginEmailDomain: "",
  errorReporting: true,
});

const SUPABASE_URL = window.APP_CONFIG.supabaseUrl;
const SUPABASE_PUBLISHABLE_KEY = window.APP_CONFIG.supabasePublishableKey;
