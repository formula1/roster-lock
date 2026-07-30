import { mergeBuffers } from "@roster-lock/utils";
import type { HostFunctions, WalkDir, WalkEntry, WalkedFolder } from "../globals/Host";

export async function collectStream(stream: AsyncIterable<Uint8Array>): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  for await (const chunk of stream) parts.push(chunk);
  return mergeBuffers(parts);
}

// Walk a folder the gui already has a token for (so the host must not
// prompt) - throws instead of returning null to save callers the check.
export async function walkKnownFolder(host: HostFunctions, folderToken: string): Promise<WalkedFolder> {
  if(!host.walkDir) throw new Error("This host cannot walk folders");
  const walked = await host.walkDir(folderToken);
  if(!walked) throw new Error("Folder is not available: " + folderToken);
  return walked;
}

// One pass over a walk, keyed by relativePath - for flows that need random
// access to files after matching assets against the file list.
export async function collectWalkEntries(entries: WalkDir): Promise<Map<string, WalkEntry>> {
  const map = new Map<string, WalkEntry>();
  for await (const entry of entries){
    map.set(entry.relativePath, entry);
  }
  return map;
}

// Loader shape wanted by calculatePieceVersion(), backed by collected entries.
export function entriesFileLoader(entries: Map<string, WalkEntry>){
  return async (relativePath: string) => {
    const entry = entries.get(relativePath);
    if(!entry) throw new Error("File is not in the folder: " + relativePath);
    return { byteSize: entry.size, stream: entry.loadFile() };
  };
}
