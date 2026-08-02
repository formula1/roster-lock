import { mkdir, writeFile } from "node:fs/promises";
import { join as pathJoin, dirname } from "node:path";
import { RosterLockV1Config, MediaOverrideEntry } from "@roster-lock/types";

import { prepareDatabase } from "../../../src/handle-room/version-1/globals/FolderDB/SQLFolderDB/schema";

export function makeMediaOverrideEntry(overrides: Partial<MediaOverrideEntry> = {}): MediaOverrideEntry {
  return {
    name: "Alt Sprite",
    assets: ["sprite"],
    downloadSources: ["http://example.com/alt-sprite-download"],
    ...overrides,
  };
}

// Same spirit as seedCompletePiece: seeds the media_overrides table directly
// (bypassing the real download pipeline) and writes real files under the
// override's folder on disk, since the routes under test read both.
export async function seedCompleteMediaOverride(opts: {
  folder: string,
  engine: RosterLockV1Config["engine"],
  pieceType: string,
  logicHash: string,
  overrideHash: string,
  entry: MediaOverrideEntry,
  folderName: string,
  files: Record<string, string>,
  complete?: boolean,
}) {
  const { folder, engine, pieceType, logicHash, overrideHash, entry, folderName, files, complete = true } = opts;
  const index = { engineName: engine.name, pieceType, logicHash, overrideHash };

  const db = prepareDatabase(pathJoin(folder, "rosterlock.sqlite3.db"));
  try {
    db.insertNewMediaOverride(
      { ...index, name: entry.name, assets: entry.assets, downloadSources: entry.downloadSources },
      folderName
    );
    if (complete) {
      db.mediaOverrideSuccessfullyDownloaded(index, entry.downloadSources[0] ?? "");
    }
  } finally {
    db.close();
  }

  const overrideFolder = pathJoin(folder, engine.name, pieceType, "media-overrides", folderName);
  await mkdir(overrideFolder, { recursive: true });
  for (const [relativePath, contents] of Object.entries(files)) {
    const fullPath = pathJoin(overrideFolder, relativePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, contents);
  }

  return overrideFolder;
}
