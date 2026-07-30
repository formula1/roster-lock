import { MessageBridge } from "@roster-lock/utils";

// A minimal stand-in for the relay server's room orchestration (see the
// reference implementation in
// src/handle-room/version-1/room-handler-bridge/server.pseudo.ts). Drives
// the same request sequence against each user's "room side" bridge, so the
// real encryption/decryption + runSelection + handleDownloads logic inside
// bindStepsToBridge runs for real, without a relay server or network.
export async function driveRoomProtocol(users: Array<{ bridge: MessageBridge, publicKey: string }>) {
  try {
    const userCommits: Record<string, unknown> = {};
    await Promise.all(users.map(async (user) => {
      userCommits[user.publicKey] = await user.bridge.sendRequest("user-selection", {});
    }));

    const userReveals: Record<string, unknown> = {};
    await Promise.all(users.map(async (user) => {
      userReveals[user.publicKey] = await user.bridge.sendRequest("all-selection-for-user-decryption", userCommits);
    }));

    await Promise.all(users.map(async (user) => {
      await user.bridge.sendRequest("all-decryption-for-user-final", userReveals);
    }));

    await Promise.all(users.map(async (user) => {
      await user.bridge.sendRequest("user-download", {});
    }));

    for (const user of users) {
      user.bridge.sendEvent("all-download", {});
    }
  } catch (e) {
    // Mirrors runRooms' error path in server.pseudo.ts: a failure on one
    // user's leg has to be broadcast to every agent, since each agent's
    // bindStepsToBridge promise otherwise just hangs waiting for a
    // "all-download" event that will never come.
    for (const user of users) {
      user.bridge.sendEvent("error", (e as Error).message ?? String(e));
    }
    throw e;
  }
}
