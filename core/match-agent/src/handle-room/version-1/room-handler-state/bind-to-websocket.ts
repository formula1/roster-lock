import { ROSTERLOCK_V1_CASTER_JSONSCHEMA, UserInput, SelectedPiece } from "@match-lock/shared";
import { z, ZodType } from "zod";
import { getSQLite3FolderDB } from "../globals/FolderDB";
import { WebsocketRoom } from "../globals/Room";
import { MessageBridge } from "../../../utils/MessageBridge";
import { WebSocket } from "ws";
import { tryToHandleRoomVersion1 } from "./handleRoomWithErrors";
import { UserSelectionSchema } from "../schema/selected";

/*
Flow
- user interacts with matchmaker
- matchmaker creates room in relay server
- matchmaker provides room id to user
- user connects to room
  - How does the relay room know it's the user
  - Signed GET parameter?
- User needs to know all the other users public keys
- User needs to know their own private key
*/


type RoomRequest = {
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


export const bindRawStateToWebsocket = async (gameWebSocket: WebSocket)=>{
  const messageBridge = new MessageBridge((message)=>gameWebSocket.send(JSON.stringify(message)));
  gameWebSocket.on("message", (message)=>{
    messageBridge.handleMessage(JSON.parse(message.toString()));
  });
  try {
    const roomInfo = await messageBridge.sendRequest("roomInfo", {});

    const parsed = RequestCaster.safeParse(roomInfo);
    if(!parsed.success) throw new Error("Invalid request");
    const roomRequest = parsed.data;
    const config = ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(roomRequest.rosterConfig, true);
    const db = getSQLite3FolderDB(roomRequest.folder);

    const room = new WebsocketRoom(roomRequest.relay, roomRequest.user);
    await room.readyPromise;

    const results = await tryToHandleRoomVersion1(db, room, config, roomRequest.userSelection);

    await messageBridge.sendRequest("roomComplete", results);
    room.disconnect();
  }catch(e){
    console.error(e);
    await messageBridge.sendRequest("roomFailed", (e as Error).message);
  }finally{
    gameWebSocket.close();
  }
}

class WebsocketMessageBridge extends MessageBridge {
  constructor(private websocket: WebSocket){
    super((message)=>websocket.send(JSON.stringify(message)));
    this.websocket.on("message", (message)=>{
      this.handleMessage(JSON.parse(message.toString()));
    });
  }
}