import {
  RosterLockV1Config, SelectedPiece, UserSelection, SelectionNormalConfig
} from "@roster-lock/types";


export async function makeSelect(rosterConfig: RosterLockV1Config): Promise<UserSelection>{
   return selectPiecesAtRandom(rosterConfig);
}

function selectPiecesAtRandom(rosterConfig: RosterLockV1Config){
  const selection: { [pieceType: string]: Array<SelectedPiece> } = {};
  for(const [pieceType, definition] of Object.entries(rosterConfig.engine.pieceDefinitions)){
    if(definition.selectionStrategy === "mandatory"){
      continue;
    }
    if(definition.selectionStrategy === "on demand"){
      continue;
    }
    const available = rosterConfig.rosters[pieceType];
    if(!available) throw new Error(`Missing roster for ${pieceType}`);
    selection[pieceType] = selectFromPieceType(rosterConfig, pieceType);
  }
  return selection;
}

function selectFromPieceType(rosterConfig: RosterLockV1Config, pieceType: string): Array<SelectedPiece>{
  const definition = rosterConfig.engine.pieceDefinitions[pieceType];
  if(!definition) throw new Error(`Missing piece definition for ${pieceType}`);
  const available = rosterConfig.rosters[pieceType];
  if(!available) throw new Error(`Missing roster for ${pieceType}`);
  const selectionConfig = rosterConfig.selection.piece[pieceType];
  if(!selectionConfig) throw new Error(`Missing selection config for ${pieceType}`);
  if(selectionConfig.type === "preselected") throw new Error(`Preselected pieces not implemented`);
  if(selectionConfig.type === "game-controlled") throw new Error(`Game controlled pieces not implemented`);

  const items = [];
  const availableIds = available.map(p=>p.id);
  const count = getCount(selectionConfig.validation?.count || 1);
  const unique = selectionConfig.validation?.unique || false;
  for(let i = 0; i < count; i++){
    const index = randomItem(availableIds.length);
    const item = available[index];
    if(unique) availableIds.splice(index, 1);
    const selection: SelectedPiece = { id: item.id, required: {} };
    for(const requirePieceType of definition.requires){
      const requireDef = item.requiredPieces[requirePieceType]
      if(!requireDef){
        throw new Error(`Piece ${item.id} is missing required piece type ${requirePieceType}`);
      }
      if(requireDef.selectable){
        selection.required[requirePieceType] = selectFromPieceType(rosterConfig, requirePieceType);
      }
    }
    items.push(selection);
  }
  return items;
}

type CountType = NonNullable<SelectionNormalConfig["validation"]>["count"];
function getCount(count: CountType){
  if(!Array.isArray(count)){
    if(count === "*") return 1
    return count;
  }
  const [min, max] = count
  if(max === "*") return min;
  return min + Math.floor(Math.random() * (max - min));
}


function randomItem(max: number){
  return Math.floor(Math.random() * max);
}