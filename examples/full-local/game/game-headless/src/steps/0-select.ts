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

function selectFromPieceType(
  rosterConfig: RosterLockV1Config, pieceType: string
): Array<SelectedPiece>{
  const definition = rosterConfig.engine.pieceDefinitions[pieceType];
  if(!definition) throw new Error(`Missing piece definition for ${pieceType}`);
  const available = rosterConfig.rosters[pieceType];
  if(!available) throw new Error(`Missing roster for ${pieceType}`);
  const selectionConfig = rosterConfig.selection.piece[pieceType];
  if(!selectionConfig) throw new Error(`Missing selection config for ${pieceType}`);
  if(selectionConfig.type === "preselected") throw new Error(`Preselected pieces not implemented`);
  if(selectionConfig.type === "game-controlled") throw new Error(`Game controlled pieces not implemented`);

  const validation = selectionConfig.type === "normal" ? selectionConfig.validation : undefined;

  const items: Array<SelectedPiece> = [];
  const availableIds = available.map(p=>p.id);
  const count = getCount(validation?.count || 1);
  const unique = validation?.unique || false;
  for(let i = 0; i < count; i++){
    const index = randomItem(availableIds.length);
    const id = availableIds[index];
    const item = available.find(p => p.id === id);
    if(!item) throw new Error(`Missing piece ${id} in roster for ${pieceType}`);
    if(unique) availableIds.splice(index, 1);
    items.push(resolvePiece(rosterConfig, pieceType, item.id));
  }
  return items;
}

// Every piece a roster entry declares as "expected" for a required piece type
// must be downloaded up front (whichever one is actually used gets decided
// later, e.g. at play time for "on demand" pieces like moves/weather) - so
// this always resolves the full expected set as "mandatory", never a subset.
function resolvePiece(
  rosterConfig: RosterLockV1Config, pieceType: string, pieceId: string
): SelectedPiece{
  const definition = rosterConfig.engine.pieceDefinitions[pieceType];
  if(!definition) throw new Error(`Missing piece definition for ${pieceType}`);
  const available = rosterConfig.rosters[pieceType];
  if(!available) throw new Error(`Missing roster for ${pieceType}`);
  const item = available.find(p => p.id === pieceId);
  if(!item) throw new Error(`Missing piece ${pieceId} in roster for ${pieceType}`);

  const selection: SelectedPiece = { id: item.id, required: {} };
  for(const requirePieceType of definition.requires){
    const requireDef = item.requiredPieces[requirePieceType];
    if(!requireDef){
      throw new Error(`Piece ${item.id} is missing required piece type ${requirePieceType}`);
    }
    selection.required[requirePieceType] = {
      mandatory: requireDef.expected.map(expectedId => resolvePiece(rosterConfig, requirePieceType, expectedId)),
      selectable: [],
    };
  }
  return selection;
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