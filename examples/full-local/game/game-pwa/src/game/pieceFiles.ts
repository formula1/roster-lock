import { getPieceFileContents } from "@roster-lock/ts-client";
import { RosterLockPiece, RosterLockV1Config } from "@roster-lock/types";

type GetPieceInfo = {
  version: 1;
  engine: RosterLockV1Config["engine"];
  pieceType: string;
  piece: Pick<RosterLockPiece, "version" | "pathVariables">;
};

// Fetches a single file at a known path within a piece's folder and turns it
// into an object URL the browser can render/play (<img>, <audio>, ...),
// without ever touching the match agent's filesystem directly. Same
// known-path approach game-engine's loadPieceFile.ts uses for stats/logic
// files - we're in control of this game's engine config, so asset file names
// ("portrait.svg", "select.mp3", ...) are fixed, not something to look up.
// The match agent sets a real Content-Type per file extension, so the
// resulting Blob carries the right mime type.
export async function getPieceFileBlob(
  info: GetPieceInfo & { filePath: string },
  matchAgentAuth: string,
  matchAgentUrl: string | URL,
): Promise<string> {
  const response = await getPieceFileContents(info, matchAgentAuth, matchAgentUrl);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

// Same known-path fetch as getPieceFileBlob, but for JSON asset files (e.g.
// weather's "media/particles.json") that get parsed and read directly rather
// than handed to an <img>/<audio> as an object URL.
export async function getPieceFileJSON<T>(
  info: GetPieceInfo & { filePath: string },
  matchAgentAuth: string,
  matchAgentUrl: string | URL,
): Promise<T> {
  const response = await getPieceFileContents(info, matchAgentAuth, matchAgentUrl);
  return (await response.json()) as T;
}
