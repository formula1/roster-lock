import { useEffect, useRef, useState } from "react";
import { RosterLockV1Config } from "@roster-lock/types";
import { getPieceFileBlob } from "../game/pieceFiles";
import { characterPiece } from "../game/characterNames";
import { useGameSession } from "../context/GameSessionContext";

const FRONT_FILE = "media/front.svg";
const BACK_FILE = "media/back.svg";

type Sprite = { frontUrl: string | null; backUrl: string | null };
const NO_SPRITE: Sprite = { frontUrl: null, backUrl: null };

// Loads the front/back battle sprites for the character pieces actually in
// play this match. Keyed by piece id (not character id) since two in-game
// characters can share the same roster piece - see characterPieceId(). This
// only runs once the match's pieces are already on the match agent (the
// Download screen's sync-dl step guarantees that before the Game screen
// mounts), so unlike usePieceMedia there's no downloaded-pieces gate here.
export function useCharacterSprites(rosterConfig: RosterLockV1Config, characterIds: Array<string>) {
  const { matchAgent } = useGameSession();
  const [sprites, setSprites] = useState<Record<string, Sprite>>({});
  const started = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!matchAgent) return;

    for (const characterId of characterIds) {
      const piece = characterPiece(rosterConfig, characterId);
      if (!piece || started.current.has(piece.id)) continue;
      started.current.add(piece.id);

      const info = { version: 1 as const, engine: rosterConfig.engine, pieceType: "character", piece };
      Promise.all([
        getPieceFileBlob({ ...info, filePath: FRONT_FILE }, matchAgent.authCode, matchAgent.url).catch(() => null),
        getPieceFileBlob({ ...info, filePath: BACK_FILE }, matchAgent.authCode, matchAgent.url).catch(() => null),
      ]).then(([frontUrl, backUrl]) => {
        setSprites((prev) => ({ ...prev, [piece.id]: { frontUrl, backUrl } }));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchAgent, rosterConfig, characterIds.join(",")]);

  function spriteFor(characterId: string): Sprite {
    const piece = characterPiece(rosterConfig, characterId);
    if (!piece) return NO_SPRITE;
    return sprites[piece.id] ?? NO_SPRITE;
  }

  return { spriteFor };
}
