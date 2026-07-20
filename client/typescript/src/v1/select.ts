import { DownloadResult, RosterLockPiece, RosterLockV1Config } from "@roster-lock/types";
import { ROSTERLOCK_MATCH_AGENT_URL } from "../constants/match-agent";
import { HTTPError } from "../utils/fetch";

type GetPieceInfo = {
  version: 1,
  engine: RosterLockV1Config["engine"]
  pieceType: string
  piece: RosterLockPiece
}

export async function ensurePieceDownloaded(
  {
    version,
    engine,
    pieceType,
    piece,
  }: GetPieceInfo,
  matchAgentAuth: string,
  matchAgentUrl: string | URL = ROSTERLOCK_MATCH_AGENT_URL,
){
  if(version !== 1) throw new Error(`Unsupported Version ${version}`);
  const url = new URL("/v1/piece", matchAgentUrl);
  if(!["http:", "https:"].includes(url.protocol)){
    throw new Error("Expecting The match agent url to be http or https");
  }
  const response = await fetch(url.href, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + matchAgentAuth
    },
    body: JSON.stringify({
      engine, pieceType, piece
    })
  });

  const json = await response.json();

  if(!response.ok){
    throw new HTTPError(
      url, "POST", response, json
    );
  }
  
  return json as DownloadResult;
}

type ListPiecesConfig = {
  version: 1,
  rosterConfig: RosterLockV1Config,
  pieceType: string,
}

export async function listDownloadedPiecesFromConfig(
  {
    version, rosterConfig, pieceType
  }: ListPiecesConfig,
  pagination: { page: number, limit: number },
  matchAgentAuth: string,
  matchAgentUrl: string | URL = ROSTERLOCK_MATCH_AGENT_URL,
){
  if(version !== 1) throw new Error(`Unsupported Version ${version}`);
  const roster = rosterConfig.rosters[pieceType];
  if(!roster) throw new Error(`Invalid pieceType, missing roster: ${pieceType}`);

  return listDownloadedPiecesDirect(
    {
      version,
      engineName: rosterConfig.engine.name,
      pieceType,
      logicIds: roster.map((piece)=>(piece.version.logic)),
    },
    pagination,
    matchAgentAuth,
    matchAgentUrl,
  );
}

type ListPiecesDirect = {
  version: 1,
  engineName: string,
  pieceType: string,
  logicIds: Array<string>
}

export async function listDownloadedPiecesDirect(
  {
    version, engineName, pieceType, logicIds
  }: ListPiecesDirect,
  { page, limit }: { page: number, limit: number },
  matchAgentAuth: string,
  matchAgentUrl: string | URL = ROSTERLOCK_MATCH_AGENT_URL,
){
  if(version !== 1) throw new Error(`Unsupported Version ${version}`);
  const url = new URL(`/v1/piece/list-downloaded/direct`, matchAgentUrl);
  if(!["http:", "https:"].includes(url.protocol)){
    throw new Error("Expecting The match agent url to be http or https");
  }
  url.searchParams.set("page", page.toString());
  url.searchParams.set("limit", limit.toString());

  const response = await fetch(url.href, {
    method: "QUERY",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + matchAgentAuth
    },
    body: JSON.stringify({
      engineName, pieceType, logicIds
    })
  });

  const json = await response.json();

  if(!response.ok){
    throw new HTTPError(
      url, "POST", response, json
    );
  }
  
  return json as Array<Pick<RosterLockPiece, "version" | "pathVariables">>;
}
