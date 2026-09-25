
import { MatchLockSelectionConfig, MatchLockRestrictionPiece } from "@match-lock/shared";
import {
  createSimpleEmitter, ISimpleEventEmitter, SimpleMessenger, makeRequest, handleTrigger
} from "@match-lock/shared";

type PieceProgress = {
  pieceId: string,
  part: "logic" | "media",
  progress: number
}

type PieceFailure = {
  pieceId: string,
  part: "logic" | "media",
  reason: string
}

export interface IClientConnection {
  requestPrivateKey(): Promise<string>
  requestSelection(): Promise<MatchLockSelectionConfig>
  startPiece(piece: MatchLockRestrictionPiece): Promise<void>
  onPieceProgress: ISimpleEventEmitter<[PieceProgress]>
  onPieceFailure: ISimpleEventEmitter<[PieceFailure]>
  sendFinished(): Promise<void>

  close(e?: string): void
}

import {
  Object as CastObject, Union as CastUnion,
  String as CastString, Number as CastNumber,
  Literal, Unknown as CastUnknown
} from "runtypes"

import {
  MatchLockSelectionConfigCaster,
} from "@match-lock/shared";


const PieceProgressMessageCaster = CastObject({
  pieceId: CastString,
  part: CastUnion(Literal("logic"), Literal("media")),
  progress: CastNumber,
}).conform<PieceProgress>();

const PieceFailureMessageCaster = CastObject({
  pieceId: CastString,
  part: CastUnion(Literal("logic"), Literal("media")),
  reason: CastString,
}).conform<PieceFailure>();

export class ClientConnection implements IClientConnection {
  onPieceProgress = createSimpleEmitter<[PieceProgress]>();
  onPieceFailure = createSimpleEmitter<[PieceFailure]>();
  constructor(private messenger: SimpleMessenger){
    handleTrigger(messenger, "piece-progress", (data)=>{
      if(!PieceProgressMessageCaster.guard(data)){
        return console.error("Invalid Piece Progress Message", data);
      }
      console.log("Piece Progress", data);
      this.onPieceProgress.emit(data);
    })
    handleTrigger(messenger, "piece-failure", (data)=>{
      if(!PieceFailureMessageCaster.guard(data)){
        return console.error("Invalid Piece Failure Message", data);
      }
      console.log("Piece Failure", data);
      this.onPieceFailure.emit(data);
    })
  }
  async requestPrivateKey(): Promise<string> {
    const result = await makeRequest(this.messenger, "privateKey", void 0);
    return CastString.check(result);
  }
  async requestSelection(): Promise<MatchLockSelectionConfig> {
    const result = await makeRequest(this.messenger, "privateKey", void 0);
    return MatchLockSelectionConfigCaster.check(result);
  }
  async startPiece(piece: MatchLockRestrictionPiece): Promise<void> {
    const pieceId = await makeRequest(this.messenger, "start-piece", piece);
    if(pieceId !== piece.id) throw new Error("Recieved Unexpected Id");
  }

  close(e?: string){
    this.messenger.close(e);
  }

  async sendFinished(){
    await makeRequest(this.messenger, "finished", void 0);
  }
}

