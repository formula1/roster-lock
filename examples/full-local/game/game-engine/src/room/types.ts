import { ISimpleEventEmitter } from "../utils/SimpleEvent";
export interface Room {
  userIds: Array<string>
  onAction: ISimpleEventEmitter<[userId: string, actionType: string, body: any]>
  broadcastAction(actionType: string, body: any): void
}
