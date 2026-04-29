
export type UserId = string;
export type PieceType = string;
export type PieceId = string;

export type RosterLockIdentity<P extends string, V extends number> = {
  namespace: "roster-lock", purpose: P, version: V
}
