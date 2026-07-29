import { useEffect, useRef, useState } from "react";
import { RosterLockV1Config, RosterLockV1SyncDLResult } from "@roster-lock/types";
import { getPieceFileBlob } from "../game/pieceFiles";
import { useGameSession } from "../context/GameSessionContext";

const BACKGROUND_FILE = "media/background.svg";

// Mirrors build-game.ts's own read of finalSelection.stage: a "shared"
// selection with exactly one voted-on piece (see the draft's
// selection.piece.stage config). GameState.stage only carries weather, not
// which stage piece was picked, so the piece id has to come from here.
function selectedStagePieceId(downloadResult: RosterLockV1SyncDLResult): string | null {
  const stageSelection = downloadResult.finalSelection.stage;
  if (!stageSelection || stageSelection.type !== "shared") return null;
  return stageSelection.value[0]?.id ?? null;
}

// Loads the background image for whichever stage piece was selected for this
// match. Like useCharacterSprites, assumes the piece is already on the match
// agent by the time the Game screen mounts.
export function useStageBackground(
  rosterConfig: RosterLockV1Config,
  downloadResult: RosterLockV1SyncDLResult,
) {
  const { matchAgent } = useGameSession();
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const started = useRef<string | null>(null);

  const stagePieceId = selectedStagePieceId(downloadResult);

  useEffect(() => {
    if (!matchAgent || !stagePieceId) return;
    if (started.current === stagePieceId) return;
    started.current = stagePieceId;

    const piece = (rosterConfig.rosters.stage ?? []).find((p) => p.id === stagePieceId);
    if (!piece) return;

    const info = { version: 1 as const, engine: rosterConfig.engine, pieceType: "stage", piece };
    getPieceFileBlob({ ...info, filePath: BACKGROUND_FILE }, matchAgent.authCode, matchAgent.url)
      .catch(() => null)
      .then(setBackgroundUrl);
  }, [matchAgent, rosterConfig, stagePieceId]);

  return backgroundUrl;
}
