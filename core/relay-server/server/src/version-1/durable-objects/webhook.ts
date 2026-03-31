import { decryptValue, createHMAC } from "../../utils/crypto";
import { canonicalJSONStringify } from "../../utils/json";
import { RoomConfig } from "../types";
import { RoomType } from "./types";


export async function successWebhook(env: RoomType['env'], config: RoomConfig){

  const coordinator = await env.DB.prepare(
    `SELECT success_webhook_url, api_key_encrypted FROM game_coordinators WHERE id = ?`
  ).bind(
    config.coordinatorId
  ).first<{ success_webhook_url: string, api_key_encrypted: string }>();
  if(!coordinator) throw new Error("Room not found");
  await runWebhook(
    env,
    coordinator.api_key_encrypted,
    coordinator.success_webhook_url,
    { ...config, timestamp: Date.now() }
  );
}

export async function failWebhook(env: RoomType['env'], config: RoomConfig, reason: string, failedUser: string){
  const coordinator = await env.DB.prepare(
    `SELECT failure_webhook_url, api_key_encrypted FROM game_coordinators WHERE id = ?`
  ).bind(
    config.coordinatorId
  ).first<{ failure_webhook_url?: string, api_key_encrypted: string }>();
  if(!coordinator) throw new Error("Room not found");
  if(!coordinator.failure_webhook_url) return;
  await runWebhook(env, coordinator.api_key_encrypted, coordinator.failure_webhook_url, {
    ...config,
    failedReason: reason,
    failedUser,
    timestamp: Date.now()
  });
}


async function runWebhook(env: RoomType['env'], apiKeyEncrypted: string, url: string, body: any){

  const apiKey = await decryptValue(
    apiKeyEncrypted,
    env.GAME_COORDINATOR_ENCRYPTION_KEY
  );


  const webhookController = new AbortController();
  const timeoutController = new AbortController();
  try {
    await Promise.race([
      runFetch(apiKey, url, body, webhookController.signal),
      delay(5_000, timeoutController.signal).then(()=>{
        throw new Error("Webhook timeout");
      }),
    ])
  }finally{
    webhookController.abort();
    timeoutController.abort();
  }
}

async function runFetch(apiKey: string, url: string, body: any, abortSignal: AbortSignal){
  const bodyAsString = canonicalJSONStringify(body);
  const signature = await createHMAC(apiKey, bodyAsString);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signature,
    },
    body: bodyAsString,
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
