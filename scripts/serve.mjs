import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function resolveRequestPath(requestUrl) {
  const url = new URL(requestUrl || "/", "http://localhost");
  const decodedPath = decodeURIComponent(url.pathname);
  const candidate = normalize(join(root, decodedPath));
  const relativePath = relative(root, candidate);

  if (relativePath.startsWith("..") || normalize(relativePath).startsWith("..")) {
    return null;
  }

  return candidate;
}

async function findFile(pathname) {
  const candidate = resolveRequestPath(pathname);
  if (!candidate) return null;

  try {
    const fileStat = await stat(candidate);
    if (fileStat.isFile()) return candidate;
    if (fileStat.isDirectory()) {
      const indexFile = join(candidate, "index.html");
      const indexStat = await stat(indexFile);
      if (indexStat.isFile()) return indexFile;
    }
  } catch {
    return join(root, "index.html");
  }

  return join(root, "index.html");
}

const server = createServer(async (request, response) => {
  const filePath = await findFile(request.url);

  if (!filePath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  const extension = extname(filePath);
  response.writeHead(200, {
    "Content-Type": mimeTypes[extension] || "application/octet-stream",
    "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=31536000, immutable"
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, host, () => {
  console.log(`Padoka 100 web listening on http://${host}:${port}`);
});
