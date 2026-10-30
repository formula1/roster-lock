import { MessageBridge } from "@roster-lock/utils";
import { HTTPRequestHandler, HTTPError } from "../../../utils/http-router";
import { WebSocketHandlerCallback } from "../../../utils/websocket-router";
import { V1Env } from "../globals/types";

export const getGameProcessStatus: HTTPRequestHandler = async function(
  this: V1Env, { res }, routeInfo
){
  const handleId = routeInfo.params.handleId;
  const entry = handleId ? this.processHandles.get(handleId) : undefined;
  if(!entry) throw new HTTPError(404, "Unknown process handle");

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ exited: entry.handle.exited }));
}

// Shared by both the HTTP listing below and gameProcessesWs's push updates,
// so the two stay in the same shape.
function summarizeProcesses(env: V1Env){
  return Array.from(env.processHandles.entries()).map(([handleId, entry]) => ({
    handleId, pluginName: entry.pluginName, exited: entry.handle.exited,
  }));
}

// Every process this match-agent has started, across every game-launcher
// plugin - backs pages/Game in match-agent-client, which shows one row per
// entry regardless of which plugin launched it.
export const listGameProcesses: HTTPRequestHandler = async function(
  this: V1Env, { res }
){
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(summarizeProcesses(this)));
}

// WS counterpart to listGameProcesses - pushes a "processes" snapshot as
// soon as a client connects, then again on every processEvents "changed" (a
// process started, exited, or crashed). No "ready" handshake like the other
// WS routes here use: those exist so a client knows it's safe to send a
// request (onRequest handlers registered), but this route never receives a
// request at all - it's pure server push, so the first "processes" event
// already doubles as that signal.
export const gameProcessesWs: WebSocketHandlerCallback = async function(
  this: V1Env, { ws }, params, next
){
  try {
    const bridge = new MessageBridge((message)=>ws.send(JSON.stringify(message)));
    ws.on("message", (message)=>{
      bridge.handleMessage(JSON.parse(message.toString()));
    });

    const sendSnapshot = ()=>{ bridge.sendEvent("processes", summarizeProcesses(this)); };
    this.processEvents.on("changed", sendSnapshot);
    ws.on("close", ()=>{ this.processEvents.off("changed", sendSnapshot); });

    sendSnapshot();
  }catch(e){
    ws.terminate();
    next(e);
  }
}

// Best-effort, same as GameProcessHandle.stop() itself - see that type's own
// docs on why a plugin may not always be able to actually stop the game.
export const stopGameProcess: HTTPRequestHandler = async function(
  this: V1Env, { res }, routeInfo
){
  const handleId = routeInfo.params.handleId;
  const entry = handleId ? this.processHandles.get(handleId) : undefined;
  if(!entry) throw new HTTPError(404, "Unknown process handle");

  await entry.handle.stop();

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
}
