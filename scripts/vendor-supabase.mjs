import { copyFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = resolve(projectRoot, "node_modules/@supabase/supabase-js");
const packageInfo = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8"));
const pinnedVersion = "2.116.0";
if (packageInfo.version !== pinnedVersion) throw new Error(`Versão inesperada do Supabase: ${packageInfo.version}`);

await copyFile(resolve(packageRoot, "dist/umd/supabase.js"), resolve(projectRoot, "assets/js/vendor/supabase.min.js"));
await copyFile(resolve(packageRoot, "LICENSE"), resolve(projectRoot, "assets/js/vendor/supabase-LICENSE"));
console.log(`Supabase JS ${pinnedVersion} copiado para assets/js/vendor.`);
