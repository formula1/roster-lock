import { useEffect } from "react";
import { cloneJSON } from "@roster-lock/utils";

import {
  EMPTY_ROSTER_NORMAL_SELECTION,
  EMPTY_ROSTER_UNSELECTABLE_SELECTION,
} from "../../constants/roster-configs";
import { useRosterLock } from "../../Contexts/RosterLock";
import { RosterLockV1Config } from "@roster-lock/types";

import { updatePiece } from "./update-piece";
import { isStrategyUnselectable } from "./is-unselectable";

export function useEnsureCorrectSelection(){
  const { value: lock, onChange } = useRosterLock();
  useEffect(()=>{
    const updates: Array<[string, RosterLockV1Config["selection"]["piece"][string]]> = [];

    for(const [pieceType, def] of Object.entries(lock.engine.pieceDefinitions)){
      const selectionConfig = lock.selection.piece[pieceType];
      const isUnselectable = isStrategyUnselectable(def);
      if(!selectionConfig){
        updates.push([pieceType, cloneJSON(
          isUnselectable ? EMPTY_ROSTER_UNSELECTABLE_SELECTION :
          EMPTY_ROSTER_NORMAL_SELECTION
        )]);
        continue;
      }
      if(isUnselectable && selectionConfig.type !== "unselectable"){
        const newConfig = cloneJSON(EMPTY_ROSTER_UNSELECTABLE_SELECTION);
        newConfig.pieceMeta = selectionConfig.pieceMeta;
        updates.push([pieceType, newConfig]);
        continue;
      }
      if(!isUnselectable && selectionConfig.type === "unselectable"){
        const newConfig = cloneJSON(EMPTY_ROSTER_NORMAL_SELECTION);
        newConfig.pieceMeta = selectionConfig.pieceMeta;
        updates.push([pieceType, newConfig]);
        continue;
      }
    }

    console.log("Making change:", updates);
    if(updates.length === 0) return;
    onChange((prev) =>
      updates.reduce((acc, [pieceType, config]) => updatePiece(acc, pieceType, config), prev)
    );
  }, [lock])
}


