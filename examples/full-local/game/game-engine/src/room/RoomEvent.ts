import { Room } from "./types";
import { ZodType } from "zod";

import { compareJSON } from "../utils/JSON";
export class RoomEventHandler<T> {
  private currentState: "stopped" | "waiting" | "destroyed" = "stopped";
  public get state(){
    return this.currentState;
  }
  private allUsers: Array<string>;
  private removedUsers: Set<string> = new Set();

  private knockInterval: ReturnType<typeof setInterval> | null = null;
  private currentValues: Record<string, T> = {};
  private selfReady = false;
  private otherValues = new Map<string, Record<string, T>>();
  private promiseHandlers: {
    resolve: ((value: Record<string, T>) => void),
    reject: ((reason: Error) => void)
  } | null = null;
  private off: ()=>void;
  constructor(
    private room: Room, private prefix: string, private schema: ZodType<T>
  ){
    this.allUsers = room.userIds;
    this.off = this.room.onAction.onReturnOff((userId, actionType, body)=>{
      this.handleEvent(userId, actionType, body);
    });
  }

  get activeUsers(){
    return this.allUsers.filter((userId) => {
      if(this.removedUsers.has(userId)) return false;
      return true;
    });
  }

  removeUser(userId: string){
    this.removedUsers.add(userId);
  }

  handleEvent(userId: string, actionTypeFull: string, body: any){
    if(!this.activeUsers.includes(userId)) return;
    if(this.promiseHandlers === null) return;
    const { prefix, suffix: actionType } = RoomEventHandler.actionTypeSplit(actionTypeFull);
    if(prefix !== this.prefix) return;

    try {
      if(actionType === "value"){
        const parsed = this.schema.safeParse(body);
        if(!parsed.success){
          throw new UserError(userId, `Invalid value recieved`);
        }
        // Make sure old values are the new values
        if(this.currentValues[userId]){
          if(!compareJSON(this.currentValues[userId], body)){
            throw new UserError(userId, `Knock value does not match previous value`);
          }
        }
        this.currentValues[userId] = body;
        if(Object.keys(this.currentValues).length < this.activeUsers.length) return;
        const actionTypeReady = RoomEventHandler.actionTypeCreate(this.prefix, "ready");
        this.room.broadcastAction(actionTypeReady, this.currentValues);
        this.selfReady = true;
        if(this.knockInterval){
          clearInterval(this.knockInterval);
          this.knockInterval = null;
        }
        for(const otherValue of this.otherValues.values()){
          if(!compareJSON(this.currentValues, otherValue)){
            throw new UserError(userId, "Values do not match own values");
          }
        }
      } else if(actionType === "ready"){
        if(this.selfReady){
          if(!compareJSON(this.currentValues, body)){
            throw new UserError(userId, "Values do not match own values");
          }
        }
        this.otherValues.set(userId, body);
        if(this.otherValues.size === this.activeUsers.length){
          return this.promiseHandlers?.resolve(this.currentValues);
        }
      }
    }catch(e){
      this.promiseHandlers?.reject(e as Error);
    }
  }
  sendValue(value: T){
    const actionType = RoomEventHandler.actionTypeCreate(this.prefix, "value");
    this.room.broadcastAction(actionType, value);
    this.knockInterval = setInterval(()=>{
      this.room.broadcastAction(actionType, value);
    }, 250);
  }
  waitForAllFinished(){
    if(this.promiseHandlers){
      throw new Error("Already waiting for values");
    }
    this.clear();
    this.currentState = "waiting";
    const { promise, resolve, reject } = Promise.withResolvers<Record<string, T>>();
    this.promiseHandlers = { resolve, reject };
    promise.finally(()=>{
      this.clear();
    });
    return promise;
  }
  clear(){
    this.currentState = "stopped";
    if(this.knockInterval) clearInterval(this.knockInterval);
    this.knockInterval = null;
    this.currentValues = {};
    this.selfReady = false;
    this.otherValues.clear();
    this.promiseHandlers = null;
  }
  destroy(){
    if(this.currentState === "destroyed") return;
    this.currentState = "destroyed";
    if(this.promiseHandlers) this.promiseHandlers.reject(new Error("Destroyed"));
    this.clear();
    this.off();
  }

  static actionTypeSeparator = "=="
  static actionTypeCreate(prefix: string, suffix: string){
    return `${prefix}${this.actionTypeSeparator}${suffix}`;
  }
  static actionTypeSplit(actionType: string){
    // We're expecting this listener to be the closest to the event source
    const parts = actionType.split(this.actionTypeSeparator);
    const prefix = parts.slice(0, -1).join(this.actionTypeSeparator);
    const suffix = parts.at(-1);
    return { prefix, suffix };
  }
}

class UserError extends Error {
  constructor(
    public userId: string,
    message: string,
    public data?: any
  ){
    super(message);
  }
}
