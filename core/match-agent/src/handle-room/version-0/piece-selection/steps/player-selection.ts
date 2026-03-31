
import { CollectionId, JSON_Unknown, RosterLockV1Config, ROSTERLOCK_V1_CASTER_JSONSCHEMA, UserInput, PieceId } from "@match-lock/shared";
import {
  Object as CastObject,
  Record as CastRecord,
  String as CastString,
  Array as CastArray,
} from "runtypes";
import { runScriptInFork } from "../script-vm";

export type PlayerSelection = Record<CollectionId, Array<PieceId>>;
export const CastPlayerSelection = (
  CastRecord(CastString, CastArray(CastString)).conform<PlayerSelection>()
);

export type PlayerSelectionWithSeed = {
  selection: PlayerSelection;
  rngSeed: string;
}

export const CastPlayerSelectionWithSeed = (
  CastObject({
    selection: CastPlayerSelection,
    rngSeed: CastString,
  }).conform<PlayerSelectionWithSeed>()
);

export function createRandomSeed(){
  const array = new Uint8Array(16); // 16 bytes = 128 bits = 32 hex characters
  crypto.getRandomValues(array);
  const randHex = Array.from(array)
    .map(b => b.toString(16).padStart(2, "0"))
    .join(""); // 32-character hex string
  return randHex;
}

export async function validatePlayerSelection(
  restriction: RosterLockV1Config,
  data: JSON_Unknown
): Promise<UserInput> {
  const casted: PlayerSelectionWithSeed = CastPlayerSelectionWithSeed.check(data);
  if(casted.rngSeed.length !== 32){
    throw new Error("Invalid RNG Seed");
  }
  await Promise.all(Object.entries(restriction.pieces).map(async ([collectionId, collection])=>{
    return runCollectionValidation(collectionId, collection, casted);
  }));
  return casted;
}

function runCollectionValidation(
  collectionId: string,
  collection: MatchLockRestrictionConfig["pieces"][string],
  casted: PlayerSelectionWithSeed
){
  if(collection.selectionConfig.type === "mandatory") return;
  if(collection.selectionConfig.type === "on-demand") return;
  if(collection.selectionConfig.type === "agreed") return;
  const pieces = casted.selection[collectionId];
  const validation = collection.selectionConfig.validation;
  if(!pieces){
    throw new Error(`Missing Collection ${collectionId}`);
  }
  if(!validation) return;
  if(validation.unique && new Set(pieces).size !== pieces.length){
    throw new Error(`Duplicate Piece in Collection ${collectionId}`);
  }
  validateCount(collectionId, pieces, validation.count);

  for(const pieceId of pieces){
    if(!collection.pieces.find(p=>p.id === pieceId)){
      throw new Error(`Piece ${pieceId} not found in collection ${collectionId}`);
    }
  }

  return Promise.all(validation.customValidation.map(async (script)=>(
    await runScriptInFork({
      type: "validation",
      scriptConfig: script,
      args: { pieceIds: pieces },
    })
  )));
}

function validateCount(collectionId: string, pieces: Array<string>, countConfig: number | [number, number]){
  if(!Array.isArray(countConfig)){
    if(pieces.length !== countConfig){
      throw new Error(`Invalid Piece Count in Selection ${collectionId}`);
    }
    return;
  }
  const [min, max] = countConfig;
  if(pieces.length < min){
    throw new Error(`Not Enough Pieces in Selection ${collectionId}`);
  }
  if(pieces.length > max){
    throw new Error(`Too Many Pieces in Selection ${collectionId}`);
  }
}

