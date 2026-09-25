
import { jsonBody, HTTPRequestHandler } from "../../../utils/http-router";
import { castRoomRequest, exchangeAndDownloadSelections } from "./exchange-and-download-selections";
import { V1Env } from "../globals/types";

export const httpHandler: HTTPRequestHandler = async function(this: V1Env, { req, res }, params, next){
  try {
    const body = await jsonBody(req);
    const roomRequest = castRoomRequest(body);
    const results = await exchangeAndDownloadSelections(
      this.fileDB, this.pluginRuntime, roomRequest, undefined,
      (relayRoomId, ctx)=>{ this.gameCompletionContext.set(relayRoomId, ctx); },
    );
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(results));
  }catch(e){
    next(e);
  }
}
