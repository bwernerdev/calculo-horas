import fs from "node:fs";
import path from "node:path";

const productionBranch = process.env.CF_PAGES_PRODUCTION_BRANCH || "main";
const currentBranch = process.env.CF_PAGES_BRANCH || "local";
const environment = process.env.APP_ENVIRONMENT || (
  currentBranch === "local" ? "local" : currentBranch === productionBranch ? "production" : "preview"
);
const productionFallback = {
  url: "https://kainqngxsiawowbaslhi.supabase.co",
  key: "sb_publishable_8LklqHCaeOzWassgK9FV_A_2D0EoudO",
};
const canUseProductionFallback = environment === "production" || environment === "local";
const supabaseUrl = process.env.SUPABASE_URL || (canUseProductionFallback ? productionFallback.url : "");
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || (canUseProductionFallback ? productionFallback.key : "");

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(`Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY para o ambiente ${environment}.`);
}

const config = {
  environment,
  version: process.env.CF_PAGES_COMMIT_SHA?.slice(0, 12) || process.env.npm_package_version || "development",
  supabaseUrl,
  supabasePublishableKey,
  errorReporting: process.env.ERROR_REPORTING !== "false",
};
const output = `window.APP_CONFIG = Object.freeze(${JSON.stringify(config, null, 2)});\n\nconst SUPABASE_URL = window.APP_CONFIG.supabaseUrl;\nconst SUPABASE_PUBLISHABLE_KEY = window.APP_CONFIG.supabasePublishableKey;\n`;
const destination = path.resolve("assets/js/runtime-config.js");
fs.writeFileSync(destination, output, "utf8");
console.log(`Configuração ${environment} gerada em ${destination}.`);
