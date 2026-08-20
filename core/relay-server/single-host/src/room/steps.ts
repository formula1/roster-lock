import { MessageBridge } from "@roster-lock/utils";
import { isDeepStrictEqual } from "node:util";

type UserPublicKey = string;
export type RoomUser = { bridge: MessageBridge, publicKey: UserPublicKey };

// A rejected bridge.sendRequest() surfaces the remote side's thrown error as
// a plain string, not an Error (see MessageBridge's RequestHandler - it
// always ships `e.message` or the raw string across the wire) - callers that
// assume `(e as Error).message` on a room failure reason get `undefined`.
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Unknown Error";
}

const PING_INTERVAL = 1_000;
// Mirrors relay-server-cf's DEFAULT_USER_TIMEOUT_LENGTH - a ping going
// unanswered this long is how a dead connection gets noticed, now that
// there's no hibernation-driven alarm doing it for us.
const PING_TIMEOUT = 5_000;

// This machine drives every step by pushing a request to all connected
// users and waiting for all of them to answer, instead of relay-server-cf's
// pattern of accumulating one incoming message at a time into Durable
// Object storage (that existed to survive hibernation between messages,
// which an always-on in-memory process doesn't need).
export async function runRoomSteps(users: Array<RoomUser>) {
  const pingAbortController = new AbortController();

  try {
    await Promise.race([
      runRoom(users),
      Promise.race(users.map(user => keepPing(user.bridge, pingAbortController.signal))),
      Promise.race(users.map(user => waitForError(user.bridge))),
    ]);
  } catch (e) {
    const message = errorMessage(e);
    for (const user of users) {
      // Best-effort: a peer may already be gone (e.g. it's the one that
      // disconnected), in which case sendEvent throws - that must not stop
      // the rest from being told, or replace the real failure reason below.
      try {
        user.bridge.sendEvent("error", message);
      } catch (sendError) {
        console.error("Failed to send error event to a bridge", sendError);
      }
    }
    throw e;
  } finally {
    pingAbortController.abort();
  }
}

function waitForError(user: MessageBridge) {
  return new Promise<never>((_resolve, reject) => {
    user.onEvent("error", (error) => {
      reject(new Error(error.toString()));
    });
  });
}

async function keepPing(user: MessageBridge, abortSignal: AbortSignal) {
  while (!abortSignal.aborted) {
    const result = await Promise.race([
      user.sendRequest("ping", {}),
      delay(PING_TIMEOUT).then(() => { throw new Error("Ping timed out"); }),
    ]);
    if (result !== "pong") throw new Error("Invalid Response");
    await delay(PING_INTERVAL);
  }
}

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

const UNSET_FINAL = Symbol("unset-final");
const INVALID_FINAL = Symbol("invalid-final");
async function runRoom(users: Array<RoomUser>) {
  const userCommits: Record<UserPublicKey, any> = {};
  await Promise.all(users.map(async (user) => {
    const commit = await user.bridge.sendRequest("user-selection", {});
    userCommits[user.publicKey] = commit;
  }));

  const userReveals: Record<UserPublicKey, any> = {};
  await Promise.all(users.map(async (user) => {
    const reveal = await user.bridge.sendRequest("all-selection-for-user-decryption", userCommits);
    userReveals[user.publicKey] = reveal;
  }));

  let userFinals: typeof UNSET_FINAL | typeof INVALID_FINAL | Record<string, any> = UNSET_FINAL;
  await Promise.all(users.map(async (user) => {
    const final = await user.bridge.sendRequest("all-decryption-for-user-final", userReveals);
    if (userFinals === INVALID_FINAL) return;
    if (userFinals === UNSET_FINAL) {
      userFinals = final;
      return;
    }
    if (!isDeepStrictEqual(userFinals, final)) {
      userFinals = INVALID_FINAL;
      throw new Error("Final Selection Mismatch");
    }
  }));

  for (const user of users) {
    user.bridge.onEvent("download-progress", (data) => {
      for (const otherUser of users) {
        otherUser.bridge.sendEvent("download-progress", { ...data, user: user.publicKey });
      }
    });
  }

  await Promise.all(users.map(async (user) => {
    await user.bridge.sendRequest("user-download", {});
  }));

  for (const user of users) {
    user.bridge.sendEvent("all-download", {});
  }
}
