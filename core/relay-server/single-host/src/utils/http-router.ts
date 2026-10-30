
import { IncomingMessage, ServerResponse } from "http";
import { GenericRouter, RouterConfig, GenericRouterCallbackArg, GenericHandlerCallback } from "@roster-lock/utils";

export async function jsonBody(req: IncomingMessage){
  const data: string = await new Promise((resolve, reject)=>{
    let data = "";
    req.on("data", (chunk)=>{data += chunk});
    req.on("end", ()=>{resolve(data)});
    req.on("error", reject);
  })
  return JSON.parse(data);
}

export type HTTPRequest = { req: IncomingMessage, res: ServerResponse };

export type HTTPRequestHandler = GenericHandlerCallback<HTTPRequest>;

export class HTTPRouter extends GenericRouter<HTTPRequest> {
  constructor(config: RouterConfig  = {}){
    super(
      (request)=>new URL(request.req.url || "/", "ws://localhost:80"),
      (request)=>((request.req.method || "GET").toUpperCase()),
      config
    );
  }
  get(path: string, ...callbacks: Array<GenericRouterCallbackArg<HTTPRequest>>){
    return this.addHandler("GET", path, false, ...callbacks);
  }
  query(path: string, ...callbacks: Array<GenericRouterCallbackArg<HTTPRequest>>){
    return this.addHandler("QUERY", path, false, ...callbacks);
  }
  post(path: string, ...callbacks: Array<GenericRouterCallbackArg<HTTPRequest>>){
    return this.addHandler("POST", path, false, ...callbacks);
  }
  put(path: string, ...callbacks: Array<GenericRouterCallbackArg<HTTPRequest>>){
    return this.addHandler("PUT", path, false, ...callbacks);
  }
  patch(path: string, ...callbacks: Array<GenericRouterCallbackArg<HTTPRequest>>){
    return this.addHandler("PATCH", path, false, ...callbacks);
  }
  delete(path: string, ...callbacks: Array<GenericRouterCallbackArg<HTTPRequest>>){
    return this.addHandler("DELETE", path, false, ...callbacks);
  }
}

export class HTTPError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public context?: any,
  ){
    super(message);
  }
}
