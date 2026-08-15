
import { IFolderDB } from "./FolderDB";
import { PluginManager } from "@roster-lock/plugin-runtime";
import { GameProcessHandle } from "@roster-lock/types";

// Known upfront (CLI --port) rather than read off a listening socket, so it's
// a plain value in the common case - getPort() only needs to be lazy for
// tests that bind an ephemeral port (0) and only learn the real one after
// server.listen() resolves.
export type MatchAgentSelfInfo = {
  authCode: string,
  getPort: () => number,
}

// pluginName is kept alongside the handle (not just the handleId key) so a
// process can be listed/identified without a caller having to already know
// which plugin started it - see game-runner.ts's listGameProcesses.
export type ProcessHandleEntry = {
  pluginName: string,
  handle: GameProcessHandle,
}

export type V1Env = {
  fileDB: IFolderDB,
  pluginRuntime: PluginManager,
  matchAgent: MatchAgentSelfInfo,
  // In-memory only - a match-agent restart loses track of processes it
  // started before the restart (same best-effort tradeoff as GameProcessHandle
  // itself; there's no persistent process-supervision story here).
  processHandles: Map<string, ProcessHandleEntry>,
}
