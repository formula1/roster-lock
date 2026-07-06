
import { IncomingMessage } from "http";
import { WebSocket } from "ws";
import { GenericRouter, RouterConfig, GenericRouterCallbackArg, GenericHandlerCallback } from "@roster-lock/utils";

const WEBSOCKET_METHOD = "WebSocket";

export type WSRequest = WebSocket & { httpRequest: IncomingMessage };

export type WebSocketHandlerCallback = GenericHandlerCallback<WSRequest>;
export class WebSocketRouter extends GenericRouter<WSRequest> {
  constructor(config: RouterConfig  = {}){
    super(
      (request)=>new URL(request.url, "ws://localhost:80"),
      (request)=>WEBSOCKET_METHOD,
      config
    );
  }
  mount(path: string, ...callbacks: Array<GenericRouterCallbackArg<WSRequest>>){
    return this.addHandler(WEBSOCKET_METHOD, path, false, ...callbacks);
  }
}

