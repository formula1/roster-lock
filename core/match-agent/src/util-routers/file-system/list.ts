import { readdir, stat } from "node:fs/promises";
import { join as pathJoin, dirname } from "node:path";
import { HTTPRequestHandler, HTTPError } from "../../utils/http-router";
import { resolveWithinRoot } from "./resolve-within-root";
import { FileSystemEnv } from "./env";

export type DirectoryEntry = { name: string, path: string, isDirectory: boolean };
export type DirectoryListing = { path: string, parent: string | null, entries: Array<DirectoryEntry> };

// Backs OnScreenFileDialog (core/match-agent/client/src/components/) - a
// file picker rendered in the page itself, navigable through the same
// Move/Select/Back scheme as everything else (GlobalNavContext), unlike a
// native OS file dialog, which is a window outside the browser's DOM
// entirely and so has no way for a gamepad to reach it at all. Bounded to
// this.rosterLockFolder - see resolve-within-root.ts for why.
export const listDirectoryRoute: HTTPRequestHandler = async function(this: FileSystemEnv, { res }, routeInfo){
  const requestedPath = resolveWithinRoot(this.rosterLockFolder, routeInfo.url.searchParams.get("path"));
  const extensionFilter = routeInfo.url.searchParams.get("extension")?.toLowerCase() || undefined;

  let names: Array<string>;
  try {
    names = await readdir(requestedPath);
  } catch(e){
    const code = (e as NodeJS.ErrnoException).code;
    if(code === "ENOENT") throw new HTTPError(404, `No folder at ${requestedPath}`);
    if(code === "ENOTDIR") throw new HTTPError(400, `${requestedPath} is a file, not a folder`);
    throw new HTTPError(400, `Could not list ${requestedPath}: ${(e as Error).message}`);
  }

  const entries: Array<DirectoryEntry> = [];
  for(const name of names){
    // Dotfiles/dotfolders excluded - not something a roster-lock would
    // ever be, and it keeps the listing from being dominated by them.
    if(name.startsWith(".")) continue;

    const entryPath = pathJoin(requestedPath, name);
    let isDirectory: boolean;
    try {
      isDirectory = (await stat(entryPath)).isDirectory();
    } catch {
      continue; // Broken symlink, permission error, etc - just skip it.
    }
    if(!isDirectory && extensionFilter && !name.toLowerCase().endsWith(extensionFilter)) continue;
    entries.push({ name, path: entryPath, isDirectory });
  }

  // Directories first (so a folder full of matching files doesn't bury
  // the way to navigate deeper), each group alphabetical.
  entries.sort((a, b) => {
    if(a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  // null once *at* the configured root, not just at the OS filesystem root
  // - resolveWithinRoot would reject a parent listing above it anyway, so
  // there's no point offering a ".." that can only ever 403.
  const resolvedRoot = resolveWithinRoot(this.rosterLockFolder, null);
  const parent = requestedPath === resolvedRoot ? null : dirname(requestedPath);

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ path: requestedPath, parent, entries } satisfies DirectoryListing));
}
