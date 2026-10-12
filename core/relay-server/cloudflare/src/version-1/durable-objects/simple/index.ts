import { DurableObjectState } from "@cloudflare/workers-types";
import { Env } from "../../types";
import { z, ZodType } from 'zod';
import { WebSocketAttachment } from "../types";
import { RelayMessage } from "./types";

import { handleHelloMessage } from './methods/hello';
import { handleFinishMessage } from './methods/finish';
import { handleGoodbyeMessage } from './methods/goodbye';

import {
  MATCHLOCK_SELECTION_STATE,
  MATCHLOCK_DOWNLOAD_STATE,
  USER_EVENT,
} from './constants';


const wsMessageCaster: ZodType<RelayMessage> = z.object({
  type: z.string().refine((val) => {
    return (
      val in MATCHLOCK_SELECTION_STATE ||
      val in MATCHLOCK_DOWNLOAD_STATE ||
      val in USER_EVENT
    );
  }),
  payload: z.any(),
}).strict();

type Finishers = {
  completeRoom: ()=>void;
  failRoom: (reason: string, userId?: string)=>void;
}

export async function handleMessage(
  doState: DurableObjectState, env: Env, finishers: Finishers, user: WebSocket, messageRaw: string
){
  // Get user info from the WebSocket's attached metadata
  const attachment = (user as any).deserializeAttachment() as WebSocketAttachment | null;
  if(!attachment) throw new Error("Invalid user");

  const uncastedData = JSON.parse(messageRaw as string);
  const casted = wsMessageCaster.safeParse(uncastedData);
  if(!casted.success) throw new Error('Invalid message');
  const data = casted.data;

  const isReady = await doState.storage.get<boolean>('isReady');
  if(!isReady){
    return await handleHelloMessage(
      {
        state: doState,
        env: env,
        broadcast: (...args)=>(broadcast(doState, ...args)),
        completeRoom: ()=>(finishers.completeRoom()),
      },
      attachment.userId,
      data
    );
  }

  const isGoodbye = await doState.storage.get<boolean>('isGoodbye');
  if(isGoodbye && data.type !== USER_EVENT.goodbye){
    throw new Error('Room should be closing');
  }
  if(data.type === USER_EVENT.goodbye){
    return await handleGoodbyeMessage(
      {
        state: doState,
        env: env,
        broadcast: (...args)=>(broadcast(doState, ...args)),
        completeRoom: ()=>(finishers.completeRoom()),
      },
      attachment.userId,
      data
    );
  }

  if(data.type === USER_EVENT.finish){
    return await handleFinishMessage(
      {
        state: doState,
        env: env,
        broadcast: (...args)=>(broadcast(doState, ...args)),
        completeRoom: ()=>(finishers.completeRoom()),
      },
      attachment.userId,
    );
  }

  // Increment message count (persisted in storage for hibernation)
  await doState.storage.transaction(async (txn) => {
    const messageCount = (await txn.get<number>('messageCount') || 0) + 1;
    await txn.put('messageCount', messageCount);
  });

  broadcast(doState, {
    userId: attachment.userId,
    type: data.type,
    payload: data.payload,
  });
}


export function broadcast(doState: DurableObjectState, message: { userId: string; type: string; payload: any }, excludeUserId?: string){
  const json = JSON.stringify(message);
  const sockets = doState.getWebSockets();

  for (const ws of sockets) {
    const attachment = (ws as any).deserializeAttachment() as WebSocketAttachment | null;
    if (!attachment || attachment.userId === excludeUserId) continue;

    try {
      ws.send(json);
    } catch (error) {
      console.error(`Failed to send to ${attachment.userId}:`, error);
    }
  }
}