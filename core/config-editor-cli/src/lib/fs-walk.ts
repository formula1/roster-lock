import { readdir, stat as fsStat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { join as pathJoin, relative as pathRelative, sep as pathSep } from "node:path";

/**
 * Yields file paths relative to `root`, using forward slashes, matching the
 * convention `getMatchingAssetsForFile` expects for glob matching.
 */
export async function* walkRelative(root: string): AsyncIterable<string> {
  yield* walk(root, root);
}

async function* walk(root: string, dir: string): AsyncIterable<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for(const entry of entries){
    const fullPath = pathJoin(dir, entry.name);
    if(entry.isDirectory()){
      yield* walk(root, fullPath);
    } else {
      yield pathRelative(root, fullPath).split(pathSep).join("/");
    }
  }
}

export async function getFileFromRoot(
  root: string, relativePath: string
): Promise<{ byteSize: number, stream: AsyncIterable<Uint8Array> }> {
  const fullPath = pathJoin(root, relativePath);
  const stats = await fsStat(fullPath);
  return { byteSize: stats.size, stream: createReadStream(fullPath) };
}
