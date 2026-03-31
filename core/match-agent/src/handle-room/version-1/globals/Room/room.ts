import { JSON_Unknown, ISimpleEventEmitter } from "@match-lock/shared";

export interface IRoom {
  numberOfUsers: number
  listen: ISimpleEventEmitter<[playerId: string, event: string, data: JSON_Unknown]>
  broadcast: (event: string, data: JSON_Unknown)=>Promise<void>
  disconnect: ()=>void
}
