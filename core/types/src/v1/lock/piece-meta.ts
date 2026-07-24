import { PieceType } from "../shared";
import { JSONShallowObject, SelectionPieceMeta } from "./selection/meta";

/*
Custom fields (tier, difficulty, tags, etc) that selection configs can validate against
and merge algorithms/scripts can read via PIECE_META.get(). Kept out of the selection
config itself so the same selection config can be reused across different rosters.
*/
export type RosterLockPieceMeta = Record<PieceType, SelectionPieceMeta<JSONShallowObject>>;
