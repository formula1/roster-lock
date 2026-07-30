import { RosterLockPiece, RosterLockV1Config } from "@roster-lock/types";

// build-game.ts constructs each in-game character id as
// `${userId}-${characterPiece.id}-${index}` (userId is a bare public-key hex
// string, so it never contains a "-" itself) - reversing that exactly finds
// the roster piece a character came from (its humanInfo, media, ...).
export function characterPieceId(characterId: string): string | null {
  const parts = characterId.split("-");
  if (parts.length < 3) return null;
  return parts.slice(1, -1).join("-");
}

export function characterPiece(
  rosterConfig: RosterLockV1Config,
  characterId: string,
): RosterLockPiece | null {
  const pieceId = characterPieceId(characterId);
  if (!pieceId) return null;
  return (rosterConfig.rosters.character ?? []).find((p) => p.id === pieceId) ?? null;
}

export function characterDisplayName(rosterConfig: RosterLockV1Config, characterId: string): string {
  return characterPiece(rosterConfig, characterId)?.humanInfo.name ?? characterId;
}
