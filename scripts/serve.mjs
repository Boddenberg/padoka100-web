import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";

const root = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const productionBackendUrl = stripTrailingSlash(
  process.env.PADOKA_API_PROD_URL || process.env.VITE_API_PROD_URL || "https://padoka100-production.up.railway.app"
);

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

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function shouldProxyRequest(requestUrl) {
  const url = new URL(requestUrl || "/", "http://localhost");
  return url.pathname === "/health" || url.pathname === "/api/v1" || url.pathname.startsWith("/api/v1/");
}

function buildProxyUrl(requestUrl) {
  const url = new URL(requestUrl || "/", "http://localhost");
  return new URL(`${url.pathname}${url.search}`, `${productionBackendUrl}/`);
}

function buildProxyHeaders(request) {
  const headers = new Headers();
  const ignoredHeaders = new Set(["accept-encoding", "connection", "content-length", "host", "transfer-encoding"]);

  Object.entries(request.headers).forEach(([key, value]) => {
    if (!value || ignoredHeaders.has(key.toLowerCase())) return;
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(key, item));
      return;
    }
    headers.set(key, value);
  });

  return headers;
}

async function readRequestBody(request) {
  if (request.method === "GET" || request.method === "HEAD") return undefined;

  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return chunks.length ? Buffer.concat(chunks) : undefined;
}

async function proxyRequest(request, response) {
  try {
    const upstreamResponse = await fetch(buildProxyUrl(request.url), {
      method: request.method,
      headers: buildProxyHeaders(request),
      body: await readRequestBody(request),
      redirect: "manual"
    });
    const responseHeaders = {};
    const ignoredHeaders = new Set(["connection", "content-encoding", "transfer-encoding"]);

    upstreamResponse.headers.forEach((value, key) => {
      if (!ignoredHeaders.has(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });

    response.writeHead(upstreamResponse.status, responseHeaders);
    response.end(Buffer.from(await upstreamResponse.arrayBuffer()));
  } catch (error) {
    console.error("API proxy error", error);
    response.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ detail: "Nao foi possivel conectar ao backend de producao." }));
  }
}

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
  if (shouldProxyRequest(request.url)) {
    await proxyRequest(request, response);
    return;
  }

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
