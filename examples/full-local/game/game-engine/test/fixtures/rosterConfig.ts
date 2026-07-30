import fs from "node:fs";
import path from "node:path";
import { RosterLockV1Config, RosterLockPiece } from "@roster-lock/types";

// examples/full-local/game/game-engine/test/fixtures -> examples/full-local/pieces
export const PIECES_DIR = path.resolve(__dirname, "../../../../pieces");

const DUMMY_VERSIONS = { logic: "test", media: "test", docs: "test" };

function scanPieceType(pieceType: string): Array<RosterLockPiece> {
  return fs.readdirSync(path.join(PIECES_DIR, pieceType), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry): RosterLockPiece => ({
      id: entry.name,
      version: DUMMY_VERSIONS,
      humanInfo: { name: entry.name, author: "test", url: "" },
      downloadSources: [],
      // stubFetch (fetchStub.ts) resolves files back to disk using this,
      // since it stands in for match-agent's real folder lookup.
      pathVariables: { pieceId: entry.name },
      requiredPieces: {},
    }));
}

// Only the piece types build-game.ts actually reads files for (character,
// move, stage - weather pieces never load a file, see loadWeather).
export function buildFixtureRosterConfig(): RosterLockV1Config {
  return {
    engine: { name: "test", version: "1", pieceDefinitions: {} },
    rosters: {
      character: scanPieceType("character"),
      move: scanPieceType("move"),
      stage: scanPieceType("stage"),
    },
  } as RosterLockV1Config;
}
