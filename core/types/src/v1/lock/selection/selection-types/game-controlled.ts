

// The game will handle the selection however it wants
// The selection should be sent along side the match lock config when creating a room

import { JSONShallowObject, SelectionPieceMeta } from "../meta";

// Room will handle the selection as if it were a "preselected" config
export type SelectionGameControlledConfig = {
  type: "game-controlled",
  pieceMeta?: SelectionPieceMeta<JSONShallowObject>,
}
