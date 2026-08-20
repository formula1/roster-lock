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

// Reads a local image file and embeds it as a "data:image/<type>;base64,..." URI -
// roster-lock files embed piece images rather than linking them, so they're available
// at selection time without depending on an external host being reachable.
export function encodeImageFile(path: string): string {
  const mimeType = MIME_BY_EXTENSION[extname(path).toLowerCase()];
  if(!mimeType) {
    throw new Error(`Unsupported image extension "${extname(path)}"; expected one of ${Object.keys(MIME_BY_EXTENSION).join(", ")}`);
  }

  const dataURI = `data:${mimeType};base64,${readFileSync(path).toString("base64")}`;
  validateImageDataURI(dataURI);
  return dataURI;
}
