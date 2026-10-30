import { RosterLockV1Config } from "@roster-lock/types";

type PieceDefinition = RosterLockV1Config["engine"]["pieceDefinitions"][string];
type EngineAssetDefinition = PieceDefinition["assets"][number];

type FileWithSha = { path: string, asset: EngineAssetDefinition, sha: string }
type FileGetter = (path: string) => Promise<{ byteSize: number, stream: AsyncIterable<Uint8Array> }>
type ProgressListener = (progress: { file: string, current: number, total: number }) => any

// A piece's version: one hash per classification, each covering every
// file of that classification - its path within the piece and its
// contents. The path is part of it because the engine loads files by path:
// renaming a file, or swapping two files' contents, is a different piece.
//
// Every tool that versions a piece (config-editor, the match agent's
// download check, the website's upload validation) goes through this, so
// they all agree.
export async function calculatePieceVersion(
  files: Map<string, { assets: Array<EngineAssetDefinition> }>,
  getFile: FileGetter,
  onProgress?: ProgressListener
){
  const logicFiles: Array<FileWithSha> = [];
  const mediaFiles: Array<FileWithSha> = [];
  const docFiles: Array<FileWithSha> = [];

  await Promise.all(Array.from(files.entries()).map(async ([relativePath, { assets }]) => {
    const asset = assets[0];
    if(!asset) throw new Error(`No asset found for ${relativePath}`);
    const sha = await getHashFromFile(relativePath, getFile, onProgress);
    const entry = { path: normalizePiecePath(relativePath), asset, sha };
    switch(asset.classification){
      case "logic": logicFiles.push(entry); break;
      case "media": mediaFiles.push(entry); break;
      case "doc": docFiles.push(entry); break;
      default: throw new Error(`Unknown asset type ${asset.classification}`);
    }
  }));

  return {
    logic: await calculateCombinedHash(logicFiles),
    media: await calculateCombinedHash(mediaFiles),
    docs: await calculateCombinedHash(docFiles),
  }
}

// Callers walk folders, archives and browser file lists; whatever they
// produce, "./a\\b" and "a/b" are the same file.
export function normalizePiecePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^(\.\/)+/, "");
}

async function getHashFromFile(
  file: string, getFile: FileGetter, onProgress?: ProgressListener
){
  try {
    const { stream, byteSize } = await getFile(file);
    const buffer = new Uint8Array(byteSize);
    let consumed = 0;
    for await (const chunk of stream){
      if(consumed + chunk.byteLength > byteSize){
        throw new Error(`File is larger than its reported ${byteSize} bytes (did it change while hashing?)`);
      }
      buffer.set(chunk, consumed);
      consumed += chunk.byteLength;
      onProgress && onProgress({ file, current: consumed, total: byteSize });
    }
    if(consumed !== byteSize){
      throw new Error(`Read ${consumed} of ${byteSize} bytes (did it change while hashing?)`);
    }
    return toHex(await crypto.subtle.digest("SHA-256", buffer));
  }catch(e){
    throw new Error(
      `Failed to hash ${file}: ${e instanceof Error ? e.message : String(e)}`,
      { cause: e },
    );
  }
}

const encoder = new TextEncoder();

// Entries sorted by path - compared as plain strings, not localeCompare,
// whose order depends on the machine's locale - each one the path's UTF-8
// bytes, a 0 byte (which can't appear in a path), then the file's 32-byte
// SHA-256.
async function calculateCombinedHash(files: Array<FileWithSha>){
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const parts: Array<Uint8Array> = [];
  for(const { path, sha } of sorted){
    parts.push(encoder.encode(path), new Uint8Array([0]), hexToBytes(sha));
  }
  const buffer = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for(const part of parts){
    buffer.set(part, offset);
    offset += part.byteLength;
  }
  return toHex(await crypto.subtle.digest("SHA-256", buffer));
}

function hexToBytes(sha: string): Uint8Array {
  if(!/^[0-9a-f]{64}$/i.test(sha)) throw new Error(`Invalid SHA: ${sha}`);
  const bytes = new Uint8Array(32);
  for(let i = 0; i < 32; i++) bytes[i] = Number.parseInt(sha.substring(i * 2, i * 2 + 2), 16);
  return bytes;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}
