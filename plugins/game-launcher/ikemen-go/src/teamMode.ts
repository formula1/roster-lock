// Base module for team-mode types/constants - no dependency on gameConfigSchema.ts or
// selectionValidation.ts, so both of those (which depend on this one, and on each other in one
// direction only: selectionValidation.ts -> gameConfigSchema.ts) can share it without a cycle.
import { MAX_CHARACTERS_PER_SIDE } from "./pieceTypes";

// The team modes this plugin actually supports today. Ikemen itself also has "simul", but that
// needs more than one human player per side (buildArgs.ts hard-requires exactly 2 players total,
// one per side) - see assertSupportedTeamMode below for how a config that asks for it is rejected
// rather than silently downgraded or guessed around.
export const SUPPORTED_TEAM_MODES = ["single", "tag", "turns"] as const;
export type IkemenTeamMode = typeof SUPPORTED_TEAM_MODES[number];

// Ikemen's full TeamMode enum (src/system.go - TM_Single/TM_Simul/TM_Turns/TM_Tag), needed here
// (not just SUPPORTED_TEAM_MODES) so a selection config officially tagged "simul" is recognized
// and explicitly rejected, rather than falling through as "unrecognized tag" and silently guessed
// around instead.
const ALL_ENGINE_TEAM_MODES = ["single", "simul", "turns", "tag"] as const;
type IkemenEngineTeamMode = typeof ALL_ENGINE_TEAM_MODES[number];

export function isEngineTeamMode(tag: string): tag is IkemenEngineTeamMode {
  return (ALL_ENGINE_TEAM_MODES as readonly string[]).includes(tag);
}

export function assertSupportedTeamMode(tag: string): asserts tag is IkemenTeamMode {
  if ((SUPPORTED_TEAM_MODES as readonly string[]).includes(tag)) return;
  if (tag === "simul") {
    throw new Error(
      "ikemen-go doesn't support \"simul\" team mode yet - it needs more than one human player " +
      "per side, which this plugin doesn't do (it only ever drives exactly 2 sides, one player " +
      "each). Use \"single\", \"tag\", or \"turns\" instead."
    );
  }
  throw new Error(`"${tag}" isn't a team mode ikemen-go recognizes`);
}

// single lets a player pick exactly 1 character; tag/turns may pick anywhere up to Ikemen's
// MaxSimul (see pieceTypes.ts's MAX_CHARACTERS_PER_SIDE) - there's no fixed count for those two,
// unlike single.
export const TEAM_MODE_SELECTION_COUNTS: Record<IkemenTeamMode, { min: number, max: number }> = {
  single: { min: 1, max: 1 },
  tag: { min: 1, max: MAX_CHARACTERS_PER_SIDE },
  turns: { min: 1, max: MAX_CHARACTERS_PER_SIDE },
};

// Room-shared - every participant agreed to these at room-creation time, so this is what a room
// creator picks and other players inherit unchanged.
export type IkemenGameConfig = {
  // Applies to both sides. Normally left unset - it's derived from the room's selection config
  // via engine.officialSelections. Set it only to override.
  teamMode: IkemenTeamMode,
  roundTime: number,
  rounds: number,
};
