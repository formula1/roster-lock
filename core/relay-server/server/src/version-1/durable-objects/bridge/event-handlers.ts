import { DurableObjectState } from "@cloudflare/workers-types";
import { WebSocket } from "./utils";
import { makeBridgeEvent } from "./bridge-compatability";

export async function handleDownloadProgress(doState: DurableObjectState, user: WebSocket, value: any){
  await Promise.all(doState.getWebSockets().map((user)=>{
    return makeBridgeEvent(doState, user, "download-progress", value);
  }));
}
