import { join } from "node:path";
import {
  ConnectionConfig, StartGameArgs, PieceType, PieceId, PlayerId, PersonalSelection
} from "@roster-lock/types";
import {
  CHARACTER_PIECE_TYPE, STAGE_PIECE_TYPE, DEF_NAME_VARIABLE, MAX_CHARACTERS_PER_SIDE
} from "../pieceTypes";
import {
  IkemenGameConfig, IkemenTeamMode, TEAM_MODE_SELECTION_COUNTS, assertSupportedTeamMode
} from "../selectionValidation";

export { IkemenGameConfig };

// Ikemen's TeamMode enum (src/system.go - TM_Single/TM_Simul/TM_Turns/TM_Tag).
// -tmode1/-tmode2 are read with Lua's tonumber() (external/script/main.lua), so
// they have to be the numbers - a name like "simul" becomes nil and silently
// drops the side back to single before erroring out in setTeamMode. Includes
// "simul" even though it's not a supported IkemenTeamMode (see
// selectionValidation.ts) purely to document the engine's real numeric mapping.
const TEAM_MODE_NUMBERS = {
  single: 0,
  simul: 1,
  turns: 2,
  tag: 3,
} as const;

function getPersonalCharacterSelection(args: StartGameArgs<IkemenGameConfig>): PersonalSelection {
  const { finalSelection } = args.selectionResult;
  const characterSelection = finalSelection[CHARACTER_PIECE_TYPE];
  if(!characterSelection){
    throw new Error(`No selection for piece type "${CHARACTER_PIECE_TYPE}"`);
  }
  if(characterSelection.type !== "personal"){
    throw new Error(`ikemen-go expects "${CHARACTER_PIECE_TYPE}" to be a personal (per-player) selection`);
  }
  return characterSelection;
}

// The sorted order determining which physical Ikemen side (P1/P2) each
// playerId controls - identical on every machine, since each computes it from
// the same shared, already-resolved finalSelection (confirmed by diffing
// host-vs-client -log output for the same match - see docs/). Exported so
// startGame/index.ts's post-match WinSide-to-PlayerId mapping uses this exact
// same order rather than a second computation that could silently diverge.
export function sortedPlayerIds(args: StartGameArgs<IkemenGameConfig>): Array<PlayerId> {
  const playerIds = Object.keys(getPersonalCharacterSelection(args).value).sort();
  if(playerIds.length !== 2){
    throw new Error(`ikemen-go only supports 2-side matches, got ${playerIds.length} player(s)`);
  }
  return playerIds;
}

export function buildIkemenArgs(
  connectionConfig: ConnectionConfig,
  args: StartGameArgs<IkemenGameConfig>,
  officialTeamMode: IkemenTeamMode | undefined,
  logPath: string,
): Array<string> {
  if(connectionConfig.type !== "direct-tcp"){
    throw new Error(`ikemen-go doesn't support connection type "${connectionConfig.type}" yet`);
  }

  const gameConfig = (args.gameConfig ?? {}) as Partial<IkemenGameConfig>;
  // gameConfig arrives as loosely-typed JSON (never schema-validated at this layer - see
  // selectionValidation.ts's validateGameConfig for the call that does), so even though
  // IkemenGameConfig["teamMode"] excludes "simul" at the type level, runtime data can still smuggle
  // it through - hence the explicit assert rather than trusting the cast above.
  if(gameConfig.teamMode !== undefined) assertSupportedTeamMode(gameConfig.teamMode);

  // No forced -windowed/-width/-height here - Ikemen's own save/config.ini (Fullscreen/
  // WindowWidth/WindowHeight) already controls this per-install, and a previous "just hardcode
  // -width/-height so two instances fit on screen for recording" attempt turned out to actively
  // break window management: passing explicit -width/-height on the command line makes Ikemen's
  // window report a stale, degenerate WM_NORMAL_HINTS "fixed 10x10" size (confirmed by hand via
  // xprop) that blocks every WM-level move/resize/tile afterward, even though the rendered
  // window is clearly much larger - a real GLFW/Ikemen bug in that specific code path. Sizing via
  // config.ini instead (see examples/mugen/integration/src/lib/ikemenInstall.ts's
  // setIkemenWindowSize, used for exactly this recording scenario) doesn't hit it.
  const cliArgs: Array<string> = ["-log", logPath];

  const { finalSelection } = args.selectionResult;
  const characterSelection = getPersonalCharacterSelection(args);
  const playerIds = sortedPlayerIds(args);

  const picksBySide = playerIds.map((playerId) => ({
    playerId, pieces: characterSelection.value[playerId],
  }));
  for(const { playerId, pieces } of picksBySide){
    if(pieces.length === 0){
      throw new Error(`Player "${playerId}" has no characters selected`);
    }
    if(pieces.length > MAX_CHARACTERS_PER_SIDE){
      throw new Error(
        `ikemen-go supports at most ${MAX_CHARACTERS_PER_SIDE} characters per side, ` +
        `player "${playerId}" has ${pieces.length}`
      );
    }
  }

  // Explicit gameConfig wins, then the room's selection config, and only as a last resort a guess
  // from character count - which can't tell tag from turns (both just mean "more than one"; simul
  // is never guessed, since it isn't a supported mode at all - see selectionValidation.ts).
  // Resolved once, not per side: it's documented as applying to both sides equally.
  const teamMode: IkemenTeamMode = gameConfig.teamMode
    ?? officialTeamMode
    ?? (picksBySide.every(({ pieces }) => pieces.length === 1) ? "single" : "tag");

  picksBySide.forEach(({ playerId, pieces }, sideIndex) => {
    const { min, max } = TEAM_MODE_SELECTION_COUNTS[teamMode];
    if(pieces.length < min || pieces.length > max){
      throw new Error(
        `"${teamMode}" team mode expects ${min === max ? `exactly ${min}` : `${min}-${max}`} ` +
        `character(s) per side, player "${playerId}" has ${pieces.length}`
      );
    }
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

  // -ip has to be passed for BOTH sides, never omitted - Ikemen's own -h
  // output says so explicitly: "-ip <hostip> Connect to <hostip> for
  // netplay; leave blank for host". Omitting the flag entirely (this
  // package's original assumption, based on the wiki rather than -h) is not
  // the same as passing it with an empty value: without -ip present at all,
  // Ikemen never engages netplay and just runs an immediate local match
  // controlling both sides - confirmed by hand (a "host" launched without
  // -ip starts instantly and takes local input for both characters, while
  // its supposed client sits waiting for a connection that's never coming
  // because nothing is actually listening).
  cliArgs.push("-setport", String(connectionConfig.port));
  if(connectionConfig.party === "host"){
    cliArgs.push("-ip", "");
  } else {
    cliArgs.push("-ip", connectionConfig.hostIp);
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
function defFileFor(args: StartGameArgs<IkemenGameConfig>, pieceType: PieceType, pieceId: PieceId): string {
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
