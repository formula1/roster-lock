import { CollectionId, MatchLockRestrictionConfig, PieceId, UserId } from "@match-lock/shared";
import { PlayerSelectionWithSeed } from "./player-selection";
import { runScriptInFork } from "../script-vm";

export type FinalSelection = Record<CollectionId, Array<PieceId> | Record<UserId, Array<PieceId>>>;

import {
  Union as CastUnion,
  Array as CastArray,
  Record as CastRecord,
  String as CastString,
} from "runtypes";

const CastGlobalResult = CastArray(CastString);
const CastPlayerResult = CastRecord(CastString, CastArray(CastString));

export const CastFinalSelection = (
  CastRecord(CastString, CastUnion(
    CastGlobalResult,
    CastPlayerResult,
  )).conform<FinalSelection>()
);

export async function finalizeSelection(
  restriction: MatchLockRestrictionConfig,
  players: Record<UserId, PlayerSelectionWithSeed>
): Promise<FinalSelection>{
  const seeds: Record<UserId, string> = {};
  for(const [userId, player] of Object.entries(players)){
    seeds[userId] = player.rngSeed;
  }
  const finalSelection: Record<CollectionId, Array<PieceId> | Record<UserId, Array<PieceId>>> = {};
  await Promise.all(Object.entries(restriction.pieces).map(async ([collectionId, collection])=>{
    if(collection.selectionConfig.type === "mandatory") return;
    if(collection.selectionConfig.type === "on-demand") return;
    if(collection.selectionConfig.type === "agreed") return;
    finalSelection[collectionId] = await handleCollectionSelections(collectionId, collection, players, seeds);
  }));
  return finalSelection;
}


async function handleCollectionSelections(
  collectionId: string,
  collection: MatchLockRestrictionConfig["pieces"][string],
  players: Record<UserId, PlayerSelectionWithSeed>,
  seeds: Record<UserId, string>
){
  const pieces: Record<UserId, Array<PieceId>> = {};
  for(const [userId, player] of Object.entries(players)){
    pieces[userId] = player.selection[collectionId];
  }
  if(!("algorithm" in collection.selectionConfig) || !collection.selectionConfig.algorithm){
    return pieces
  }
  const algorithmResult = await runScriptInFork({
    type: collection.selectionConfig.type,
    scriptConfig: collection.selectionConfig.algorithm,
    args: {
      pieceIds: collection.pieces.map(p=>p.id),
      playerChoices: pieces,
      playerSeeds: seeds,
    },
  });
  if(collection.selectionConfig.type === "global-choices"){
    return CastGlobalResult.check(algorithmResult);
  }
  if(collection.selectionConfig.type === "player-choices"){
    return CastPlayerResult.check(algorithmResult);
  }
  throw new Error("Invalid Collection Type");
}
