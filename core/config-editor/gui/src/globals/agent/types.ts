import type { ScriptStarter, RosterLockV1Config } from "@roster-lock/types";
import type { JSON_Unknown } from "@roster-lock/utils";

export type PluginInfo = { name: string, package: { name: string, version: string } };
export type OutputLine = { source: "out" | "err", content: string };

// Thrown by plugin capabilities when the underlying process fails - hosts
// should throw this class (not their own copy) so `instanceof` checks in
// shared UI work.
export class ProcessError extends Error {
  constructor(public code: number, public log: Array<OutputLine>){
    super("Process Error: " + code);
  }
}

export type ScriptRunResult = {
  debugLog: Array<string>,
  status: "success" | "fail",
  result: JSON_Unknown,
};

// Capabilities that involve running Roster Lock plugins (download protocols,
// untrusted scripts, ...). These come from a connected match-agent (see
// globals/agent.tsx), not the host - undefined until one connects, and the
// UI hides/disables those features in the meantime.
export type PieceVersion = { logic: string, media: string, docs: string };

// A completed download held in the agent's scratch space. The client can
// only list and read what this download produced - it is the deliberate
// alternative to giving the editor any wider filesystem access on the
// agent's machine. Sessions expire agent-side after a while of inactivity.
export type DownloadSessionEntry = { relativePath: string, size: number };
export type DownloadSession = {
  sessionId: string,
  entries: Array<DownloadSessionEntry>,
};

// A download source with the agent's latest test result - lastTest/success
// are null for sources that were declared but never attempted.
export type AgentDownloadSource = {
  source: string,
  // ms since epoch
  lastTest: number | null,
  success: boolean | null,
  error?: string,
};

// A piece the agent already downloaded (through matches). Identified by
// engine, piece type, and version hashes - the agent doesn't store the
// config-assigned id or requiredPieces.
export type AgentPieceItem = {
  piece: {
    engineName: string,
    pieceType: string,
    version: PieceVersion,
    humanInfo: RosterLockV1Config["rosters"][string][number]["humanInfo"],
    pathVariables: Record<string, string>,
    downloadSources: Array<AgentDownloadSource>,
  },
  // ms since epoch; null when the agent doesn't know
  completedAt: number | null,
};

export type AgentPieceSearch = {
  engineName: string,
  pieceType?: string,
  search?: string,
  page: number,
  limit: number,
};

export type PluginFunctions = {
  getDownloadPlugins: () => Promise<{
    protocol: Array<PluginInfo>,
    compression: Array<PluginInfo & { extensions?: Array<string> }>,
    archive: Array<PluginInfo & { extensions?: Array<string> }>,
  }>,
  matchDownloadProtocols: (url: string) => Promise<Array<PluginInfo>>,
  getScriptPlugins: () => Promise<Array<PluginInfo & { extensions: Array<string> }>>,
  runScript: (scriptConfig: ScriptStarter) => Promise<ScriptRunResult>,
  // Download the source and hash the result into a piece version, entirely
  // on the host's side. One whole operation (rather than "download to temp,
  // then walk the temp folder") because the download may land somewhere the
  // gui could never walk - e.g. a match-agent's scratch space on another
  // machine.
  downloadSourceVersion: (args: {
    source: string,
    pathVariables: Record<string, string>,
    pieceDefinition: RosterLockV1Config["engine"]["pieceDefinitions"][string],
  }) => Promise<PieceVersion>,
  // Download a source into agent scratch space and keep it around so the
  // client can read the files (piece info, hashing, ...) - see
  // DownloadSession. Close it when done; the agent also expires it on its
  // own after inactivity.
  createDownloadSession: (source: string) => Promise<DownloadSession>,
  readDownloadSessionFile: (sessionId: string, relativePath: string) => AsyncIterable<Uint8Array>,
  closeDownloadSession: (sessionId: string) => Promise<void>,
  // Browse pieces the agent downloaded during matches, so they can be added
  // to a roster without re-downloading.
  searchPieces: (query: AgentPieceSearch) => Promise<{ total: number, items: Array<AgentPieceItem> }>,
};
