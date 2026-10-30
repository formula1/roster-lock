
import { RosterLockV1Config, UserSelection } from "@roster-lock/types";
import { ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "@roster-lock/shared";
import { jsonBody, HTTPRequestHandler, HTTPError } from "../../utils/http-router";
import { UserSelectionSchema } from "./schema/selected";
import { V1Env } from "./globals/types";
import z, { ZodType } from "zod";

export function castLockConfig(uncasted: unknown): RosterLockV1Config {
  const casted = ROSTERLOCK_V1_CASTER_JSONSCHEMA.safeCast(uncasted, true);
  if(!casted.valid) throw new HTTPError(400, "Invalid lockConfig", casted.error);
  return casted.value;
}

// The plugin only knows how to rank pieces it has stats for - it may return a
// partial ranking (or none at all). This reorders the caller's own candidate
// list to match that ranking, appending anything the plugin didn't rank (in
// its original order) at the end, so the response always covers every id the
// caller asked about.
function reorderByRanking(candidateIds: Array<string>, ranked: Array<string>): Array<string> {
  const candidateSet = new Set(candidateIds);
  const rankedFiltered = ranked.filter((id)=>candidateSet.has(id));
  const rankedSet = new Set(rankedFiltered);
  const leftover = candidateIds.filter((id)=>!rankedSet.has(id));
  return [...rankedFiltered, ...leftover];
}

export const listAvailableSortPlugins: HTTPRequestHandler = async function(
  this: V1Env, { res }
){
  const available = await this.pluginRuntime.pieceSort.listAvailable();
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(available));
}

type SortListBody = {
  lockConfig: unknown,
  pieceType: string,
  logicIds: Array<string>,
}

const sortListBodySchema: ZodType<SortListBody> = z.object({
  lockConfig: z.unknown(),
  pieceType: z.string(),
  logicIds: z.array(z.string()),
}).strict();

export const sortListPlugin: HTTPRequestHandler = async function(
  this: V1Env, { req, res }, routeInfo
){
  const pluginName = routeInfo.params.pluginName;
  if(!pluginName) throw new HTTPError(400, "Missing pluginName");

  const body = await jsonBody(req);
  const parseResult = sortListBodySchema.safeParse(body);
  if(!parseResult.success) throw new HTTPError(400, "Bad Form", parseResult.error);
  const { pieceType, logicIds } = parseResult.data;
  const lockConfig = castLockConfig(parseResult.data.lockConfig);

  const ranked = await this.pluginRuntime.pieceSort.sortPieces(pluginName, { lockConfig, pieceType });
  const result = reorderByRanking(logicIds, ranked);

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result));
}

type GameCompleteBody = {
  lockConfig: unknown,
  localUsers: Array<string>,
  userSelections: Record<string, UserSelection>,
  winners: Array<string>,
}

const gameCompleteBodySchema: ZodType<GameCompleteBody> = z.object({
  lockConfig: z.unknown(),
  localUsers: z.array(z.string()),
  userSelections: z.record(z.string(), UserSelectionSchema),
  winners: z.array(z.string()),
}).strict();

export const gameComplete: HTTPRequestHandler = async function(
  this: V1Env, { req, res }
){
  const body = await jsonBody(req);
  const parseResult = gameCompleteBodySchema.safeParse(body);
  if(!parseResult.success) throw new HTTPError(400, "Bad Form", parseResult.error);
  const { localUsers, userSelections, winners } = parseResult.data;
  const lockConfig = castLockConfig(parseResult.data.lockConfig);

  await this.pluginRuntime.pieceSort.handleGameComplete({
    lockConfig, localUsers, userSelections, winners,
  });

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
}
