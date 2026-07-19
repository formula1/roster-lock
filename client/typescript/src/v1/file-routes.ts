
import { RosterLockPiece, RosterLockV1Config } from "@roster-lock/types";
import { ROSTERLOCK_MATCH_AGENT_URL } from "../constants/match-agent";
import { HTTPError } from "../utils/fetch";

type GetPieceInfo = {
  version: 1,
  folder: string,
  engine: RosterLockV1Config["engine"]
  pieceType: string
  // These two routes only resolve a piece's on-disk folder (by content hash +
  // pathVariables) - they never need humanInfo/downloadSources/requiredPieces,
  // so callers don't have to carry a full RosterLockPiece around just to read a file.
  piece: Pick<RosterLockPiece, "version" | "pathVariables">
}

export function getPiece(
  lock: RosterLockV1Config, pieceType: string, pieceId: string
): RosterLockPiece{
  const roster = lock.rosters[pieceType];
  if(!roster) throw new Error(`Missing roster ${pieceType}`);
  const piece = roster.find(({ id })=>(id === pieceId));
  if(!piece) throw new Error(`Missing piece ${pieceId}`);
  return piece
}

export async function getPieceAssetFiles(
  {
    version,
    folder,
    engine,
    pieceType,
    piece,
    assetName,
  }: ( GetPieceInfo & { assetName: string }),
  matchAgentAuth: string,
  matchAgentUrl: string | URL = ROSTERLOCK_MATCH_AGENT_URL,
){
  if(version !== 1) throw new Error(`Unsupported Version ${version}`);
  const url = new URL("/v1/piece/asset-files", matchAgentUrl);
  if(!["http:", "https:"].includes(url.protocol)){
    throw new Error("Expecting The match agent url to be http or https");
  }
  const response = await fetch(url.href, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + matchAgentAuth
    },
    body: JSON.stringify({
      folder, engine, pieceType, piece, assetName
    })
  });

  const json = await response.json();

  if(!response.ok){
    throw new HTTPError(
      url, "POST", response, json
    );
  }

  return json as Array<string>;
}



export async function getPieceFileContents(
  {
    version,
    folder,
    engine,
    pieceType,
    piece,
    filePath,
  }: ( GetPieceInfo & { filePath: string }),
  matchAgentAuth: string,
  matchAgentUrl: string | URL = ROSTERLOCK_MATCH_AGENT_URL,
){
  if(version !== 1) throw new Error(`Unsupported Version ${version}`);
  const url = new URL("/v1/piece/file-contents", matchAgentUrl);
  if(!["http:", "https:"].includes(url.protocol)){
    throw new Error("Expecting The match agent url to be http or https");
  }
  const response = await fetch(url.href, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + matchAgentAuth
    },
    body: JSON.stringify({
      folder, engine, pieceType, piece, filePath
    })
  });

  if(!response.ok){
    throw new HTTPError(
      url, "POST", response, null
    );
  }

  return response.body;
}
