import {
  UserId,
  MatchLockRestrictionConfig, MatchLockRestrictionPiece,
  MatchLockSelectionConfig,
  doesSelectionFitRestriction,
  extractRestrictionPiecesMatchingSelection
} from "@match-lock/shared";

import { createSimpleEmitter, ISimpleEventEmitter } from "@match-lock/shared";

import { ClientConnection } from "./ClientConnection";

export { ClientConnection };

import { randomSlice } from "./selectors/random";

export class Room {
  private alreadyFinished = false;
  public onDestroy: ISimpleEventEmitter<[error?: Error]> = createSimpleEmitter();
  private connections: Record<UserId, ClientConnection> = {}
  private pieces: Record<string, MatchLockRestrictionPiece> = {}
  private downloadProgress: Record<
    UserId, Record<string, {
      logic: number,
      media: number,
    }>
  > = {}

  constructor(
    public roomId: string,
    private restrictionConfig: MatchLockRestrictionConfig,
    private userKeys: Record<UserId, string>,
  ){}
  async handleUser(userId: UserId, client: ClientConnection){
    const privateKey = await client.requestPrivateKey();
    if(this.userKeys[userId] !== privateKey){
      throw new Error("Invalid Key");
    }
    if(this.connections[userId]){
      throw new Error("User already connected");
    }
    try {
      this.connections[userId] = client;

      this.orderUserToDownloadExistingPieces(userId);
      this.orderExistingUsersToDownloadPieces(userId);

    }catch(e: unknown){
      if(e instanceof Error){
        this.destroy(e);
      }
    }
  }

  orderUserToDownloadExistingPieces(userId: string){
    const client = this.connections[userId];
    this.downloadProgress[userId] = {};
    client.onPieceProgress(({ pieceId, part, progress })=>{
      this.downloadProgress[userId][pieceId][part] = progress;
      this.tryToFinish();
    });
    client.onPieceFailure(({ pieceId, part, reason })=>{
      this.destroy(new Error(`Piece ${pieceId} ${part} failed: ${reason}`));
    });
    for(const piece of Object.values(this.pieces)){
      this.downloadProgress[userId][piece.id] = { logic: 0, media: 0 };
      client.startPiece(piece);
    }
  }

  async orderExistingUsersToDownloadPieces(userId: string){
    const client = this.connections[userId];
    const selection = await client.requestSelection();
    if(!doesSelectionFitRestriction(this.restrictionConfig, selection)){
      throw new Error("Selection does not fit restriction");
    }
    const pieces = extractRestrictionPiecesMatchingSelection(
      this.restrictionConfig, selection
    );
    for(const piece of pieces){
      if(piece.id in this.pieces) continue;
      this.pieces[piece.id] = piece;
      for(const [otherUserId, otherClient] of Object.entries(this.connections)){
        if(otherUserId === userId) continue;
        this.downloadProgress[otherUserId][piece.id] = { logic: 0, media: 0 };
        otherClient.startPiece(piece);
      }
    }
  }

  async tryToFinish(){
    if(this.alreadyFinished){
      throw new Error("Already finished");
    }
    if(
      Object.keys(this.userKeys).length !== Object.keys(this.downloadProgress).length
    ) return false;
    for(const [, progress] of Object.entries(this.downloadProgress)){
      for(const [pieceId, pieceProgress] of Object.entries(progress)){
        // Find logic and media assets in the piece
        const piece = this.pieces[pieceId];
        let logicSize = 0;
        let mediaSize = 0;

        for(const asset of Object.values(piece.assets)){
          if(asset.assetType === 'logic') {
            logicSize += asset.sizeBytes;
          } else if(asset.assetType === 'media') {
            mediaSize += asset.sizeBytes;
          }
        }

        if(pieceProgress.logic !== logicSize) return false;
        if(pieceProgress.media !== mediaSize) return false;
      }
    }
    this.alreadyFinished = true;
    await Promise.all(Object.values(this.connections).map((client)=>(
      client.sendFinished()
    )));
    this.destroy();
    return true;
  }

  destroy(error?: Error){
    for(const client of Object.values(this.connections)){
      client.close(error?.message);
    }
    this.onDestroy.emit(error);
  }
}


