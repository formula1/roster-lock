import { readFile } from "node:fs/promises";
import { HTTPRequestHandler, HTTPError, jsonBody } from "../../utils/http-router";
import { pickFile, NoFilePickerAvailable } from "../../utils/pick-file";
import { resolveWithinRoot } from "./resolve-within-root";
import { FileSystemEnv } from "./env";

// Opens a native OS file-picker on match-agent's own host, same reasoning
// as game-launcher/settings.ts's pickGameLauncherBinaryLocation: a browser
// <input type="file"> can report a filename but never an absolute
// filesystem path. Left in place as a convenience for keyboard/mouse
// players even though pages/PreviewRoster itself now defaults to
// OnScreenFileDialog (gamepad-reachable, which a native dialog never can
// be - see docs/decisions, or just GlobalNavContext's own comments).
// Whatever path this returns still has to pass readRosterLock's own
// resolveWithinRoot check to actually be read, same as a manually-typed
// path would.
export const pickRosterLockFile: HTTPRequestHandler = async function(this: FileSystemEnv, { req, res }){
  const body = await jsonBody(req).catch(() => ({}));
  const startPath = typeof body.startPath === "string" ? body.startPath : this.rosterLockFolder;

  let path: string | null;
  try {
    path = await pickFile("Roster Lock", ".roster-lock.json", startPath);
  } catch(e){
    if(e instanceof NoFilePickerAvailable) throw new HTTPError(400, e.message);
    throw e;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(path === null ? { cancelled: true } : { path }));
}

// Reads+parses a roster-lock config straight off match-agent's own host
// disk, for pages/PreviewRoster to open a SelectionBoard against without
// any matchmaker/room involved at all - the only other way SelectionBoard
// ever gets a rosterConfig today is via a live bridge.requestSelection
// (see MatchMakingPage's pendingLightbox). Bounded to this.rosterLockFolder
// - see resolve-within-root.ts for why.
export const readRosterLock: HTTPRequestHandler = async function(this: FileSystemEnv, { res }, routeInfo){
  const requestedPath = routeInfo.url.searchParams.get("path");
  if(!requestedPath) throw new HTTPError(400, "Missing path query parameter");
  const path = resolveWithinRoot(this.rosterLockFolder, requestedPath);

  let contents: string;
  try {
    contents = await readFile(path, "utf8");
  } catch(e){
    const code = (e as NodeJS.ErrnoException).code;
    if(code === "ENOENT") throw new HTTPError(404, `No file at ${path}`);
    if(code === "EISDIR") throw new HTTPError(400, `${path} is a directory, not a file`);
    throw new HTTPError(400, `Could not read ${path}: ${(e as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch(e){
    throw new HTTPError(400, `${path} is not valid JSON: ${(e as Error).message}`);
  }

  // Light, boundary-only validation - just enough to catch "this is some
  // other JSON file" early with a clear message, not a full schema check
  // (there's no runtime validator for RosterLockV1Config in @roster-lock/types
  // today - SelectionBoard itself is the real consumer of this shape).
  if(
    typeof parsed !== "object" || parsed === null
    || !("engine" in parsed) || !("rosters" in parsed)
  ){
    throw new HTTPError(400, `${path} doesn't look like a roster-lock config (missing engine/rosters)`);
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(parsed));
}
