import { JSONShallowObject, SelectionPieceMeta } from "../meta";


export type SelectionUnselectableConfig = {
  type: "unselectable",
  /*
  Shared meta exists so there doesn't have to be duplication of metadata between validation and merging
  If a path of the shared meta intersects with validation of merge meta then its invalid
  */
  pieceMeta: SelectionPieceMeta<JSONShallowObject>,

};
