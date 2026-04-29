
import { JSON_Unknown } from "../JSON";
import { ISimpleEventEmitter } from "../SimpleEvent";

export interface SimpleMessenger { 
  sendMessage(message: JSON_Unknown): Promise<boolean>,
  onMessage: ISimpleEventEmitter<[message: JSON_Unknown]>,
  close(e?: string): void;
  connect(): Promise<void>
}
