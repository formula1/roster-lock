import { RosterLockV1Config, PieceId, PieceType } from "@match-lock/shared";

export class AvailablePieces {
  cachedIds = new Map<PieceType, Array<PieceId>>();
  constructor(public config: RosterLockV1Config){}
  get(pieceType: PieceType){
    const cached = this.cachedIds.get(pieceType);
    if(cached) return cached;
    const ids = this.config.rosters[pieceType].map(p=>p.id);
    this.cachedIds.set(pieceType, ids);
    return ids;
  }
}
