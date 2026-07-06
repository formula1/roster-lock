import { RosterLockV1Config } from "@roster-lock/types";
import { diff } from 'json-diff-ts';
import { SemVer } from "./SemVer";


export function diffLocks(oldLock: RosterLockV1Config, newLock: RosterLockV1Config){
  const versionTracker = new SemVer(oldLock.version);

  diffRosters(versionTracker, oldLock, newLock);

  return versionTracker;
}

function diffRosters(versionTracker: SemVer, oldLock: RosterLockV1Config, newLock: RosterLockV1Config){
  const oldPieceCollections = Object.entries(oldLock.rosters);
  const newPieceCollectionKeys = Object.keys(newLock.rosters);

  const missingCollections: Array<string> = [];
  const addedCollections = new Set(newPieceCollectionKeys);

  for(const [key, oldPieces] of oldPieceCollections){
    const newPieces = newLock.rosters[key];
    if(!newPieces){
      versionTracker.addMajor("Missing Piece Collection", { collectionName: key });
      missingCollections.push(key);
      continue;
    }
    addedCollections.delete(key);
    diffPieces(versionTracker, key, oldPieces, newPieces)
  }
  for(const key of addedCollections){
    versionTracker.addMajor("New Piece Collection", { collectionName: key });
  }

  return versionTracker
}


type PieceCollection = RosterLockV1Config["rosters"][string]
type Piece = PieceCollection[number];
function diffPieces(versionTracker: SemVer, collection: string, oldLock: PieceCollection, newLock: PieceCollection){
  const newPieces = new Map<string, Piece>()
  for(const newPiece of newLock){
    newPieces.set(newPiece.version.logic, newPiece)
  }
  for(const oldPiece of oldLock){
    const newPiece = newPieces.get(oldPiece.version.logic)
    if(!newPiece){
      versionTracker.addMajor(
        "Removed a Piece", { collection, id: oldPiece.id, logic: oldPiece.version.logic }
      )
      continue;
    }
    newPieces.delete(oldPiece.version.logic)
    if(diff(oldPiece, newPiece)){
      versionTracker.addPatch(
        "Updated non gameplay piece info", { collection, id: oldPiece.id, old: oldPiece.downloadSources, new: newPiece.downloadSources }
      )
    }
  }
  for(const [logic, newPiece] of newPieces){
    versionTracker.addMinor(
      "Added a Piece", { collection, id: newPiece.id, logic }
    )
  }
}
