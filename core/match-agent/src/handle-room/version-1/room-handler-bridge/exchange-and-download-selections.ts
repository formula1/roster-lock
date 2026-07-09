
import { WebSocket } from "ws";
import { MessageBridge, handleFetch } from "@roster-lock/utils";
import { bindStepsToBridge, ProgressListeners } from "./steps";
import { RosterLockV1Config, RosterLockV1SyncDLRequestClientToAgent } from "@roster-lock/types";
import { ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "@roster-lock/shared";
import { UserSelectionSchema } from "../schema/selected";
import { getSQLite3FolderDB } from "../globals/FolderDB";
import { once } from "events";
import z, { ZodType } from "zod";

const RequestCaster: ZodType<(
  & RosterLockV1SyncDLRequestClientToAgent
  & { rosterConfig: any }
)> = z.object({
  folder: z.string(),
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
  roomRequest: RosterLockV1SyncDLRequestClientToAgent,
  progressListeners: ProgressListeners = {}
){
  const fileDB = getSQLite3FolderDB(roomRequest.folder);
  const roomURL = prepareRelayURL(roomRequest);

  const httpURL = new URL(roomURL);
  httpURL.pathname = "/api/v1/room/" + roomRequest.relay.roomId + "/users";
  const users = await handleFetch<Array<User>>(fetch(httpURL.href));

  const wsURL = new URL(roomURL);
  wsURL.protocol = roomURL.protocol === "https:" ? "wss:" : "ws:";
  wsURL.pathname = "/api/v1/room/" + roomRequest.relay.roomId;
  const roomWebSocket = new WebSocket(wsURL.href);
  const roomBridge = new MessageBridge((message)=>roomWebSocket.send(JSON.stringify(message)));
  roomWebSocket.on("message", (message)=>{
    roomBridge.handleMessage(JSON.parse(message.toString()));
  });

  const roomPromise = bindStepsToBridge({
    bridge: roomBridge,
    fileDB: fileDB,
    users: users.map(user=>({ publicKey: user.publicKey })),
    ownSelection: roomRequest.userSelection,
    lockConfig: roomRequest.rosterConfig,
    scriptsByPath: {},
    gameControlledSelections: {},
  }, progressListeners);

  try {
    await once(roomWebSocket, 'open')
    return await roomPromise;
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

