import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".webp": "image/webp",
};

export function createStaticServer(rootDirectory = ".") {
  const root = path.resolve(rootDirectory);
  return http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const requestedPath = path.resolve(root, relativePath);
    if (!requestedPath.startsWith(`${root}${path.sep}`) || !fs.existsSync(requestedPath) || fs.statSync(requestedPath).isDirectory()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(requestedPath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(requestedPath).pipe(response);
  });
}

export function startStaticServer(port = Number(process.env.PORT || 4173), rootDirectory = ".") {
  const server = createStaticServer(rootDirectory);
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server);
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 4173);
  await startStaticServer(port);
  console.log(`Servidor local em http://127.0.0.1:${port}`);
}
