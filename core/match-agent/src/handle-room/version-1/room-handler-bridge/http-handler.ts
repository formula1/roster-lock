
import { jsonBody, HTTPRequestHandler } from "../../../utils/http-router";
import { castRoomRequest, exchangeAndDownloadSelections } from "./exchange-and-download-selections";

export const httpHandler: HTTPRequestHandler = async function({ req, res }, params, next){
  try {
    const body = await jsonBody(req);
    const roomRequest = castRoomRequest(body);
    const results = await exchangeAndDownloadSelections(roomRequest);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(results));
  }catch(e){
    next(e);
  }
}
