import { GenericHandlerCallback } from "@roster-lock/utils";
import { HTTPRequest } from "./utils/http-router";

// Browser clients (the config-editor PWA) live on a different origin than
// the agent. The auth code is what actually gates access, so any origin may
// attempt a request - reflect it and answer preflights before auth runs
// (preflights carry no Authorization header).
export const corsMiddleware: GenericHandlerCallback<HTTPRequest> = ({ req, res }, routeInfo, next)=>{
  const origin = req.headers.origin;
  if(!origin) return next();

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");

  if(req.method === "OPTIONS"){
    res.writeHead(204);
    res.end();
    return;
  }
  next();
};
