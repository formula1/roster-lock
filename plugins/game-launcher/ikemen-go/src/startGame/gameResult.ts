import { StartGameArgs, GameEndedResult } from "@roster-lock/types";
import { IkemenGameConfig } from "../selectionValidation";
import { sortedPlayerIds } from "./buildArgs";
import { handleLog } from "./handle-log";

// Ikemen's -log dump uses 0/1 for which side won - mapped back to a real
// PlayerId via sortedPlayerIds, the exact same sorted order buildIkemenArgs
// used to assign -p1/-p2 (confirmed by diffing host-vs-client -log output for
// the same match: they're byte-identical, WinSide included, so this mapping
// is consistent regardless of which machine's log is read). -1 (a player
// left early) or anything else unexpected means no result - every
// piece-selection-sort plugin already treats gameEnded never firing as "not
// counted", the correct conservative default here.
export async function resolveGameEndedResult(
  logFile: string, args: StartGameArgs<IkemenGameConfig>
): Promise<GameEndedResult | undefined> {
  const parsed = await handleLog(logFile) as { WinSide?: unknown } | null;
  const winSide = parsed?.WinSide;
  if(winSide !== 0 && winSide !== 1) return undefined;
  return { winners: [sortedPlayerIds(args)[winSide]] };
}
