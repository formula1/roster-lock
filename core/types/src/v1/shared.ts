
export type UserId = string;
export type PieceType = string;
export type PieceId = string;
// RosterLockPiece["version"]["logic"] - the piece's real identity. A media/docs
// update keeps the same LogicId; a logic update is a wholly new one.
export type LogicId = string;
export type Sha256 = string;

export type RosterLockIdentity<P extends string, V extends number> = {
  namespace: "roster-lock", purpose: P, version: V
};

export type Count = number | "*" | [number, number | "*"];
