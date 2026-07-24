
import { WebSocket } from "ws";
import { MessageBridge, handleFetch } from "@roster-lock/utils";
import { bindStepsToBridge, ProgressListeners } from "./steps";
import { RosterLockV1Config, RosterLockV1SyncDLRequestClientToAgent } from "@roster-lock/types";
import { ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "@roster-lock/shared";
import { UserSelectionSchema } from "../schema/selected";
import { IFolderDB } from "../globals/FolderDB";
import { once } from "events";
import z, { ZodType } from "zod";
import { PluginManager } from "@roster-lock/plugin-runtime";

const RequestCaster: ZodType<(
  & RosterLockV1SyncDLRequestClientToAgent
  & { rosterConfig: any }
)> = z.object({
  relay: z.object({
    url: z.string(),
    roomId: z.string(),
  }),
  user: z.object({
    timestamp: z.number(),
    publicKey: z.string(),
    signature: z.string(),
  }),
  rosterConfig: z.any(),
  userSelection: UserSelectionSchema,
}).strict();

export function castRoomRequest(uncasted: unknown): RosterLockV1SyncDLRequestClientToAgent {
  const parsed = RequestCaster.safeParse(uncasted);
  if(!parsed.success) throw new Error("Invalid request");
  const roomRequest = parsed.data;
  const config = ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(roomRequest.rosterConfig, true);
  const casted = {
    ...roomRequest,
    rosterConfig: config,
  };
  return casted;
}

type User = {
  userId: string,
  publicKey: string,
  displayName: string,
};

export async function exchangeAndDownloadSelections(
  fileDB: IFolderDB,
  pluginRuntime: PluginManager,
  roomRequest: RosterLockV1SyncDLRequestClientToAgent,
  progressListeners: ProgressListeners = {}
){
  const roomURL = prepareRelayURL(roomRequest);

  const httpURL = new URL(roomURL);
  httpURL.pathname = "/api/v1/room/" + roomRequest.relay.roomId + "/users";
  const users = await handleFetch<Array<User>>(fetch(httpURL.href));

  const wsURL = new URL(roomURL);
  wsURL.protocol = roomURL.protocol === "https:" ? "wss:" : "ws:";
  wsURL.pathname = "/api/v1/room/" + roomRequest.relay.roomId;
  // perMessageDeflate disabled: workerd's hibernatable WebSocket (relay-server,
  // local wrangler dev) mishandles fragmented/compressed frames for larger
  // messages, corrupting frame parsing on the "ws" client (surfaces as
  // "Invalid WebSocket frame: invalid payload length").
  const roomWebSocket = new WebSocket(wsURL.href, { perMessageDeflate: false });
  const roomBridge = new MessageBridge((message)=>roomWebSocket.send(JSON.stringify(message)));
  roomWebSocket.on("message", (message)=>{
    roomBridge.handleMessage(JSON.parse(message.toString()));
  });
  roomWebSocket.on("error", (err)=>{
    // An unhandled "error" event on an EventEmitter throws and crashes the
    // whole process - and one match-agent process serves many concurrent
    // games, so a single room's socket hiccup must not take the rest down.
    console.error("room websocket error", err);
  });

  const roomPromise = bindStepsToBridge({
    bridge: roomBridge,
    fileDB,
    pluginRuntime,
    users: users.map(user=>({ publicKey: user.publicKey })),
    ownSelection: roomRequest.userSelection,
    lockConfig: roomRequest.rosterConfig,
    gameControlledSelections: {},
    localUsers: [roomRequest.user.publicKey],
  }, progressListeners);

  // The relay closes the room websocket with a close reason as soon as it fails
  // a room (e.g. a download failure on the other user's leg), but never sends a
  // bridge-level "error" event - so without this, bindStepsToBridge's onEvent("error")
  // handler never fires and the room hangs until its own 30s heartbeat times out,
  // surfacing a misleading "Heartbeat Timeout" instead of the real failure reason.
  const closedEarly = new Promise<never>((_, reject)=>{
    roomWebSocket.on("close", (code, reason)=>{
      const reasonText = reason.toString();
      reject(new Error(reasonText || `Room websocket closed unexpectedly (code ${code})`));
    });
  });
  // roomPromise usually wins the race (success or a bridge-level "error" event),
  // in which case this rejection is never observed - swallow it here so that
  // doesn't crash the process as an unhandled rejection.
  closedEarly.catch(()=>{});

  try {
    await once(roomWebSocket, 'open')
    return await Promise.race([roomPromise, closedEarly]);
  } finally {
    roomWebSocket.close();
  }
}

function prepareRelayURL({ relay, user }: RosterLockV1SyncDLRequestClientToAgent){
  const url = new URL(relay.url);
  url.searchParams.set("room", relay.roomId);
  url.searchParams.set("t", user.timestamp.toString());
  url.searchParams.set("pk", user.publicKey);
  url.searchParams.set("sig", user.signature);
  return url;
}

