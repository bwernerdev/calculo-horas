const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");
const publicFiles = [
  "index.html",
  "style.css",
  "script.js",
  "calculations.js",
  "manifest.webmanifest",
  "service-worker.js",
  "imagens"
];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const relativePath of publicFiles) {
  const source = path.join(root, relativePath);
  const destination = path.join(output, relativePath);
  fs.cpSync(source, destination, { recursive: true });
}

console.log(`Build concluído: ${publicFiles.length} itens copiados para dist/`);
