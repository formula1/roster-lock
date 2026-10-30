// Deliberately not V1Env - this router lives outside the room protocol
// entirely (see util-routers/file-system/index.ts) and only ever needs
// the one bounded folder it's allowed to touch, not fileDB/pluginRuntime/
// processHandles or anything else the room protocol carries.
export type FileSystemEnv = {
  rosterLockFolder: string,
};
