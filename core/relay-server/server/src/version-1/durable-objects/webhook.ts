import { RoomConfig } from "../types";
import { RoomType } from "./types";

export async function successWebhook(env: RoomType['env'], config: RoomConfig){
  const room = await env.DB.prepare(
    `SELECT webhook_room_complete FROM room_stats WHERE room_id = ?`
  ).bind(
    config.roomId
  ).first<{ webhook_room_complete: string }>();
  if(!room) throw new Error("Room not found");
  const webhook_room_complete = room.webhook_room_complete;
  await runWebhook(webhook_room_complete, config);
}

export async function failWebhook(env: RoomType['env'], config: RoomConfig, reason: string, failedUser: string){
  const room = await env.DB.prepare(
    `SELECT webhook_room_failed FROM room_stats WHERE room_id = ?`
  ).bind(
    config.roomId
  ).first<{ webhook_room_failed?: string }>();
  if(!room) throw new Error("Room not found");
  if(!room.webhook_room_failed) return;
  await runWebhook(room.webhook_room_failed, {
    ...config,
    failedReason: reason,
    failedUser,
  });
}


async function runWebhook(url: string, body: any){
  const webhookController = new AbortController();
  const timeoutController = new AbortController();
  try {
    await Promise.race([
      runFetch(url, body, webhookController.signal),
      delay(5_000, timeoutController.signal).then(()=>{
        throw new Error("Webhook timeout");
      }),
    ])
  }finally{
    webhookController.abort();
    timeoutController.abort();
  }
}

async function runFetch(url: string, body: any, abortSignal: AbortSignal){
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: abortSignal,
  });
  if(!response.ok){
    throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
  }
}

async function delay(timeoutMs: number, abortSignal: AbortSignal){
  return new Promise((resolve, reject)=>{
    const to = setTimeout(resolve, timeoutMs);
    abortSignal.addEventListener("abort", ()=>{
      clearTimeout(to);
      reject(new Error("Aborted"));
    });
  });
}
