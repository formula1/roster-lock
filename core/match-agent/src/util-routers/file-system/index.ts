import { HTTPRouter } from "../../utils/http-router";
import { FileSystemEnv } from "./env";
import { listDirectoryRoute } from "./list";
import { readRosterLock, pickRosterLockFile } from "./roster-lock";

export * from "./env";
export * from "./list";

// Mounted directly in src/index.ts's startServer, outside /v1 entirely -
// unlike handle-room/version-1's routes, these don't touch the room
// protocol (fileDB/pluginRuntime/processHandles) at all, and bounding them
// to one configured folder (rosterLockFolder - see
// resolve-within-root.ts) is a property worth keeping visible at the
// mount site, not buried inside the same router as everything else v1 can
// already do.
export function createFileSystemRouter(rosterLockFolder: string): HTTPRouter {
  const env: FileSystemEnv = { rosterLockFolder };
  const router = new HTTPRouter();
  router.get("/list", listDirectoryRoute.bind(env));
  router.get("/roster-lock", readRosterLock.bind(env));
  router.post("/roster-lock/pick", pickRosterLockFile.bind(env));
  return router;
}
