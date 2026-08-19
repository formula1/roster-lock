import { ENCRYPTION, SIGNATURE, canonicalJSONStringify } from "@roster-lock/utils";
import { RoomConfig } from "../types";
import { RoomType } from "./types";

type SymmetricEncryptionKey = Parameters<typeof ENCRYPTION.SYMMETRIC.decryptValue>[0];
type SymmetricSignatureKey = Parameters<typeof SIGNATURE.SYMMETRIC.createSignature>[0];


export async function successWebhook(env: RoomType['env'], config: RoomConfig){
  // `false` is a deliberate "this room has no game coordinator" choice
  // (see RoomConfig.coordinatorId) - nothing to notify, not an error.
  if(config.coordinatorId === false) return;

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

export async function failWebhook(env: RoomType['env'], config: RoomConfig, reason: string, failedMachine: string){
  if(config.coordinatorId === false) return;

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
    failedMachine,
    timestamp: Date.now()
  });
}


async function runWebhook(env: RoomType['env'], apiKeyEncrypted: string, url: string, body: any){

  const apiKey = await ENCRYPTION.SYMMETRIC.decryptValue(
    env.GAME_COORDINATOR_ENCRYPTION_KEY as SymmetricEncryptionKey,
    apiKeyEncrypted
  ) as string;


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
  const signature = await SIGNATURE.SYMMETRIC.createSignature(apiKey as SymmetricSignatureKey, bodyAsString);
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
