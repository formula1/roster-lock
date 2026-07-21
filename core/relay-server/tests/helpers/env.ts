import { vi } from "vitest";
import { ENCRYPTION } from "@roster-lock/utils";
import { Env } from "../../server/src/version-1/types";

export type FakeCoordinatorRow = {
  success_webhook_url: string;
  failure_webhook_url?: string;
  api_key_encrypted: string;
};

// Room.completeRoom/failRoom both go through webhook.ts, which needs a real
// (decryptable) coordinator row and hits `fetch` for the actual webhook call.
// Building this for real (rather than mocking successWebhook/failWebhook
// directly) means tests exercise the real decrypt-then-sign-then-POST path.
export async function makeFakeEnv(overrides: Partial<FakeCoordinatorRow> = {}){
  const encryptionKey = ENCRYPTION.SYMMETRIC.generateKey();
  const apiKeyEncrypted = await ENCRYPTION.SYMMETRIC.encryptValue(encryptionKey, "test-api-key");

  const coordinator: FakeCoordinatorRow = {
    success_webhook_url: "http://webhook.invalid/success",
    api_key_encrypted: apiKeyEncrypted,
    ...overrides,
  };

  const statements: Array<{ sql: string, args: Array<any> }> = [];

  const DB = {
    prepare: (sql: string) => ({
      bind: (...args: Array<any>) => {
        statements.push({ sql, args });
        return {
          first: async <T>() => coordinator as unknown as T,
          run: async () => ({ success: true }),
        };
      },
    }),
  } as any;

  const env = {
    DB,
    GAME_COORDINATOR_ENCRYPTION_KEY: encryptionKey,
  } as unknown as Env;

  return { env, coordinator, statements };
}

// successWebhook/failWebhook both end up calling the real (global) `fetch` to
// deliver the webhook - stub it so tests don't hit the network. Returns the
// list of calls so tests can assert on webhook delivery if they want to.
export function stubWebhookFetch(){
  const calls: Array<{ url: string, body: any }> = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(init.body as string) : undefined });
    return new Response(null, { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}
