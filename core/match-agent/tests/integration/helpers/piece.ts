import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join as pathJoin, dirname } from "node:path";
import { tmpdir } from "node:os";
import { RosterLockV1Config, RosterLockPiece } from "@roster-lock/types";

import { prepareDatabase } from "../../../src/handle-room/version-1/globals/FolderDB/SQLFolderDB/schema";

export const TEST_PIECE_TYPE = "character";

export function makeEngine(overrides: Partial<RosterLockV1Config["engine"]> = {}): RosterLockV1Config["engine"] {
  return {
    name: "test-engine",
    version: "1.0.0",
    pieceDefinitions: {
      [TEST_PIECE_TYPE]: {
        selectionStrategy: "mandatory",
        requires: [],
        pathVariables: [],
        assets: [
          { name: "sprite", classification: "media", count: 1, glob: ["sprite.png"] },
        ],
      },
    },
    ...overrides,
  };
}

export function makePiece(overrides: Partial<RosterLockPiece> = {}): RosterLockPiece {
  return {
    id: "test-piece",
    version: { logic: "1.0.0", media: "1.0.0", docs: "1.0.0" },
    humanInfo: { name: "Test Piece", author: "tester", url: "http://example.com" },
    downloadSources: ["http://example.com/download"],
    pathVariables: {},
    requiredPieces: {},
    ...overrides,
  };
}

export async function makeTempFolder(): Promise<string> {
  return mkdtemp(pathJoin(tmpdir(), "match-agent-test-"));
}

// Seeds the pieces table directly (bypassing the real download pipeline in
// ensurePieceExists/addNewPiece, which would require a real download plugin)
// and writes real files under the piece's folder on disk, since the routes
// under test read both the DB row and the filesystem.
export async function seedCompletePiece(opts: {
  folder: string,
  engine: RosterLockV1Config["engine"],
  pieceType: string,
  piece: RosterLockPiece,
  folderName: string,
  files: Record<string, string>,
  complete?: boolean,
}) {
  const { folder, engine, pieceType, piece, folderName, files, complete = true } = opts;
  const pieceIndex = {
    engineName: engine.name,
    pieceType,
    logic: piece.version.logic,
    media: piece.version.media,
  };

  const db = prepareDatabase(pathJoin(folder, "rosterlock.sqlite3.db"));
  try {
    db.insertNewPiece(
      {
        engineName: engine.name,
        pieceType,
        version: piece.version,
        humanInfo: piece.humanInfo,
        pathVariables: piece.pathVariables,
        downloadSources: piece.downloadSources,
      },
      folderName
    );
    if (complete) {
      db.pieceSuccessfullyDownloaded(pieceIndex, piece.downloadSources[0] ?? "");
    }
  } finally {
    db.close();
  }

  const pieceFolder = pathJoin(folder, engine.name, pieceType, folderName);
  await mkdir(pieceFolder, { recursive: true });
  for (const [relativePath, contents] of Object.entries(files)) {
    const fullPath = pathJoin(pieceFolder, relativePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, contents);
  }

  return pieceFolder;
}

export async function cleanupFolder(folder: string) {
  await rm(folder, { recursive: true, force: true });
}
