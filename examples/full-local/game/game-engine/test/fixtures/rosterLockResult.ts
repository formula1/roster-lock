import { RosterLockV1SyncDLResult } from "@roster-lock/types";

import { loadPieceModule } from "../../src/game/assets/loadPieceFile";
import { fixturePieceFiles } from "./pieceFiles";

const DUMMY_VERSIONS = { logic: "test", media: "test" };

function downloadResultFor(pieceType: string, pieceId: string){
  // `folder` is unused now that piece files are fetched by identity rather
  // than a pre-resolved on-disk path - kept only because DownloadResult
  // still declares it.
  return { pieceType, pieceId, pieceVersions: DUMMY_VERSIONS, folder: "" };
}

export type CharacterSpec = { userId: string, pieceId: string, moveIds: Array<string> };

// Mirrors buildGameFromSelection's characterId assignment (`${userId}-${pieceId}-${index}`,
// index = position within that user's own selected-characters array).
export function characterIdsBySpec(specs: Array<CharacterSpec>): Record<string, Array<string>> {
  const nextIndex: Record<string, number> = {};
  const result: Record<string, Array<string>> = {};
  for(const spec of specs){
    const index = nextIndex[spec.userId] ?? 0;
    nextIndex[spec.userId] = index + 1;
    result[`${spec.userId}-${spec.pieceId}-${index}`] = spec.moveIds;
  }
  return result;
}

export async function moveSetsWeather(moveId: string): Promise<boolean> {
  return Boolean(
    (await loadPieceModule(fixturePieceFiles, "move", moveId, "logic.js")).moveData.weather
  );
}

export function buildSelectionResult(
  characterSpecs: Array<CharacterSpec>, stagePieceId: string
): RosterLockV1SyncDLResult {
  const characterValue: Record<string, Array<any>> = {};
  const characterDownloads: Record<string, any> = {};
  const moveDownloads: Record<string, any> = {};

  for(const spec of characterSpecs){
    const list = characterValue[spec.userId] ?? (characterValue[spec.userId] = []);
    list.push({
      id: spec.pieceId,
      required: {
        move: {
          mandatory: spec.moveIds.map((moveId) => ({
            id: moveId,
            required: { weather: { mandatory: [], selectable: [] } },
          })),
          selectable: [],
        },
      },
    });
    characterDownloads[spec.pieceId] = downloadResultFor("character", spec.pieceId);
    for(const moveId of spec.moveIds){
      moveDownloads[moveId] = downloadResultFor("move", moveId);
    }
  }

  return {
    finalSelection: {
      character: { type: "personal", value: characterValue },
      stage: {
        type: "shared",
        value: [{ id: stagePieceId, required: { weather: { mandatory: [], selectable: [] } } }],
      },
    },
    downloadResults: {
      character: characterDownloads,
      move: moveDownloads,
      stage: { [stagePieceId]: downloadResultFor("stage", stagePieceId) },
    },
  } as RosterLockV1SyncDLResult;
}
