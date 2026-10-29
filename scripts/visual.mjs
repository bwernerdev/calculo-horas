// Roda a comparação visual (opt-in): `npm run test:visual` compara; `npm run test:visual:update` recria as referências.
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["playwright", "test", "e2e/visual.spec.js", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, VISUAL: "1" },
});
process.exit(result.status ?? 1);
