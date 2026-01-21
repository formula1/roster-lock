import { DurableObjectState } from "@cloudflare/workers-types";
import { Env } from "../types";

export type RoomType = {
  state: DurableObjectState;
  env: Env;
};

export type RoomActions = {
  broadcast: (message: { userId: string; type: string; payload: any }) => void;
  completeRoom: () => void;
}

export type WebSocketAttachment = {
  userId: string;
  publicKey: string;
  connectedAt: string;
}
