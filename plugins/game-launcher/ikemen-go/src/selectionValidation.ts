// Everything here is imported directly by titled-room (a Cloudflare Worker) as well as by
// match-agent locally and by this plugin's own buildArgs.ts - see the package's "exports" field
// (the "./selection-validation" subpath) and this package's readme. That means NOTHING in this
// file may import anything Node-only (no "node:fs", "node:child_process", "node:crypto", etc),
// nor anything that needs "eval"/"new Function" at runtime (Ajv's schema compilation does -
// confirmed the hard way: titled-room's Worker crashed outright at boot with "Code generation
// from strings disallowed for this context" the moment this file's top-level ajv.compile() call
// actually ran inside workerd). @cfworker/json-schema interprets a schema directly instead of
// compiling it to a function, at the cost of raw validation speed - fine here, since a room's
// gameConfig is a handful of fields checked once per room-create, not a hot loop.
import { Validator } from "@cfworker/json-schema";
import { Count, RosterLockV1Config } from "@roster-lock/types";
import { createShaFromJSON } from "@roster-lock/utils";
import { CHARACTER_PIECE_TYPE } from "./pieceTypes";
import { gameConfigSchema } from "./gameConfigSchema";
import {
  IkemenGameConfig, IkemenTeamMode, SUPPORTED_TEAM_MODES, TEAM_MODE_SELECTION_COUNTS,
  assertSupportedTeamMode, isEngineTeamMode,
} from "./teamMode";

export {
  IkemenGameConfig, IkemenTeamMode, SUPPORTED_TEAM_MODES, TEAM_MODE_SELECTION_COUNTS,
  assertSupportedTeamMode,
};

// An Ikemen engine config is expected to publish one selection config per team mode - the room
// everyone joined already agreed on one of those, so the mode follows from it rather than being a
// separate setting that can disagree with how many characters people actually picked. Throws if
// the matched tag is "simul" (assertSupportedTeamMode) - a config that's officially registered for
// an unsupported mode should say so loudly, not fall through to a guess.
export async function resolveOfficialTeamMode(
  rosterConfig: RosterLockV1Config
): Promise<IkemenTeamMode | undefined> {
  const official = rosterConfig.engine.officialSelections;
  if (!official || official.length === 0) return undefined;
  const hash = await createShaFromJSON(rosterConfig.selection);
  const tag = official.find((entry) => entry.hash === hash)?.tag;
  if (tag === undefined || !isEngineTeamMode(tag)) return undefined;
  assertSupportedTeamMode(tag);
  return tag;
}

function describeCount(count: Count): string {
  if (count === "*") return "unlimited";
  if (Array.isArray(count)) return `${count[0]}-${count[1] === "*" ? "unlimited" : count[1]}`;
  return String(count);
}

// Compares what a selection config *declares* it'll ever hand out (rosterConfig.selection's
// validation.count - a fixed number, "*", or a [min, max] range) against what teamMode requires.
// This is a static check on the rule, not on any actual picks - see buildArgs.ts for the dynamic
// per-match check against real picks, which is the only place actual picks exist.
export function validateSelectionCount(teamMode: IkemenTeamMode, count: Count): Array<string> {
  const { min, max } = TEAM_MODE_SELECTION_COUNTS[teamMode];
  const [declaredMin, declaredMax] = Array.isArray(count)
    ? [count[0], count[1] === "*" ? Infinity : count[1]]
    : count === "*" ? [0, Infinity] : [count, count];

  if (declaredMin < min || declaredMax > max) {
    return [
      `"${teamMode}" team mode expects ${min === max ? `exactly ${min}` : `${min}-${max}`} ` +
      `character(s) per side, but this selection config allows ${describeCount(count)}`
    ];
  }
  return [];
}

// gameConfigSchema.ts's JSONSchemaType<IkemenGameConfig> annotation (ajv, type-only - see that
// file's own import) keeps this schema's shape checked against IkemenGameConfig at compile time;
// @cfworker/json-schema's own Schema type is intentionally loose ([key: string]: any), so this
// cast doesn't lose that guarantee, it just isn't the type the interpreter itself declares.
const gameConfigValidator = new Validator(gameConfigSchema as ConstructorParameters<typeof Validator>[0]);

// Reports every problem with a proposed gameConfig/rosterConfig pairing before a room is even
// created - both a JSON-Schema pass (catches malformed shape: a missing "rounds", a wrong type for
// "roundTime", a teamMode string outside the enum) and, once teamMode resolves to something
// concrete, the count check above. Never throws - this is a "report problems" call for a client or
// matchmaker to render, not a hard-fail one (see buildArgs.ts for the throwing equivalent used at
// match-start).
export async function validateGameConfig(
  gameConfig: unknown, rosterConfig: RosterLockV1Config
): Promise<Array<string>> {
  const problems: Array<string> = [];

  const { valid, errors } = gameConfigValidator.validate(gameConfig);
  if (!valid) {
    // @cfworker/json-schema reports a "properties" keyword error at the parent location
    // ("Property "roundTime" does not match schema.") *alongside* the specific leaf error it
    // wraps ("roundTime": type mismatch) - both real OutputUnits, not a single composite one like
    // ajv's default output. gameConfigSchema is flat (no nested allOf/anyOf), so every violation
    // in practice has exactly one of these wrapper entries per leaf failure; dropping the wrapper
    // keeps the reported message specific instead of doubling up on every schema problem.
    for (const error of errors) {
      if (error.keyword === "properties") continue;
      problems.push(`${error.instanceLocation || "gameConfig"} ${error.error}`);
    }
  }

  // A schema-invalid teamMode was already reported above - re-deriving/re-checking it here would
  // just be noise, so only chase the semantic check once it's a recognized value or absent.
  const override = (gameConfig as Partial<IkemenGameConfig> | null | undefined)?.teamMode;
  if (override !== undefined && !(SUPPORTED_TEAM_MODES as readonly string[]).includes(override)) {
    return problems;
  }

  let teamMode: IkemenTeamMode | undefined = override;
  if (teamMode === undefined) {
    try {
      teamMode = await resolveOfficialTeamMode(rosterConfig);
    } catch (e) {
      problems.push((e as Error).message);
      return problems;
    }
  }
  // Untagged custom selection config, no override - a legitimate case (see readme). Nothing more
  // to check until character count picks the mode at selection time.
  if (teamMode === undefined) return problems;

  const characterSelection = rosterConfig.selection.piece[CHARACTER_PIECE_TYPE];
  if (characterSelection?.type === "normal") {
    problems.push(...validateSelectionCount(teamMode, characterSelection.validation.count));
  }

  return problems;
}
