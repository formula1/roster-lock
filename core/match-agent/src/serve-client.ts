
import { createReadStream } from "node:fs";
import { stat as fsStat, readFile } from "node:fs/promises";
import { join, resolve, normalize, sep } from "node:path";
import { lookup as mimeLookup } from "mime-types";
import { HTTPRequestHandler } from "./utils/http-router";

// dist/serve-client.js and src/serve-client.ts sit at the same depth under
// match-agent/, so this resolves the same way whether running compiled or
// straight from source.
export const CLIENT_DIR = resolve(__dirname, "../client");
export const CLIENT_DIST_DIR = join(CLIENT_DIR, "dist");

// Routes the client's SPA fallback must not swallow.
const API_PATHS = ["/v1", "/editor/v1", "/validate-authcode", "/health"];
function isApiPath(pathname: string): boolean {
  return API_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

// vite is ESM-only, dynamically imported so the dependency stays optional
// for the prebuilt/static path. The type is inferred from that import
// rather than named ("vite"'s CJS type stub - what a "require"-resolved
// static `import type` would hit from this CommonJS package - is a bare
// `any`; only its real ESM types describe ViteDevServer).
function createViteDevServer(){
  return import("vite").then(({ createServer }) => createServer({
    root: CLIENT_DIR,
    server: { middlewareMode: true },
    appType: "custom",
  }));
}

// Vite dev server is expensive to boot (it crawls the client's deps) and
// middleware mode expects one long-lived instance, so it's created once and
// reused across requests rather than per-request.
let viteServerPromise: ReturnType<typeof createViteDevServer> | undefined;
function getViteDevServer(){
  if(!viteServerPromise) viteServerPromise = createViteDevServer();
  return viteServerPromise;
}

// Live-source mode: proxies through Vite's own dev middleware (transforms,
// HMR websocket upgrade, etc.) so the client keeps building from its Vite
// config instead of a separately-built bundle.
export function createDevClientHandler(): HTTPRequestHandler {
  return async ({ req, res }, { url }, next) => {
    if(isApiPath(url.pathname)) return next();
    const vite = await getViteDevServer();
    vite.middlewares(req, res, async (err?: unknown) => {
      if(err) return next(err);
      if((req.method || "GET").toUpperCase() !== "GET") return next();
      try {
        const rawHtml = await readFile(join(CLIENT_DIR, "index.html"), "utf-8");
        const html = await vite.transformIndexHtml(url.pathname, rawHtml);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(html);
      } catch(e){
        next(e);
      }
    });
  };
}

// Prebuilt mode: serves client/dist as static files, falling back to
// index.html for any unmatched GET so client-side routes resolve on refresh.
export function createStaticClientHandler(distDir: string = CLIENT_DIST_DIR): HTTPRequestHandler {
  return async ({ req, res }, { url }, next) => {
    if(isApiPath(url.pathname)) return next();
    if((req.method || "GET").toUpperCase() !== "GET") return next();

    let requestedPath: string;
    try {
      requestedPath = normalize(join(distDir, decodeURIComponent(url.pathname)));
    } catch(e){
      return next(e);
    }
    if(requestedPath !== distDir && !requestedPath.startsWith(distDir + sep)){
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Bad path" }));
      return;
    }

    const filePath = (await resolveExistingFile(requestedPath)) ?? join(distDir, "index.html");
    try {
      res.writeHead(200, { "Content-Type": mimeLookup(filePath) || "application/octet-stream" });
      createReadStream(filePath).pipe(res);
    } catch(e){
      next(e);
    }
  };
}

async function resolveExistingFile(path: string): Promise<string | undefined> {
  try {
    const stat = await fsStat(path);
    return stat.isFile() ? path : undefined;
  } catch {
    return undefined;
  }
}
