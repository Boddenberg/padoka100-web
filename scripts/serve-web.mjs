import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { Buffer } from "node:buffer";
import { extname, isAbsolute, join, relative, resolve } from "node:path";

const root = resolve("dist");
const host = "0.0.0.0";
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function responderJson(response, status, dados, somenteCabecalhos = false) {
  const conteudo = Buffer.from(JSON.stringify(dados));
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": conteudo.length,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(somenteCabecalhos ? undefined : conteudo);
}

async function arquivoExistente(caminho) {
  try {
    const informacoes = await stat(caminho);
    return informacoes.isFile() ? informacoes : null;
  } catch {
    return null;
  }
}

function resolverCaminho(pathname) {
  const relativoSolicitado = decodeURIComponent(pathname).replace(/^[/\\]+/, "");
  const candidato = resolve(join(root, relativoSolicitado));
  const relativoAoDist = relative(root, candidato);
  if (relativoAoDist.startsWith("..") || isAbsolute(relativoAoDist)) return null;
  return candidato;
}

function cabecalhoCache(caminho, pathname) {
  if (extname(caminho) === ".html" || pathname === "/sw.js") return "no-store";
  if (pathname.startsWith("/_expo/static/")) return "public, max-age=31536000, immutable";
  return "public, max-age=3600";
}

const servidor = createServer(async (request, response) => {
  const metodo = request.method || "GET";
  const somenteCabecalhos = metodo === "HEAD";
  let url;
  try {
    url = new URL(request.url || "/", "http://localhost");
  } catch {
    responderJson(response, 400, { status: "erro", codigo: "url_invalida" });
    return;
  }

  if (url.pathname === "/health") {
    responderJson(
      response,
      200,
      { status: "ok", aplicacao: "Padoka 100 Web", ambiente: "production" },
      somenteCabecalhos
    );
    return;
  }

  if (!["GET", "HEAD"].includes(metodo)) {
    responderJson(response, 405, { status: "erro", codigo: "metodo_nao_permitido" });
    return;
  }

  const solicitado = resolverCaminho(url.pathname);
  if (!solicitado) {
    responderJson(response, 403, { status: "erro", codigo: "caminho_invalido" });
    return;
  }

  let caminho = solicitado;
  let informacoes = await arquivoExistente(caminho);
  if (!informacoes) {
    if (extname(url.pathname)) {
      responderJson(response, 404, { status: "erro", codigo: "arquivo_nao_encontrado" });
      return;
    }
    caminho = join(root, "index.html");
    informacoes = await arquivoExistente(caminho);
  }

  if (!informacoes) {
    responderJson(response, 503, { status: "erro", codigo: "build_web_ausente" });
    return;
  }

  const extensao = extname(caminho).toLowerCase();
  response.writeHead(200, {
    "Content-Type": mimeTypes[extensao] || "application/octet-stream",
    "Content-Length": informacoes.size,
    "Cache-Control": cabecalhoCache(caminho, url.pathname),
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN"
  });
  if (somenteCabecalhos) {
    response.end();
    return;
  }
  createReadStream(caminho).pipe(response);
});

servidor.listen(port, host, () => {
  console.log(`Padoka 100 Web disponível em http://${host}:${port}`);
});
