import { IncomingMessage, ServerResponse } from "http";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { extname, join, normalize, sep } from "path";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

// Serves the built @roster-lock/relay-client (React admin UI) from
// `distDir`. Any request that doesn't hit a real file falls back to
// index.html, same as wrangler's [assets] binding does for relay-server's
// Cloudflare build, so react-router's client-side routes survive a hard
// refresh. Returns false without writing a response when neither the
// requested file nor index.html exist, so the caller can fall back to its
// normal 404 handling.
export async function serveClientAsset(
  req: IncomingMessage,
  res: ServerResponse,
  distDir: string,
): Promise<boolean> {
  const requestPath = new URL(req.url || "/", "http://localhost").pathname;
  const requestedFile = resolveWithinDir(distDir, requestPath);
  const indexPath = join(distDir, "index.html");
  const targetPath = requestedFile && await isFile(requestedFile) ? requestedFile : indexPath;

  if (!(await isFile(targetPath))) return false;

  res.writeHead(200, {
    "Content-Type": MIME_TYPES[extname(targetPath)] || "application/octet-stream",
  });
  if (req.method === "HEAD") {
    res.end();
    return true;
  }

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(targetPath);
    stream.on("error", reject);
    stream.on("close", resolve);
    stream.pipe(res);
  });
  return true;
}

function resolveWithinDir(distDir: string, requestPath: string): string | null {
  try {
    const safePath = normalize(join(distDir, decodeURIComponent(requestPath)));
    if (safePath !== distDir && !safePath.startsWith(distDir + sep)) return null;
    return safePath;
  } catch {
    return null;
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}
