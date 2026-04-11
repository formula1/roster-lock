import { RosterLockV1Config } from "@roster-lock/types";

type PieceDefinition = RosterLockV1Config["engine"]["pieceDefinitions"][string];
type EngineAssetDefinition = PieceDefinition["assets"][number];

type FileWithSha = { path: string, asset: EngineAssetDefinition, sha: string }
type FileGetter = (path: string) => Promise<{ byteSize: number, stream: AsyncIterable<Uint8Array> }>
type ProgressListener = (progress: { file: string, current: number, total: number }) => any
export async function calculatePieceVersion(
  files: Map<string, { assets: Array<EngineAssetDefinition> }>,
  getFile: FileGetter,
  onProgress?: ProgressListener
){
  const logicFiles: Array<FileWithSha> = [];
  const mediaFiles: Array<FileWithSha> = [];
  const docFiles: Array<FileWithSha> = [];

  await Promise.all(Array.from(files.entries()).map(async ([relativePath, { assets }]) => {
    const sha = await getHashFromFile(relativePath, getFile, onProgress);
    const asset = assets[0];
    if(!asset) throw new Error(`No asset found for ${relativePath}`);
    switch(asset.classification){
      case "logic": logicFiles.push({ path: relativePath, asset, sha }); break;
      case "media": mediaFiles.push({ path: relativePath, asset, sha }); break;
      case "doc": docFiles.push({ path: relativePath, asset, sha }); break;
      default: throw new Error(`Unknown asset type ${asset.classification}`);
    }
  }));

  return {
    logic: await calculateComnbinedHash(logicFiles.sort(shaSort)),
    media: await calculateComnbinedHash(mediaFiles.sort(shaSort)),
    docs: await calculateComnbinedHash(docFiles.sort(shaSort)),
  }
}

function shaSort(a: FileWithSha, b: FileWithSha){
  return a.sha.localeCompare(b.sha);
}

async function getHashFromFile(
  file: string, getFile: FileGetter, onProgress?: ProgressListener
){
  try {
    const { stream, byteSize } = await getFile(file);
    const buffer = new Uint8Array(byteSize);
    let consumed = 0;
    for await (const chunk of stream){
      buffer.set(chunk, consumed);
      consumed += chunk.byteLength;
      onProgress && onProgress({ file, current: consumed, total: byteSize });
    }
    return toHex(await crypto.subtle.digest("SHA-256", buffer));
  }catch(e){
    throw new Error("Failed to calculate Hash from file")
  }
}


async function calculateComnbinedHash(files: Array<FileWithSha>){
  if (files.length === 0) {
    return toHex(await crypto.subtle.digest("SHA-256", new Uint8Array(0)));
  }

  // Create our array with expected length ahead of time
  const buffer = new Uint8Array(files.length * 32);
  let offset = 0;
  for(const { sha } of files){
    for (let i = 0; i < sha.length; i += 2) {
      // For each 2 characters
      // Try to parse those two chararacters as if it were a hex value
      const byte = Number.parseInt(sha.substring(i, i + 2), 16)
      // If parsing failed, we failed
      if(Number.isNaN(byte)) throw new Error(`Invalid SHA: ${sha}`);
      // If we're ok, we set the byte on the offset directly
      buffer[offset++] = byte;
    }
  }
  return toHex(await crypto.subtle.digest("SHA-256", buffer));
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

