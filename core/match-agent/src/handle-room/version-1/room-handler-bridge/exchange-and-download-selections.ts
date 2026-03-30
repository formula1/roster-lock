
import { WebSocket } from "ws";
import { MessageBridge } from "../../../utils/MessageBridge";
import { bindStepsToBridge, ProgressListeners } from "./steps";
import { ROSTERLOCK_V1_CASTER_JSONSCHEMA, RosterLockV1Config, UserInput } from "@match-lock/shared";
import { UserSelectionSchema } from "../schema/selected";
import { getSQLite3FolderDB } from "../globals/FolderDB";
import { handleFetch } from "../../../utils/fetch";
import { once } from "events";
import z, { ZodType } from "zod";

export type RoomRequest = {
  folder: string,
  relay: {
    url: string,
    roomId: string,
  },
  user: {
    timestamp: number,
    publicKey: string,
    signature: string,
  },
  rosterConfig: any,
  userSelection: UserInput["userSelection"],
}

const RequestCaster: ZodType<RoomRequest> = z.object({
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

export function castRoomRequest(uncasted: unknown): { roomRequest: RoomRequest, rosterConfig: RosterLockV1Config }{
  const parsed = RequestCaster.safeParse(uncasted);
  if(!parsed.success) throw new Error("Invalid request");
  const roomRequest = parsed.data;
  const config = ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(roomRequest.rosterConfig, true);
  return {
    roomRequest,
    rosterConfig: config,
  };
}

type User = {
  userId: string,
  publicKey: string,
  displayName: string,
};

export async function exchangeAndDownloadSelections(
  roomRequest: RoomRequest,
  rosterConfig: RosterLockV1Config,
  progressListeners: ProgressListeners = {}
){
  const fileDB = getSQLite3FolderDB(roomRequest.folder);
  const roomURL = prepareRelayURL(roomRequest);

  const httpURL = new URL(roomURL);
  httpURL.pathname = "/" + roomRequest.relay.roomId + "/users";
  const users = await handleFetch<Array<User>>(fetch(httpURL.href));

  const wsURL = new URL(roomURL);
  wsURL.protocol = roomURL.protocol === "https:" ? "wss:" : "ws:";
  wsURL.pathname = "/" + roomRequest.relay.roomId;
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
    lockConfig: rosterConfig,
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

function prepareRelayURL({ relay, user }: RoomRequest){
  const url = new URL(relay.url);
  url.searchParams.set("room", relay.roomId);
  url.searchParams.set("t", user.timestamp.toString());
  url.searchParams.set("pk", user.publicKey);
  url.searchParams.set("sig", user.signature);
  return url;
}

