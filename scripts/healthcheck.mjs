import fs from "node:fs";

const production = JSON.parse(fs.readFileSync(new URL("../config/production.json", import.meta.url), "utf8"));
const siteUrl = process.env.SITE_URL || production.siteUrl;
const supabaseUrl = process.env.SUPABASE_URL || production.supabaseUrl;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || production.supabasePublishableKey;

async function check(name, url, validate, headers = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "follow", headers });
    const body = await response.text();
    if (!response.ok || !validate(body, response)) throw new Error(`HTTP ${response.status}`);
    console.log(`${name}: OK (${response.status}, ${Date.now() - startedAt} ms)`);
  } finally {
    clearTimeout(timeout);
  }
}

await check("Site", siteUrl, (body) => body.includes("Meu Banco de Horas"));
await check(
  "Supabase Auth",
  `${supabaseUrl}/auth/v1/health`,
  () => true,
  { apikey: supabasePublishableKey }
);
