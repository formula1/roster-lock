
export function validateSha256(value: string){
  // Must be exactly 64 hex chars (0–9, a–f, case‑insensitive)
  if (/^[0-9a-f]{64}$/i.test(value)) return;
  throw new Error(`${value} is not a valid SHA-256 (64-char hex)`);
}

export function validateURL(value: string){
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${value} is not a valid URL`);
  }
  if(url.protocol === "http:" && url.hostname === "localhost") return;
  if(!["https:"].includes(url.protocol)) throw new Error(`${value} is not a valid https`);
}

const IMAGE_DATA_URI_PATTERN = /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,([A-Za-z0-9+/]+=*)$/;
export const IMAGE_DATA_URI_MAX_BYTES = 64 * 1024;

// Scripts/event handlers wouldn't execute from an <img src="data:...">, but pieces can
// come from third-party downloadSources - reject anything that would be dangerous if a
// future consumer ever rendered the SVG a different way (e.g. inline in the DOM).
const UNSAFE_SVG_CONTENT_PATTERN = /<\s*script\b|<\s*iframe\b|<\s*embed\b|<\s*object\b|<\s*foreignobject\b|on[a-z]+\s*=|javascript:/i;

export function validateImageDataURI(value: string){
  const match = IMAGE_DATA_URI_PATTERN.exec(value);
  if(!match) throw new Error(`${value.slice(0, 32)}... is not a valid "data:image/<type>;base64,..." URI`);

  const [, mimeSubtype, base64Data] = match;
  const decodedByteLength = Math.floor(base64Data.length * 3 / 4) - (base64Data.match(/=+$/)?.[0].length ?? 0);
  if(decodedByteLength > IMAGE_DATA_URI_MAX_BYTES){
    throw new Error(
      `Embedded image is ${decodedByteLength} bytes, which exceeds the ${IMAGE_DATA_URI_MAX_BYTES}-byte limit`
    );
  }

  if(mimeSubtype === "svg+xml"){
    const svgText = base64ToUtf8(base64Data);
    if(UNSAFE_SVG_CONTENT_PATTERN.test(svgText)){
      throw new Error("Embedded SVG must not contain scripts, event handler attributes, or embedded documents");
    }
  }
}

function base64ToUtf8(base64: string): string {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}
