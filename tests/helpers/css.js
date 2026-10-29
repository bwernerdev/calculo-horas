const fs = require("node:fs");

// Minifica o CSS (sem comentários, espaços ou ";" final) para que as asserções não dependam da formatação.
function readCss(file = "assets/css/style.css") {
  return fs.readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,])\s*/g, "$1")
    .replace(/;}/g, "}");
}

module.exports = { readCss };
