import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { validateImageDataURI } from "@roster-lock/shared";

const MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const SUPPORTED_MIME_TYPES = new Set(Object.values(MIME_BY_EXTENSION));

// Reads a local image file, or downloads one from an http(s) URL, and embeds it as a
// "data:image/<type>;base64,..." URI - roster-lock files embed piece images rather
// than linking them, so they're available at selection time without depending on an
// external host being reachable.
export async function encodeImageFile(pathOrUrl: string): Promise<string> {
  const dataURI = /^https?:\/\//i.test(pathOrUrl)
    ? await encodeImageFromURL(pathOrUrl)
    : encodeImageFromLocalFile(pathOrUrl);
  validateImageDataURI(dataURI);
  return dataURI;
}

function encodeImageFromLocalFile(path: string): string {
  const mimeType = MIME_BY_EXTENSION[extname(path).toLowerCase()];
  if(!mimeType) {
    throw new Error(`Unsupported image extension "${extname(path)}"; expected one of ${Object.keys(MIME_BY_EXTENSION).join(", ")}`);
  }

  return `data:${mimeType};base64,${readFileSync(path).toString("base64")}`;
}

async function encodeImageFromURL(url: string): Promise<string> {
  const res = await fetch(url);
  if(!res.ok) throw new Error(`Failed to fetch image (${res.status} ${res.statusText}): ${url}`);

  // Prefer the server's Content-Type; fall back to the URL's extension for hosts that
  // serve images with a generic content type (e.g. application/octet-stream).
  const contentType = res.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  const mimeType = (contentType && SUPPORTED_MIME_TYPES.has(contentType))
    ? contentType
    : MIME_BY_EXTENSION[extname(new URL(url).pathname).toLowerCase()];
  if(!mimeType) {
    throw new Error(
      `Could not determine image type for "${url}" from its Content-Type header or file extension; ` +
      `expected one of ${Array.from(SUPPORTED_MIME_TYPES).join(", ")}`
    );
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}
