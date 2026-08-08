import { join } from "node:path";
import {
  ConnectionConfig, StartGameArgs, PieceType, PieceId, RosterLockV1Config
} from "@roster-lock/types";
import {
  CHARACTER_PIECE_TYPE, STAGE_PIECE_TYPE, DEF_NAME_VARIABLE, MAX_CHARACTERS_PER_SIDE
} from "../pieceTypes";
import { syncSha256FromJSON } from "../hash";

// Ikemen's TeamMode enum (src/system.go - TM_Single/TM_Simul/TM_Turns/TM_Tag).
// -tmode1/-tmode2 are read with Lua's tonumber() (external/script/main.lua), so
// they have to be the numbers - a name like "simul" becomes nil and silently
// drops the side back to single before erroring out in setTeamMode.
const TEAM_MODE_NUMBERS = {
  single: 0,
  simul: 1,
  turns: 2,
  tag: 3,
} as const;

export type IkemenTeamMode = keyof typeof TEAM_MODE_NUMBERS;

function isTeamMode(tag: string): tag is IkemenTeamMode {
  return tag in TEAM_MODE_NUMBERS;
}

// An Ikemen engine config is expected to publish one selection config per team
// mode - the "single" one lets a player pick 1 character, "simul" 2, "tag" 3,
// "turns" 4 - and register each under engine.officialSelections tagged with the
// mode's name. The room everyone joined already agreed on one of those
// selection configs, so the mode follows from it rather than being a separate
// setting that can disagree with how many characters people actually picked.
//
// Hashed the same way the config editor does it (canonical JSON of the
// selection subtree alone), so this matches what "selection hash" prints.
function teamModeFromOfficialSelection(rosterConfig: RosterLockV1Config): IkemenTeamMode | undefined {
  const official = rosterConfig.engine.officialSelections;
  if(!official || official.length === 0) return undefined;
  const hash = syncSha256FromJSON(rosterConfig.selection);
  const tag = official.find((entry) => entry.hash === hash)?.tag;
  if(tag === undefined || !isTeamMode(tag)) return undefined;
  return tag;
}

// Room-shared - every participant agreed to these at room-creation time, so
// this is what a room creator picks and other players inherit unchanged.
export type IkemenGameConfig = {
  // Applies to both sides. Normally left unset - it's derived from the room's
  // selection config via engine.officialSelections. Set it only to override.
  teamMode?: IkemenTeamMode,
  roundTime?: number,
  rounds?: number,
};

export function buildIkemenArgs(
  connectionConfig: ConnectionConfig,
  args: StartGameArgs,
): Array<string> {
  if(connectionConfig.type !== "direct-tcp"){
    throw new Error(`ikemen-go doesn't support connection type "${connectionConfig.type}" yet`);
  }

  const gameConfig = (args.gameConfig ?? {}) as IkemenGameConfig;
  const { finalSelection } = args.selectionResult;
  const officialTeamMode = teamModeFromOfficialSelection(args.rosterConfig);

  const cliArgs: Array<string> = [];

  const characterSelection = finalSelection[CHARACTER_PIECE_TYPE];
  if(!characterSelection){
    throw new Error(`No selection for piece type "${CHARACTER_PIECE_TYPE}"`);
  }
  if(characterSelection.type !== "personal"){
    throw new Error(`ikemen-go expects "${CHARACTER_PIECE_TYPE}" to be a personal (per-player) selection`);
  }

  const playerIds = Object.keys(characterSelection.value).sort();
  if(playerIds.length !== 2){
    throw new Error(`ikemen-go only supports 2-side matches, got ${playerIds.length} player(s)`);
  }

  playerIds.forEach((playerId, sideIndex) => {
    const pieces = characterSelection.value[playerId];
    if(pieces.length === 0){
      throw new Error(`Player "${playerId}" has no characters selected`);
    }
    if(pieces.length > MAX_CHARACTERS_PER_SIDE){
      throw new Error(
        `ikemen-go supports at most ${MAX_CHARACTERS_PER_SIDE} characters per side, ` +
        `player "${playerId}" has ${pieces.length}`
      );
    }
    // Explicit gameConfig wins, then the room's selection config, and only as a
    // last resort the character count - which can't tell simul from tag/turns.
    const teamMode = gameConfig.teamMode
      ?? officialTeamMode
      ?? (pieces.length > 1 ? "simul" : "single");
    cliArgs.push(`-tmode${sideIndex + 1}`, String(TEAM_MODE_NUMBERS[teamMode]));
    pieces.forEach((piece, indexOnSide) => {
      // -p<n> slots interleave between sides rather than running consecutively:
      // Ikemen derives the side from the slot's parity (main.f_playerSide - odd
      // is side 1, even is side 2), so side 1 gets 1/3/5/7 and side 2 gets
      // 2/4/6/8. Numbering them consecutively looks right for 1v1 and silently
      // deals every side's second pick to the opponent in a simul/tag match.
      const slot = sideIndex + 1 + (indexOnSide * 2);
      cliArgs.push(`-p${slot}`, defFileFor(args, CHARACTER_PIECE_TYPE, piece.id));
    });
  });

  const stageSelection = finalSelection[STAGE_PIECE_TYPE];
  if(stageSelection){
    const stagePieces = stageSelection.type === "shared"
      ? stageSelection.value
      : Object.values(stageSelection.value).flat();
    const stagePiece = stagePieces[0];
    if(stagePiece){
      cliArgs.push("-s", defFileFor(args, STAGE_PIECE_TYPE, stagePiece.id));
    }
  }

  if(typeof gameConfig.roundTime === "number") cliArgs.push("-time", String(gameConfig.roundTime));
  if(typeof gameConfig.rounds === "number") cliArgs.push("-rounds", String(gameConfig.rounds));

  // Per Ikemen's own docs: omitting -ip entirely makes this instance the
  // netplay host; passing -ip <addr> makes it connect out as a peer. Exact
  // semantics of -setport on the client side beyond "both ends agree on the
  // same port number" aren't confirmed anywhere beyond Ikemen's own wiki -
  // kept consistent with the host side since that's the only documented
  // convention available.
  cliArgs.push("-setport", String(connectionConfig.port));
  if(connectionConfig.party === "client"){
    cliArgs.push("-ip", connectionConfig.ipAddress);
  }

  return cliArgs;
}

// Ikemen wants the .def file itself, never the folder holding it. Its char
// loader (src/system.go - Select.AddChar) only infers "<name>/<name>.def" from
// a bare name with no "/" in it; anything containing a slash and not already
// ending in ".def" just gets ".def" appended, which for a folder path names a
// sibling of that folder rather than anything inside it. FileExist rejects
// directories outright either way, and stages are the same - -s resolves via
// SearchFile with no extension guessing (external/script/main.lua).
//
// Absolute paths outside the Ikemen install are fine: SearchFile tries
// filepath.IsAbs(file) before it prefixes anything with "chars/", so a piece
// folder living wherever match-agent put it needs no symlink into the tree.
function defFileFor(args: StartGameArgs, pieceType: PieceType, pieceId: PieceId): string {
  const result = args.selectionResult.downloadResults[pieceType]?.[pieceId];
  if(!result){
    throw new Error(`No downloaded piece for ${pieceType}/${pieceId}`);
  }
  const piece = args.rosterConfig.rosters[pieceType]?.find((p) => p.id === pieceId);
  if(!piece){
    throw new Error(`No roster entry for ${pieceType}/${pieceId}`);
  }
  const defName = piece.pathVariables[DEF_NAME_VARIABLE];
  if(!defName){
    throw new Error(
      `ikemen-go needs ${pieceType}/${pieceId} to set a "${DEF_NAME_VARIABLE}" path variable naming its .def file`
    );
  }
  // The convention is a bare name resolved against the piece folder's root - a
  // separator here means the engine config is describing a layout this plugin
  // doesn't handle, so say that rather than building a path that escapes.
  if(/[/\\]/.test(defName)){
    throw new Error(
      `ikemen-go expects "${DEF_NAME_VARIABLE}" to be a bare file name, got "${defName}" for ${pieceType}/${pieceId}`
    );
  }
  return join(result.folder, `${defName}.def`);
}
