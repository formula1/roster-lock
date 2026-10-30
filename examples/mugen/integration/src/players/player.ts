import { randomUUID } from "node:crypto";
import {
  generateKeyPair, getMachines, syncDownloadOverHTTP,
} from "@roster-lock/ts-client";
import { RosterLockV1Config, RosterLockV1SyncDLResult, UserSelection, ConnectionSetup } from "@roster-lock/types";
import * as authClient from "../lib/authClient";
import * as titledRoom from "../lib/titledRoomClient";
import { selectPiecesAtRandom } from "../lib/randomSelect";
import { startGameLauncher, getGameProcessStatus } from "../lib/matchAgentGameLauncher";

const IKEMEN_PLUGIN_NAME = "@roster-lock/game-launcher-ikemen-go";

export type PlayerIdentity = {
  username: string,
  token: string,
  machineId: string,
  keys: { publicKey: string, privateKey: string },
};

/** Registers (idempotent-ish - a fresh username per run), logs in, generates a keypair, and publishes it. */
export async function setupIdentity(authServiceUrl: string, username: string, password: string): Promise<PlayerIdentity> {
  await authClient.register(authServiceUrl, username, password);
  const token = await authClient.login(authServiceUrl, username, password);
  const keys = await generateKeyPair();
  await authClient.setPublicKey(authServiceUrl, token, keys.publicKey);
  await authClient.setPlayers(authServiceUrl, token, 1);
  return { username, token, machineId: randomUUID(), keys };
}

export async function hostCreateRoom(
  titledRoomUrl: string, host: PlayerIdentity,
  rosterConfig: RosterLockV1Config, gameConfig: unknown,
): Promise<string> {
  const room = await titledRoom.createRoom(titledRoomUrl, host.token, {
    title: "Mugen Integration Run",
    gameLauncherPlugin: IKEMEN_PLUGIN_NAME,
    rosterConfig,
    gameConfig,
    maxPlayers: 2,
    minPlayers: 2,
    machineId: host.machineId,
  });
  return room.id;
}

export async function clientJoinRoom(titledRoomUrl: string, client: PlayerIdentity, roomId: string): Promise<void> {
  await titledRoom.joinRoom(titledRoomUrl, client.token, roomId, client.machineId);
}

/**
 * Makes a random selection matching the roster's own selection config and
 * marks this player ready over the room's websocket (the "I am ready" the
 * server checks before /room/start is allowed to succeed - see
 * RoomSession.ts). This orchestrator already gets relayUrl/coordinator
 * straight from the host's own /room/start response (startRoomWhenReady
 * below), so unlike a real browser client it doesn't need to keep the
 * socket open afterward to receive the GAME_HAS_STARTED broadcast too -
 * lib/titledRoomClient.ts's connectRoomSocket still exposes that (mirroring
 * the real client), this orchestration just doesn't need it.
 */
export async function selectAndReady(
  titledRoomUrl: string, identity: PlayerIdentity, roomId: string, rosterConfig: RosterLockV1Config,
): Promise<UserSelection> {
  const socket = titledRoom.connectRoomSocket(titledRoomUrl, identity.token, roomId);
  const selection = selectPiecesAtRandom(rosterConfig);
  await socket.sendReady();
  socket.close();
  return selection;
}

/** Host-only: polls until every participant is ready, then starts the match. */
export async function startRoomWhenReady(
  titledRoomUrl: string, host: PlayerIdentity, roomId: string, expectedPlayers: number, timeoutMs = 30_000,
): Promise<titledRoom.StartRoomResult> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const room = await titledRoom.getRoom(titledRoomUrl, host.token, roomId);
    const participants = Object.values(room.participants);
    if (participants.length >= expectedPlayers && participants.every((p) => p.ready)) {
      return titledRoom.startRoom(titledRoomUrl, host.token, roomId);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for all ${expectedPlayers} players to be ready in room ${roomId}`);
}

/** Relay + download over the shared match-agent - same protocol game-headless's own step 2 uses. */
export async function relayAndDownload(
  identity: PlayerIdentity, relay: { url: string, roomId: string },
  rosterConfig: RosterLockV1Config, selection: UserSelection,
  matchAgentAuthCode: string, matchAgentUrl: string,
): Promise<{ users: Awaited<ReturnType<typeof getMachines>>, downloadResult: RosterLockV1SyncDLResult }> {
  const request = {
    version: 1 as const,
    relay,
    machine: { machineId: identity.machineId, keys: identity.keys },
    rosterConfig,
    playerSelections: { 0: selection },
  };
  const [users, downloadResult] = await Promise.all([
    getMachines({ machine: request.machine, relay: request.relay }),
    syncDownloadOverHTTP(request, matchAgentAuthCode, matchAgentUrl),
  ]);
  return { users, downloadResult };
}

/** Final step: tells the shared match-agent to actually launch Ikemen for this player. */
export async function launchIkemen(
  matchAgentUrl: string, matchAgentAuthCode: string,
  identity: PlayerIdentity, party: "host" | "client", port: number, coordinator: { host: string, port: number },
  allMachines: Awaited<ReturnType<typeof getMachines>>,
  selectionResult: RosterLockV1SyncDLResult, rosterConfig: RosterLockV1Config, gameConfig: unknown, relayRoomId: string,
): Promise<string> {
  // match-agent resolves direct-tcp's coordinator handshake itself (see
  // core/plugin-runtime/src/GameLauncher.ts) before ever invoking the ikemen-go
  // plugin - this is the pre-resolution shape it expects on the wire, not
  // what the plugin ends up running with.
  const connectionSetup: ConnectionSetup = { type: "direct-tcp", party, port, coordinator };
  const { handleId } = await startGameLauncher(matchAgentUrl, matchAgentAuthCode, IKEMEN_PLUGIN_NAME, {
    connectionConfig: connectionSetup,
    currentMachine: { machineId: identity.machineId, publicKey: identity.keys.publicKey, privateKey: identity.keys.privateKey },
    allMachines,
    selectionResult,
    rosterConfig,
    gameConfig,
    relayRoomId,
  });

  // Give the process a moment to actually start (or crash immediately - a
  // bad binaryLocation exits fast) before declaring victory.
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  const status = await getGameProcessStatus(matchAgentUrl, matchAgentAuthCode, IKEMEN_PLUGIN_NAME, handleId);
  if (status.exited !== false) {
    throw new Error(`Ikemen exited immediately for ${party} (code ${status.exited.code}) - check binaryLocation`);
  }
  return handleId;
}
