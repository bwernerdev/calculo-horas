const fs = require("node:fs");

// Módulos da UI que substituíram o antigo script.js (ordem de carga em index.html).
const uiModules = ["app-core", "app-simulation", "app-render", "app-photos", "app-records", "app-export", "app-backup", "app-autobackup", "app-import"].map((name) => `${name}.js`);

function readScripts(files) {
  return files.map((file) => fs.readFileSync(`assets/js/${file}`, "utf8")).join("\n");
}

module.exports = { uiModules, readScripts };
