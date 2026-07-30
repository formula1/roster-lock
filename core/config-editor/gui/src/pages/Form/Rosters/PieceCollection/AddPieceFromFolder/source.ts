import type { WalkDir } from "../../../../../globals/Host";
import type { PluginFunctions, DownloadSession } from "../../../../../globals/agent";

// Where the piece's files come from - a walked host folder or an agent
// download session. Everything downstream (asset matching, piece info,
// hashing) only sees `entries`, so both origins share the same pipeline.
export type PieceSource = {
  // Human-readable origin, shown in the UI.
  label: string,
  // Set when the source is a walked host folder - persisted as the new
  // piece's draft referenceFolder.
  folderToken?: string,
  // Set when the source is a download - recorded on the created piece as a
  // download source that was just tested.
  downloadSource?: string,
  entries: WalkDir,
  // Lets go of anything held for this source (agent scratch space, ...).
  close?: () => void,
};

export function downloadSessionSource(
  plugins: PluginFunctions, source: string, session: DownloadSession
): PieceSource {
  return {
    label: source,
    downloadSource: source,
    entries: {
      [Symbol.asyncIterator]: async function*(){
        for(const entry of session.entries){
          yield {
            relativePath: entry.relativePath,
            fileToken: entry.relativePath,
            size: entry.size,
            loadFile: () => plugins.readDownloadSessionFile(session.sessionId, entry.relativePath),
          };
        }
      },
    },
    close: () => {
      plugins.closeDownloadSession(session.sessionId).catch((e)=>{
        console.error("Failed to close download session", e);
      });
    },
  };
}
